import express from "express";
import cors from "cors";
import path from "path";
import net from "net";
import dns from "dns/promises";
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

function buildSafeConfig(body: any, currentModel: string, stripTools = false) {
  const config: any = {
    systemInstruction: body.systemInstruction || body.config?.systemInstruction,
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    ],
  };

  const incomingTools = body.tools || body.config?.tools;
  if (!stripTools && Array.isArray(incomingTools) && incomingTools.length > 0) {
    // Lite models may not support urlContext; keep compatible tools when falling back
    if (currentModel === "gemini-3.1-flash-lite") {
      const liteTools = incomingTools.filter((t: any) => !t?.urlContext);
      if (liteTools.length > 0) config.tools = liteTools;
    } else {
      config.tools = incomingTools;
    }
  }

  if (body.responseMimeType || body.config?.responseMimeType) {
    config.responseMimeType = body.responseMimeType || body.config?.responseMimeType;
  }
  if (body.responseSchema || body.config?.responseSchema) {
    config.responseSchema = body.responseSchema || body.config?.responseSchema;
  }

  const rawThinking = body.thinkingConfig || body.config?.thinkingConfig;
  if (rawThinking && rawThinking.thinkingLevel && currentModel !== "gemini-3.1-flash-lite") {
    const lvl = String(rawThinking.thinkingLevel).toUpperCase();
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

// --- Safe External URL Validation & Extraction ---
function isPrivateIpAddress(ip: string): boolean {
  const cleanIp = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (!cleanIp) return true;

  if (cleanIp.startsWith("::ffff:")) {
    return isPrivateIpAddress(cleanIp.slice(7));
  }

  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast / reserved
    return false;
  }

  if (net.isIPv6(cleanIp)) {
    if (cleanIp === "::1" || cleanIp === "::") return true;
    if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true; // ULA
    if (cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) {
      return true; // Link-local
    }
    return false;
  }

  return true;
}

async function validateExternalUrl(rawUrl: string): Promise<URL> {
  let normalized = (rawUrl || "").trim();
  if (!normalized) throw new Error("Empty URL");
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  const parsed = new URL(normalized);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS links are supported.");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Local or internal network addresses are not permitted.");
  }

  if (net.isIP(host)) {
    if (isPrivateIpAddress(host)) {
      throw new Error("Private network IP addresses are not permitted.");
    }
    return parsed;
  }

  try {
    const resolved = await dns.lookup(host, { all: true });
    if (!resolved || resolved.length === 0) {
      throw new Error(`Could not resolve host ${host}`);
    }
    for (const addr of resolved) {
      if (isPrivateIpAddress(addr.address)) {
        throw new Error("Resolved address points to a restricted network.");
      }
    }
  } catch (err: any) {
    if (err?.message?.includes("restricted network") || err?.message?.includes("resolve host")) {
      throw err;
    }
    // Allow fallback readers like r.jina.ai to still attempt resolution if local DNS fails transiently
  }

  return parsed;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractStructuredHtmlData(html: string, baseUrl: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "";

  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const description = metaDescMatch ? decodeHtmlEntities(metaDescMatch[1]).trim() : "";

  const jsonLdBlocks: string[] = [];
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch;
  while ((ldMatch = jsonLdRegex.exec(html)) !== null && jsonLdBlocks.length < 5) {
    const rawLd = ldMatch[1].trim();
    if (rawLd) jsonLdBlocks.push(rawLd.slice(0, 6000));
  }

  const headings: string[] = [];
  const headingRegex = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null && headings.length < 40) {
    const txt = stripTags(hMatch[2]);
    if (txt) headings.push(`${hMatch[1].toUpperCase()}: ${txt}`);
  }

  const links: string[] = [];
  const seenHref = new Set<string>();
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let lMatch;
  while ((lMatch = linkRegex.exec(html)) !== null && links.length < 40) {
    const rawHref = lMatch[1].trim();
    if (!rawHref || /^javascript:/i.test(rawHref) || /^mailto:/i.test(rawHref)) continue;
    try {
      const absUrl = new URL(rawHref, baseUrl).toString();
      if (!seenHref.has(absUrl)) {
        seenHref.add(absUrl);
        const anchorText = stripTags(lMatch[2]).slice(0, 80);
        links.push(anchorText ? `- [${anchorText}](${absUrl})` : `- ${absUrl}`);
      }
    } catch {
      // Ignore invalid relative URLs
    }
  }

  // Clean HTML body for readable text extraction
  let cleanBody = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|canvas|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|blockquote)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<t[dh][^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ");

  cleanBody = decodeHtmlEntities(cleanBody)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  // Also compact raw HTML (stripped of huge inline scripts/svgs) for optional code cloning
  const compactHtml = html
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "<svg></svg>")
    .replace(/\s{2,}/g, " ")
    .slice(0, 45000);

  return {
    title,
    description,
    headings,
    links,
    jsonLdBlocks,
    readableText: cleanBody.slice(0, 60000),
    compactHtml,
  };
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readSingleExternalUrl(rawUrl: string) {
  const parsedUrl = await validateExternalUrl(rawUrl);
  const targetUrl = parsedUrl.toString();

  let title = "";
  let description = "";
  let contentType = "text/html";
  let readableText = "";
  let headings: string[] = [];
  let links: string[] = [];
  let jsonLdBlocks: string[] = [];
  let rawHtml = "";
  let finalUrl = targetUrl;
  let fetchMethod = "direct";
  let directStatus = 0;

  try {
    const response = await fetchWithTimeout(targetUrl, {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain;q=0.8,*/*;q=0.7",
      "Accept-Language": "en-US,en;q=0.9",
    });

    directStatus = response.status;
    if (response.url) {
      await validateExternalUrl(response.url);
      finalUrl = response.url;
    }

    contentType = (response.headers.get("content-type") || "text/html").toLowerCase();

    if (response.ok) {
      if (contentType.includes("application/json") || contentType.includes("+json")) {
        const jsonText = await response.text();
        try {
          readableText = JSON.stringify(JSON.parse(jsonText), null, 2).slice(0, 60000);
        } catch {
          readableText = jsonText.slice(0, 60000);
        }
      } else if (
        contentType.includes("text/plain") ||
        contentType.includes("text/markdown") ||
        contentType.includes("text/csv") ||
        contentType.includes("xml") ||
        contentType.includes("rss") ||
        contentType.includes("atom")
      ) {
        readableText = (await response.text()).slice(0, 60000);
      } else if (contentType.includes("application/pdf")) {
        readableText = `[PDF document at ${finalUrl} (${response.headers.get("content-length") || "binary"} bytes). Use Gemini URL Context tool to read full PDF contents.]`;
      } else {
        const html = await response.text();
        const extracted = extractStructuredHtmlData(html, finalUrl);
        title = extracted.title;
        description = extracted.description;
        headings = extracted.headings;
        links = extracted.links;
        jsonLdBlocks = extracted.jsonLdBlocks;
        readableText = extracted.readableText;
        rawHtml = extracted.compactHtml;
      }
    }
  } catch (err: any) {
    console.warn(`Direct fetch error for ${targetUrl}:`, err?.message || err);
  }

  // Fallback for JS-rendered SPAs or strict anti-bot sites (403/401/empty body)
  const needsRenderedFallback =
    (!readableText || readableText.length < 250) && !contentType.includes("application/pdf");

  if (needsRenderedFallback) {
    try {
      const readerResponse = await fetchWithTimeout(`https://r.jina.ai/${targetUrl}`, {
        "User-Agent": "Xer0byte-AI-Reader/1.0",
        Accept: "text/plain, text/markdown",
      }, 14000);

      if (readerResponse.ok) {
        const jinaText = (await readerResponse.text()).trim();
        if (jinaText && jinaText.length > readableText.length) {
          readableText = jinaText.slice(0, 65000);
          fetchMethod = directStatus >= 400 ? "rendered-reader-fallback" : "spa-rendered-reader";
        }
      }
    } catch (fallbackErr: any) {
      console.warn(`Reader fallback error for ${targetUrl}:`, fallbackErr?.message || fallbackErr);
    }
  }

  return {
    url: finalUrl,
    requestedUrl: targetUrl,
    ok: Boolean(readableText) || contentType.includes("application/pdf"),
    fetchMethod,
    contentType,
    title,
    description,
    headings,
    links,
    jsonLdBlocks,
    readableText,
    rawHtml,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/read-url", async (req, res) => {
  try {
    const rawList: string[] = Array.isArray(req.body?.urls)
      ? req.body.urls
      : req.body?.url
      ? [String(req.body.url)]
      : [];

    const uniqueUrls = Array.from(new Set(rawList.map((u) => String(u).trim()).filter(Boolean))).slice(0, 5);
    if (uniqueUrls.length === 0) {
      return res.status(400).json({ error: "No valid URLs provided." });
    }

    const results = await Promise.all(
      uniqueUrls.map(async (u) => {
        try {
          return await readSingleExternalUrl(u);
        } catch (err: any) {
          return {
            url: u,
            requestedUrl: u,
            ok: false,
            error: err?.message || "Failed to read URL",
            readableText: "",
            headings: [],
            links: [],
            jsonLdBlocks: [],
            rawHtml: "",
          };
        }
      })
    );

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to process URLs." });
  }
});

app.post("/api/gemini/stream", async (req, res) => {
  const ai = getAiClient();
  let currentModel = normalizeTextModel(req.body.model);
  const maxRetries = 4;
  let lastError: any = null;
  let stripTools = false;

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  for (let i = 0; i < maxRetries; i++) {
    try {
      const requestConfig = buildSafeConfig(req.body, currentModel, stripTools);
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
      const isToolError =
        msg.includes("URLCONTEXT") ||
        msg.includes("URL_CONTEXT") ||
        msg.includes("TOOL") && msg.includes("400");

      if (isToolError && !stripTools && i < maxRetries - 1) {
        stripTools = true;
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }

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
  const maxRetries = 4;
  let lastError: any = null;
  let stripTools = false;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const requestConfig = buildSafeConfig(req.body, currentModel, stripTools);
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
      const isToolError =
        msg.includes("URLCONTEXT") ||
        msg.includes("URL_CONTEXT") ||
        msg.includes("TOOL") && msg.includes("400");

      if (isToolError && !stripTools && i < maxRetries - 1) {
        stripTools = true;
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }

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
  const { prompt, aspectRatio = "1:1", base64Image, mimeType } = req.body;
  try {
    const parts: any[] = [];
    if (base64Image) {
      parts.push({
        inlineData: {
          data: String(base64Image),
          mimeType: String(mimeType || "image/png"),
        },
      });
    }
    parts.push({
      text: base64Image
        ? `Edit or transform this reference image as instructed: ${prompt}`
        : `Generate a crisp, studio-quality visual: ${prompt}`,
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: [{ parts }],
      config: {
        imageConfig: { aspectRatio },
      },
    });
    const respParts = response.candidates?.[0]?.content?.parts;
    const imgPart = respParts?.find((p: any) => p.inlineData?.data);
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
    const parsedUrl = await validateExternalUrl(url);
    const response = await fetchWithTimeout(parsedUrl.toString(), {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch: ${response.statusText}` });
    }
    if (response.url) {
      await validateExternalUrl(response.url);
    }
    const text = await response.text();
    res.send(text);
  } catch (error: any) {
    const status = error?.message?.includes("not permitted") ? 403 : 500;
    res.status(status).json({ error: error.message || "Proxy fetch failed" });
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
