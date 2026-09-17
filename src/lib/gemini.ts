import { GoogleGenAI, Modality, ThinkingLevel } from '@google/genai';
import { estimateTokens } from './utils';

let googleAiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!googleAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
                
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will fail. Ensure it is configured in the AI Studio Settings.");
    }
    googleAiClient = new GoogleGenAI({ 
      apiKey: apiKey || 'MISSING_KEY',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return googleAiClient;
}

const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

function getNextFallbackModel(currentModel?: string): string {
  if (!currentModel) return 'gemini-3.8-flash';
  const cleanModel = currentModel.toLowerCase();
  if (cleanModel.includes('pro') || cleanModel.includes('3.5')) {
    return 'gemini-3.8-flash';
  }
  if (cleanModel.includes('3.8')) {
    return 'gemini-3.1-flash-lite';
  }
  if (cleanModel.includes('lite')) {
    return 'gemini-2.5-flash';
  }
  return 'gemini-2.5-flash';
}

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
  } catch (e) {
    return 0;
  }
}

export async function generateContentStreamWithRetry(config: any, maxRetries = 3) {
  const ai = getAiClient();
  let lastError: any = null;
  
  const estimatedTokens = logContextSize(config);
  
  // If we're obviously over the limit, don't even try and waste quota/latency
  if (estimatedTokens > 2000000) {
    throw new Error("Context window full (approx. 2M tokens). Please start a new conversation or remove some large attached files.");
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      const currentModel = config.model || 'gemini-3.8-flash';
      const request: any = {
        model: currentModel,
        contents: config.contents,
        config: {
          system_instruction: config.systemInstruction || config.config?.systemInstruction,
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
          ],
          maxOutputTokens: 8192,
          ...config.generationConfig
        }
      };
      if (config.tools) request.tools = config.tools;

      return await ai.models.generateContentStream(request);
    } catch (error: any) {
      lastError = error;
      const errorMsg = (error.message || JSON.stringify(error)).toUpperCase();
      
      if (errorMsg.includes('TOKEN_COUNT_EXCEEDS_MAXIMUM') || errorMsg.includes('MAX_TOKENS') || errorMsg.includes('400')) {
        console.error("AI Context overflow detected:", error);
        logContextSize(config);
      }

      const isQuotaExceeded = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('QUOTA');
      const isUnavailable = errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE');
      const isNotFound = errorMsg.includes('404') || errorMsg.includes('NOT_FOUND');
      const isForbidden = errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED');
      
      if ((isQuotaExceeded || isNotFound || isForbidden) && i < maxRetries - 1) {
        const nextModel = getNextFallbackModel(config.model);
        console.warn(`Model ${config.model} failed (${isQuotaExceeded ? 'quota exceeded' : 'unavailable'}), seamlessly falling back to ${nextModel}...`);
        config.model = nextModel;
        const delay = 300 + Math.random() * 300;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (isUnavailable && i < maxRetries - 1) {
        const delay = 600 + Math.random() * 400;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function generateContentWithRetry(config: any, maxRetries = 3) {
  const ai = getAiClient();
  let lastError: any = null;
  
  logContextSize(config);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const currentModel = config.model || 'gemini-3.8-flash';
      const request: any = {
        model: currentModel,
        contents: config.contents,
        config: {
          system_instruction: config.systemInstruction || config.config?.systemInstruction,
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
          ],
          maxOutputTokens: 8192,
          ...config.generationConfig
        }
      };
      if (config.tools) request.tools = config.tools;

      return await ai.models.generateContent(request);
    } catch (error: any) {
      lastError = error;
      const errorMsg = (error.message || JSON.stringify(error)).toUpperCase();

      if (errorMsg.includes('TOKEN_COUNT_EXCEEDS_MAXIMUM') || errorMsg.includes('MAX_TOKENS') || errorMsg.includes('400')) {
        console.error("AI Context overflow detected:", error);
        logContextSize(config);
      }
      
      const isQuotaExceeded = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('QUOTA');
      const isUnavailable = errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE');
      const isDeadline = errorMsg.includes('DEADLINE_EXCEEDED');
      const isNotFound = errorMsg.includes('404') || errorMsg.includes('NOT_FOUND');
      const isForbidden = errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED');
      
      if ((isQuotaExceeded || isNotFound || isForbidden) && i < maxRetries - 1) {
        const nextModel = getNextFallbackModel(config.model);
        console.warn(`Model ${config.model} failed (${isQuotaExceeded ? 'quota exceeded' : 'unavailable'}), seamlessly falling back to ${nextModel}...`);
        config.model = nextModel;
        const delay = 300 + Math.random() * 300;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if ((isUnavailable || isDeadline) && i < maxRetries - 1) {
        const delay = 600 + Math.random() * 400;
        console.warn(`AI model busy. Retrying fast in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function generateChat(messages: { role: string; content: string }[], passedModelName = "gemini-3.8-flash", temp = 0.7) {
  let systemInstruction = "";
  const contents: any[] = [];
  
  let modelName = passedModelName;
  if (!modelName || modelName.includes("gpt") || modelName.includes("o1") || modelName.includes("claude")) {
    modelName = "gemini-3.8-flash";
  }
  if (!modelName.startsWith("gemini") && !modelName.startsWith("lyria") && !modelName.startsWith("veo") && !modelName.startsWith("imagen")) {
    modelName = "gemini-3.8-flash";
  }
  
  for (const msg of messages) {
    if (msg.role === "system") {
       systemInstruction += msg.content + "\n";
    } else {
       contents.push({
         role: msg.role === 'user' ? 'user' : 'model',
         parts: [{ text: msg.content }]
       });
    }
  }

  const result = await generateContentWithRetry({
    model: modelName,
    contents,
    config: {
      temperature: temp,
      systemInstruction: systemInstruction ? systemInstruction.trim() : undefined,
    }
  });

  return result.text || "";
}

export async function generateImage(prompt: string, aspectRatio: string = "1:1", base64Image?: string, mimeType?: string) {
    try {
      const ai = getAiClient();
      const response = await ai.models.generateImages({
          model: 'imagen-3.0-generate-001',
          prompt: prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio as any,
          },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("No image generated by the AI model.");
      }

      const base64EncodeString: string = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64EncodeString}`;
    } catch (error) {
      console.error("Gemini Image API failed, attempting multimodal generation fallback:", error);
      try {
        const ai = getAiClient();
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: [{ parts: [{ text: `Generate an image depicting: ${prompt}` }] }]
        });
        const candidate = fallbackRes.candidates?.[0]?.content?.parts;
        const imgPart = candidate?.find((p: any) => p.inlineData?.data);
        if (imgPart?.inlineData?.data) {
          return `data:${imgPart.inlineData.mimeType || 'image/png'};base64,${imgPart.inlineData.data}`;
        }
      } catch (fbErr) {
        console.error("Image fallback also failed:", fbErr);
      }
      throw error;
    }
}

export async function transcribeAudio(audioBase64: string, mimeType: string) {
  let base64Data = audioBase64;
  if (base64Data.startsWith('data:')) {
    base64Data = base64Data.split(',')[1] || base64Data;
  }
  
  try {
    const result = await generateContentWithRetry({
      model: "gemini-3.5-transcribe",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: "Please transcribe this audio accurately. Just output the transcript text. Preserve the original language and nuance." }
          ]
        }
      ]
    });
    return result.text || "";
  } catch (err) {
    // Fallback to gemini-3.8-flash if transcribe model is not provisioned
    const result = await generateContentWithRetry({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: "Please transcribe this audio accurately. Just output the transcript text. Preserve the original language." }
          ]
        }
      ]
    });
    return result.text || "";
  }
}

export async function generateTTS(text: string) {
  const ai = getAiClient();
  try {
    const result = await generateContentWithRetry({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });

    const base64Audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return `data:audio/wav;base64,${base64Audio}`;
    }
  } catch (e) {
    console.warn("Gemini TTS service unavailable, creating audio element synthesis fallback:", e);
  }

  // Graceful browser-playable synthetic silence/beeps or audio notification buffer so media players never crash
  const sampleRate = 16000;
  const durationSec = 1;
  const numSamples = sampleRate * durationSec;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + numSamples * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  
  // Minimal soft chime
  for (let i = 0; i < numSamples; i++) {
    const s = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * Math.exp(-3 * (i / sampleRate));
    view.setInt16(44 + i * 2, s * 8000, true);
  }
  
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export async function generateMusic(prompt: string, isFullTrack: boolean = false) {
  const ai = getAiClient();
  const model = isFullTrack ? "lyria-3-pro-preview" : "lyria-3-clip-preview";
  
  try {
    const response = await ai.models.generateContentStream({
      model: model,
      contents: `Generate a music track based on this prompt: ${prompt}`,
      config: {
        responseModalities: [Modality.AUDIO]
      }
    });

    let audioBase64 = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
      }
    }

    if (!audioBase64) throw new Error("No audio data generated");
    
    // Decode base64 audio into a playable Blob URL
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Music generation failed:", error);
    throw error;
  }
}

export async function enhancePrompt(promptText: string): Promise<string> {
  const result = await generateContentWithRetry({
    model: 'gemini-3.8-flash',
    contents: `Rewrite and enhance this short or low-quality prompt to be detail-rich, professional, clear, and perfectly structured for an advanced LLM. Do not ask questions or do any preamble—just return the beautifully enhanced, detailed prompt text (use markdown for tables, bullet points, and codeblocks where applicable if it helps clarify details):\n\nOriginal Prompt:\n"${promptText}"`,
    systemInstruction: "You are an expert prompt engineer. Your job is to analyze short or simple instructions and expand them into detail-rich, clear, standard, task-oriented professional prompts. Add structure, edge cases, output format expectations, and deep contextual guidance while keeping original user intent 100% intact.",
  });
  return result.text || promptText;
}
