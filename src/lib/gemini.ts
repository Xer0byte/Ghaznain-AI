import { GoogleGenAI, Modality } from '@google/genai';

let googleAiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!googleAiClient) {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY
                || (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : undefined);
                
    if (!apiKey || apiKey === 'MISSING_KEY') {
      console.warn("GEMINI_API_KEY is not defined. AI features will fail.");
    }
    googleAiClient = new GoogleGenAI({ apiKey: apiKey || 'MISSING_KEY' });
  }
  return googleAiClient;
}

export async function generateContentWithRetry(config: any, maxRetries = 3) {
  const ai = getAiClient();
  let lastError: any = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(config);
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message?.toUpperCase() || "";
      const isRetryable = errorMsg.includes('503') || 
                         errorMsg.includes('UNAVAILABLE') || 
                         errorMsg.includes('429') || 
                         errorMsg.includes('TOO MANY REQUESTS') ||
                         errorMsg.includes('DEADLINE_EXCEEDED');
      
      if (isRetryable && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
        console.warn(`AI model busy or rate limited (Retry ${i + 1}/${maxRetries}). Retrying in ${Math.round(delay)}ms...`);
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
  if (!modelName || modelName.includes("gpt") || modelName.includes("o1") || modelName.includes("claude") || modelName === "gemini-1.5-flash" || modelName === "gemini-2.5-flash") {
    modelName = "gemini-3-flash-preview";
  }
  if (!modelName.startsWith("gemini") && !modelName.startsWith("lyria") && !modelName.startsWith("veo")) {
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

export async function generateImage(prompt: string) {
    const response = await generateContentWithRetry({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          { text: prompt },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString: string = part.inlineData.data;
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
    }
  }

  throw new Error("Image generation failed.");
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
