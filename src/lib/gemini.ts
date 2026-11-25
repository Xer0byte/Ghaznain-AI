import { estimateTokens } from './utils';

function logContextSize(config: any) {
  try {
    const contents = Array.isArray(config.contents) ? config.contents : [config.contents];
    const tokens = estimateTokens(contents);
    if (tokens > 500) {
      console.log(`AI context size estimate: ~${tokens.toLocaleString()} tokens`);
    }
    if (tokens > 1000000) {
      console.warn("DANGER: AI context size likely exceeds 1M token limit!");
    }
    return tokens;
  } catch {
    return 0;
  }
}

export async function generateContentStreamWithRetry(config: any) {
  const estimatedTokens = logContextSize(config);
  if (estimatedTokens > 2000000) {
    throw new Error("Context window full (approx. 2M tokens). Please start a new conversation or remove some large attached files.");
  }

  const response = await fetch("/api/gemini/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model || "gemini-4-hydrogen",
      contents: config.contents,
      systemInstruction: config.systemInstruction || config.config?.systemInstruction,
      tools: config.tools || config.config?.tools,
      thinkingConfig: config.thinkingConfig || config.config?.thinkingConfig,
    }),
  });

  if (!response.ok || !response.body) {
    const errBody = await response.text();
    throw new Error(errBody || `AI Stream Error (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  async function* streamGenerator() {
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.text) {
            yield { text: parsed.text };
          }
        } catch (e: any) {
          if (e?.message && !e.message.includes("JSON")) {
            throw e;
          }
        }
      }
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) yield { text: parsed.text };
      } catch {
        // Ignore trailing partial
      }
    }
  }

  return streamGenerator();
}

export async function generateContentWithRetry(config: any) {
  logContextSize(config);

  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model || "gemini-4-hydrogen",
      contents: config.contents,
      systemInstruction: config.systemInstruction || config.config?.systemInstruction,
      tools: config.tools || config.config?.tools,
      thinkingConfig: config.thinkingConfig || config.config?.thinkingConfig,
      responseMimeType: config.responseMimeType || config.config?.responseMimeType,
      responseSchema: config.responseSchema || config.config?.responseSchema,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || `AI request failed (${response.status})`);
  }

  return {
    text: data.text || "",
    modelUsed: data.modelUsed,
    candidates: data.inlineData
      ? [{ content: { parts: [{ inlineData: data.inlineData }] } }]
      : undefined,
  };
}

export async function generateChat(
  messages: { role: string; content: string }[],
  passedModelName = "gemini-4-hydrogen"
) {
  let systemInstruction = "";
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction += msg.content + "\n";
    } else {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }
  }

  const result = await generateContentWithRetry({
    model: passedModelName,
    contents,
    systemInstruction: systemInstruction ? systemInstruction.trim() : undefined,
  });

  return result.text || "";
}

export async function generateImage(
  prompt: string,
  aspectRatio: string = "1:1",
  base64Image?: string,
  mimeType?: string
) {
  const response = await fetch("/api/gemini/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      aspectRatio,
      base64Image,
      mimeType,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.dataUrl) {
    throw new Error(data.error || "Image generation failed");
  }
  return data.dataUrl as string;
}

export async function transcribeAudio(audioBase64: string, mimeType: string) {
  let base64Data = audioBase64;
  if (base64Data.startsWith("data:")) {
    base64Data = base64Data.split(",")[1] || base64Data;
  }

  const result = await generateContentWithRetry({
    model: "gemini-3.5-transcribe",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          {
            text: "Please transcribe this audio accurately. Just output the transcript text. Preserve the original language and nuance.",
          },
        ],
      },
    ],
  });
  return result.text || "";
}

export async function generateTTS(text: string) {
  try {
    const response = await fetch("/api/gemini/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    if (response.ok && data.dataUrl) {
      return data.dataUrl as string;
    }
  } catch (e) {
    console.warn("Gemini TTS service unavailable, using audio chime fallback:", e);
  }

  const sampleRate = 16000;
  const durationSec = 1;
  const numSamples = sampleRate * durationSec;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * Math.exp(-3 * (i / sampleRate));
    view.setInt16(44 + i * 2, s * 8000, true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

export async function generateMusic(prompt: string, isFullTrack: boolean = false) {
  const response = await fetch("/api/gemini/music", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, isFullTrack }),
  });
  const data = await response.json();
  if (!response.ok || !data.dataUrl) {
    throw new Error(data.error || "Music generation failed");
  }
  const b64 = data.dataUrl.split(",")[1];
  const mime = data.dataUrl.split(";")[0].split(":")[1] || "audio/wav";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

export async function enhancePrompt(promptText: string): Promise<string> {
  const result = await generateContentWithRetry({
    model: "gemini-4-hydrogen",
    contents: `Rewrite and enhance this short or low-quality prompt to be detail-rich, professional, clear, and perfectly structured for an advanced LLM. Do not ask questions or do any preamble—just return the beautifully enhanced, detailed prompt text (use markdown for tables, bullet points, and codeblocks where applicable if it helps clarify details):\n\nOriginal Prompt:\n"${promptText}"`,
    systemInstruction:
      "You are an expert prompt engineer. Your job is to analyze short or simple instructions and expand them into detail-rich, clear, standard, task-oriented professional prompts. Add structure, edge cases, output format expectations, and deep contextual guidance while keeping original user intent 100% intact.",
  });
  return result.text || promptText;
}
