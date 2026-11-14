import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "80mb" }));

let googleAiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!googleAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not configured in environment.");
    }
    googleAiClient = new GoogleGenAI({
      apiKey: apiKey || "MISSING_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return googleAiClient;
}

const VALID_MODELS = new Set([
  "gemini-4-hydrogen",
  "gemini-4-argon",
  "gemini-4-carbon",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite-image",
  "gemini-nano-banana-2.1",
  "gemini-3-pro-image",
  "gemini-3.5-transcribe",
  "gemini-3.8-flash-lite-tts",
  "gemini-3.8-flash-tts",
  "lyria-3-clip-preview",
  "lyria-3-pro-preview",
]);

function normalizeTextModel(model?: string): string {
  if (!model) return "gemini-4-hydrogen";
  if (VALID_MODELS.has(model)) return model;
  if (model.includes("pro") || model.includes("argon")) return "gemini-4-argon";
  if (model.includes("carbon")) return "gemini-4-carbon";
  if (model.includes("lite")) return "gemini-3.1-flash-lite";
  return "gemini-4-hydrogen";
}

function getNextFallbackModel(currentModel?: string): string {
  const m = (currentModel || "").toLowerCase();
  if (m.includes("argon") || m.includes("carbon") || m.includes("pro")) {
    return "gemini-4-hydrogen";
  }
  if (m.includes("4-hydrogen") || m.includes("3.8")) {
    return "gemini-3.1-flash-lite";
  }
  return "gemini-4-hydrogen";
}

function buildSafeConfig(body: any, currentModel: string) {
  const config: any = {
    systemInstruction: body.systemInstruction || body.config?.systemInstruction,
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    ],
  };

  if (body.tools || body.config?.tools) {
    config.tools = body.tools || body.config?.tools;
  }

  if (body.responseMimeType || body.config?.responseMimeType) {
    config.responseMimeType = body.responseMimeType || body.config?.responseMimeType;
  }
  if (body.responseSchema || body.config?.responseSchema) {
    config.responseSchema = body.responseSchema || body.config?.responseSchema;
  }

  const rawThinking = body.thinkingConfig || body.config?.thinkingConfig;
  if (rawThinking && rawThinking.thinkingLevel) {
    const lvl = String(rawThinking.thinkingLevel).toUpperCase();
    // Map cleanly to valid enum & per-model rules
    if (lvl === "XHIGH" && currentModel === "gemini-4-hydrogen") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.XHIGH };
    } else if (lvl === "HIGH" || lvl === "XHIGH") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    } else if (lvl === "MEDIUM") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.MEDIUM };
    } else if (lvl === "LOW") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }
  }

  if (body.responseModalities || body.config?.responseModalities) {
    config.responseModalities = body.responseModalities || body.config?.responseModalities;
  }
  if (body.speechConfig || body.config?.speechConfig) {
    config.speechConfig = body.speechConfig || body.config?.speechConfig;
  }

  return config;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/gemini/stream", async (req, res) => {
  const ai = getAiClient();
  let currentModel = normalizeTextModel(req.body.model);
  const maxRetries = 3;
  let lastError: any = null;

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  for (let i = 0; i < maxRetries; i++) {
    try {
      const requestConfig = buildSafeConfig(req.body, currentModel);
      const stream = await ai.models.generateContentStream({
        model: currentModel,
        contents: req.body.contents,
        config: requestConfig,
      });

      for await (const chunk of stream) {
        const text = chunk.text ?? "";
        if (text) {
          res.write(JSON.stringify({ text }) + "\n");
        }
      }
      res.write(JSON.stringify({ done: true, modelUsed: currentModel }) + "\n");
      res.end();
      return;
    } catch (error: any) {
      lastError = error;
      const msg = (error?.message || JSON.stringify(error)).toUpperCase();
      const shouldFallback =
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("QUOTA") ||
        msg.includes("404") ||
        msg.includes("NOT_FOUND") ||
        msg.includes("403") ||
        msg.includes("PERMISSION_DENIED") ||
        msg.includes("400");

      if (shouldFallback && i < maxRetries - 1) {
        currentModel = getNextFallbackModel(currentModel);
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      if ((msg.includes("503") || msg.includes("UNAVAILABLE")) && i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      break;
    }
  }

  const errMsg = lastError?.message || "AI stream generation failed";
  res.write(JSON.stringify({ error: errMsg }) + "\n");
  res.end();
});

app.post("/api/gemini/generate", async (req, res) => {
  const ai = getAiClient();
  let currentModel = normalizeTextModel(req.body.model);
  const maxRetries = 3;
  let lastError: any = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const requestConfig = buildSafeConfig(req.body, currentModel);
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: req.body.contents,
        config: requestConfig,
      });

      const inlineAudio = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)?.inlineData;
      res.json({
        text: response.text || "",
        modelUsed: currentModel,
        inlineData: inlineAudio || null,
      });
      return;
    } catch (error: any) {
      lastError = error;
      const msg = (error?.message || JSON.stringify(error)).toUpperCase();
      const shouldFallback =
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("QUOTA") ||
        msg.includes("404") ||
        msg.includes("NOT_FOUND") ||
        msg.includes("403") ||
        msg.includes("PERMISSION_DENIED");

      if (shouldFallback && i < maxRetries - 1) {
        currentModel = getNextFallbackModel(currentModel);
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      if ((msg.includes("503") || msg.includes("UNAVAILABLE")) && i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      break;
    }
  }

  res.status(500).json({ error: lastError?.message || "AI generation failed" });
});

app.post("/api/gemini/image", async (req, res) => {
  const ai = getAiClient();
  const { prompt, aspectRatio = "1:1" } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: [{ parts: [{ text: `Generate a crisp, studio-quality visual: ${prompt}` }] }],
      config: {
        imageConfig: { aspectRatio },
      },
    });
    const parts = response.candidates?.[0]?.content?.parts;
    const imgPart = parts?.find((p: any) => p.inlineData?.data);
    if (imgPart?.inlineData?.data) {
      res.json({
        dataUrl: `data:${imgPart.inlineData.mimeType || "image/png"};base64,${imgPart.inlineData.data}`,
      });
      return;
    }
    throw new Error("No image generated");
  } catch (err: any) {
    try {
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-001",
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: aspectRatio as any,
        },
      });
      const b64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (b64) {
        res.json({ dataUrl: `data:image/jpeg;base64,${b64}` });
        return;
      }
    } catch (fallbackErr: any) {
      res.status(500).json({ error: fallbackErr?.message || err?.message || "Image generation failed" });
      return;
    }
    res.status(500).json({ error: err?.message || "Image generation failed" });
  }
});

app.post("/api/gemini/tts", async (req, res) => {
  const ai = getAiClient();
  const { text, voiceName = "Kore" } = req.body;
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [{ parts: [{ text: String(text || "") }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    const base64Audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ dataUrl: `data:audio/wav;base64,${base64Audio}` });
      return;
    }
    res.status(500).json({ error: "No audio returned" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "TTS failed" });
  }
});

app.post("/api/gemini/music", async (req, res) => {
  const ai = getAiClient();
  const { prompt, isFullTrack = false } = req.body;
  const model = isFullTrack ? "lyria-3-pro-preview" : "lyria-3-clip-preview";
  try {
    const stream = await ai.models.generateContentStream({
      model,
      contents: `Generate a music track based on this prompt: ${prompt}`,
      config: {
        responseModalities: [Modality.AUDIO],
      },
    });
    let audioBase64 = "";
    let mimeType = "audio/wav";
    for await (const chunk of stream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
          audioBase64 += part.inlineData.data;
        }
      }
    }
    if (!audioBase64) throw new Error("No audio generated");
    res.json({ dataUrl: `data:${mimeType};base64,${audioBase64}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Music generation failed" });
  }
});

app.get("/api/proxy", async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "Missing URL parameter" });
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch: ${response.statusText}` });
    }
    const text = await response.text();
    res.send(text);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite / Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
startServer();
