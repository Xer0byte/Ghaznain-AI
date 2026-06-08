import { GoogleGenAI, Modality, ThinkingLevel } from '@google/genai';
import { estimateTokens } from './utils';

let googleAiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!googleAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
                
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will fail. Ensure it is configured in the AI Studio Settings.");
    }
    googleAiClient = new GoogleGenAI({ apiKey: apiKey || 'MISSING_KEY' });
  }
  return googleAiClient;
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
      if (i === maxRetries - 1) {
        config.model = 'gemini-3-flash-preview';
      }

      const request: any = {
        model: config.model || 'gemini-3-flash-preview',
        contents: config.contents,
        config: {
          system_instruction: config.systemInstruction,
          ...config.generationConfig
        }
      };
      if (config.tools) request.tools = config.tools;

      return await ai.models.generateContentStream(request);
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message?.toUpperCase() || "";
      
      if (errorMsg.includes('TOKEN_COUNT_EXCEEDS_MAXIMUM') || errorMsg.includes('MAX_TOKENS') || errorMsg.includes('400')) {
        console.error("AI Context overflow detected:", error);
        logContextSize(config);
      }

      const isQuotaExceeded = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('QUOTA');
      const isUnavailable = errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE');
      const isRetryable = isUnavailable || (isQuotaExceeded && !errorMsg.includes('PER_DAY'));
      
      if (isRetryable && i < maxRetries - 1) {
        const delay = 500 + Math.random() * 500; // Reduced delay for faster feedback
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
      // If we are on the last retry and it's a 429, try falling back to a more available model
      if (i === maxRetries - 1) {
        config.model = 'gemini-3-flash-preview';
      }

      const request: any = {
        model: config.model || 'gemini-3-flash-preview',
        contents: config.contents,
        config: {
          system_instruction: config.systemInstruction,
          ...config.generationConfig
        }
      };
      if (config.tools) request.tools = config.tools;

      return await ai.models.generateContent(request);
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message?.toUpperCase() || "";

      if (errorMsg.includes('TOKEN_COUNT_EXCEEDS_MAXIMUM') || errorMsg.includes('MAX_TOKENS') || errorMsg.includes('400')) {
        console.error("AI Context overflow detected:", error);
        logContextSize(config);
      }
      
      const isQuotaExceeded = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('QUOTA');
      const isUnavailable = errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE');
      const isDeadline = errorMsg.includes('DEADLINE_EXCEEDED');
      
      const isRetryable = isUnavailable || isDeadline || (isQuotaExceeded && !errorMsg.includes('PER_DAY'));
      
      if (isRetryable && i < maxRetries - 1) {
        const delay = 500 + Math.random() * 500; // Reduced delay
        console.warn(`AI model busy. Retrying fast in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function generateChat(messages: { role: string; content: string }[], passedModelName = "gemini-3-flash-preview", temp = 0.7) {
  let systemInstruction = "";
  const contents: any[] = [];
  
  // Use recommended model instead of deprecated ones
  let modelName = passedModelName;
  if (!modelName || modelName.includes("gpt") || modelName.includes("o1") || modelName.includes("claude") || 
      modelName === "gemini-3-flash-preview" || modelName === "gemini-3.1-pro-preview" || modelName === "gemini-3-flash-preview") {
    modelName = "gemini-3-flash-preview";
  }
  if (!modelName.startsWith("gemini") && !modelName.startsWith("lyria") && !modelName.startsWith("veo") && !modelName.startsWith("imagen")) {
      modelName = "gemini-3-flash-preview";
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

export async function generateImage(prompt: string, aspectRatio: string = "1:1") {
    try {
      const response = await generateContentWithRetry({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { text: `Generate a high-quality, detailed image strictly following this prompt: "${prompt}". Do not add unnecessary elements. Ensure the image is clear and professional.` },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K"
          }
        }
      });
    
      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error("No candidates returned from Gemini image generation");
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
        }
      }
      
      throw new Error("No image data found in Gemini response");
    } catch (error) {
      console.error("Gemini Image API failed:", error);
      throw error;
    }
}

export async function transcribeAudio(audioBase64: string, mimeType: string) {
  let base64Data = audioBase64;
  if (base64Data.startsWith('data:')) {
    base64Data = base64Data.split(',')[1] || base64Data;
  }
  
  const result = await generateContentWithRetry({
    model: "gemini-3-flash-preview",
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

export async function generateTTS(text: string) {
  // TTS is not natively available in all standard models without limit issues
  // Using an external API would be better or a free mock, but let's try the safest available
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
    if (!base64Audio) throw new Error("Audio generation failed");
    return `data:audio/wav;base64,${base64Audio}`;
  } catch (e) {
    console.error(e);
    throw new Error("TTS is currently limited in this model version.");
  }
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
    model: 'gemini-3-flash-preview',
    contents: `Rewrite and enhance this short or low-quality prompt to be detail-rich, professional, clear, and perfectly structured for an advanced LLM. Do not ask questions or do any preamble—just return the beautifully enhanced, detailed prompt text (use markdown for tables, bullet points, and codeblocks where applicable if it helps clarify details):\n\nOriginal Prompt:\n"${promptText}"`,
    systemInstruction: "You are an expert prompt engineer. Your job is to analyze short or simple instructions and expand them into detail-rich, clear, standard, task-oriented professional prompts. Add structure, edge cases, output format expectations, and deep contextual guidance while keeping original user intent 100% intact.",
  });
  return result.text || promptText;
}
