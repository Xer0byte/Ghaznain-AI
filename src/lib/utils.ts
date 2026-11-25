import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export interface WebUrlReadResult {
  url: string;
  requestedUrl?: string;
  ok: boolean;
  fetchMethod?: string;
  contentType?: string;
  title?: string;
  description?: string;
  headings?: string[];
  links?: string[];
  jsonLdBlocks?: string[];
  readableText?: string;
  rawHtml?: string;
  error?: string;
}

const cleanExtractedUrl = (raw: string): string => {
  let cleaned = raw.trim().replace(/[.,;:!?)\]}"'>]+$/g, '');
  if (!/^https?:\/\//i.test(cleaned) && /^www\./i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
};

export const extractUrlsFromText = (text: string, maxUrls: number = 5): string[] => {
  if (!text) return [];
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
  const matches = text.match(urlRegex) || [];
  const seen = new Set<string>();
  const results: string[] = [];

  for (const raw of matches) {
    const cleaned = cleanExtractedUrl(raw);
    try {
      const parsed = new URL(cleaned);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !seen.has(parsed.href)) {
        seen.add(parsed.href);
        results.push(parsed.href);
        if (results.length >= maxUrls) break;
      }
    } catch {
      // Skip malformed URL-like tokens
    }
  }
  return results;
};

export const extractUrlFromText = (text: string): string | null => {
  const urls = extractUrlsFromText(text, 1);
  return urls.length > 0 ? urls[0] : null;
};

export const isWebsiteCloneIntent = (text: string): boolean => {
  if (!text) return false;
  return /\b(clone|replicate|copy\s+(this\s+)?(site|website|page|ui|design|layout)|pixel[- ]perfect|rebuild\s+(this\s+)?(site|website|page)|same\s+(website|design|layout))\b/i.test(text);
};

export const fetchWebUrlsData = async (urls: string[]): Promise<WebUrlReadResult[]> => {
  const cleanUrls = urls.slice(0, 5);
  if (cleanUrls.length === 0) return [];

  try {
    const response = await fetch('/api/read-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: cleanUrls }),
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.results)) {
        return data.results;
      }
    }
  } catch (err) {
    console.warn('/api/read-url request failed, falling back to /api/proxy:', err);
  }

  // Per-URL fallback via /api/proxy if /api/read-url failed
  const fallbackResults = await Promise.all(
    cleanUrls.map(async (url): Promise<WebUrlReadResult> => {
      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const text = await res.text();
          return {
            url,
            requestedUrl: url,
            ok: Boolean(text),
            fetchMethod: 'proxy-fallback',
            readableText: text.slice(0, 60000),
            rawHtml: text.slice(0, 45000),
          };
        }
      } catch {
        // Ignore
      }
      return {
        url,
        requestedUrl: url,
        ok: false,
        error: 'Could not directly fetch URL; relying on AI URL Context.',
        readableText: '',
      };
    })
  );

  return fallbackResults;
};

export const fetchWebsiteLinkContent = async (url: string): Promise<string | null> => {
  const results = await fetchWebUrlsData([url]);
  const first = results[0];
  if (!first || !first.ok) return null;
  return first.rawHtml || first.readableText || null;
};

export const formatWebUrlsForPrompt = (
  results: WebUrlReadResult[],
  options: { includeRawHtml?: boolean; cloneMode?: boolean } = {}
): string => {
  if (!results || results.length === 0) return '';

  const formattedSections = results.map((res, idx) => {
    const header = `--- WEB SOURCE #${idx + 1}: ${res.url} ---`;
    if (!res.ok && !res.readableText) {
      return `${header}\nStatus: Direct server fetch unavailable (${res.error || 'blocked or unreachable'}). Use the Google URL Context tool to read ${res.url} directly.`;
    }

    const parts: string[] = [header];
    if (res.title) parts.push(`Title: ${res.title}`);
    if (res.description) parts.push(`Meta Description: ${res.description}`);
    if (res.contentType) parts.push(`Content-Type: ${res.contentType}`);
    if (res.fetchMethod) parts.push(`Extraction Mode: ${res.fetchMethod}`);

    if (res.headings && res.headings.length > 0) {
      parts.push(`\nKey Headings:\n${res.headings.slice(0, 25).join('\n')}`);
    }
    if (res.jsonLdBlocks && res.jsonLdBlocks.length > 0) {
      parts.push(`\nStructured Data (JSON-LD):\n${res.jsonLdBlocks.slice(0, 3).join('\n---\n')}`);
    }
    if (res.readableText) {
      parts.push(`\nExtracted Page Content:\n${truncateText(res.readableText, 45000)}`);
    }
    if (res.links && res.links.length > 0) {
      parts.push(`\nNotable Links Found:\n${res.links.slice(0, 25).join('\n')}`);
    }
    if (options.includeRawHtml && res.rawHtml) {
      parts.push(`\nHTML Source Snapshot:\n${truncateText(res.rawHtml, 45000)}`);
    }
    return parts.join('\n');
  });

  if (options.cloneMode) {
    return `\n\n[WEBSITE REFERENCE DATA FETCHED FOR CLONING/REPLICATION]\nUse the fetched HTML structure, copy, styles, and layout below to build an accurate replica without omitting sections:\n\n${formattedSections.join('\n\n')}`;
  }

  return `\n\n[LIVE WEB PAGE DATA EXTRACTED FROM USER LINK(S)]\nUse the factual data below to answer the user's request accurately (summarize, analyze, extract structured fields, audit, or reference exact details as requested). Do NOT assume the user wants to clone the HTML unless they explicitly ask for code/cloning.\n\n${formattedSections.join('\n\n')}`;
};


export const copyToClipboard = async (text: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API failed, trying fallback', err);
  }

  // Fallback to textarea
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed', err);
    return false;
  }
};

/**
 * Generates an Excel file from JSON data and triggers download.
 */
export const downloadExcelFile = (filename: string, data: any[]) => {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
    return true;
  } catch (error) {
    console.error("Excel generation error:", error);
    return false;
  }
};

/**
 * Generates a Word (.docx) file from text content and triggers download.
 */
export const downloadWordFile = async (filename: string, fullText: string) => {
  try {
    // Split text into paragraphs
    const lines = fullText.split('\n');
    const sections = lines.map(line => new Paragraph({
      children: [new TextRun(line)],
      spacing: { after: 200 }
    }));

    const doc = new Document({
      sections: [{
        properties: {},
        children: sections,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Word generation error:", error);
    return false;
  }
};

/**
 * Generates a simple text file and triggers download.
 */
export const downloadTextFile = (filename: string, content: string) => {
  try {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Text file generation error:", error);
    return false;
  }
};

let unrarWasmBinary: ArrayBuffer | null = null;

export const getUnrarExtractor = async (data: ArrayBuffer) => {
  const { createExtractorFromData } = await import('node-unrar-js');
  
  if (!unrarWasmBinary) {
    try {
      // In Vite, we can try to fetch it from the node_modules location or a CDN
      // CDN is more reliable in some environments if local resolve fails
      const response = await fetch('https://unpkg.com/node-unrar-js@2.0.2/esm/js/unrar.wasm');
      unrarWasmBinary = await response.arrayBuffer();
    } catch (err) {
      console.error('Failed to fetch unrar.wasm from CDN', err);
      // Fallback or rethrow
      throw err;
    }
  }

  return createExtractorFromData({ 
    data: new Uint8Array(data), 
    wasmBinary: unrarWasmBinary 
  });
};

/**
 * Truncate text to a maximum number of characters.
 * Useful for preventing token limit exceeded errors.
 */
/**
 * Extracts multiple code blocks with associated filenames from markdown text.
 * Expects a format like: [FILE: path/to/file.ext] followed by a code block.
 */
export const extractFilesFromMarkdown = (text: string): { path: string; content: string }[] => {
  const files: { path: string; content: string }[] = [];
  
  // Format: [FILE: filename.ext] \n ```lang \n content \n ```
  const regex = /\[FILE:\s*([a-zA-Z0-9._\-/ ]+)\]\s*[\r\n]*```[a-z0-9#\-\+]*\n([\s\S]*?)```/gi;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2].trim()
    });
  }
  
  return files;
};

/**
 * Creates a ZIP file from multiple files and triggers a download.
 */
export const downloadProjectAsZip = async (projectName: string, files: { path: string; content: string }[], JSZip: any) => {
  if (files.length === 0) return;
  
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Robust token estimation for Gemini.
 * Gemini typically uses ~4 characters per token for English text.
 * Images/PDFs are more expensive.
 */
export const estimateTokens = (contents: any[]): number => {
  let count = 0;
  contents.forEach(c => {
    if (c.parts) {
      c.parts.forEach((p: any) => {
        if (p.text) count += Math.ceil(p.text.length / 4);
        if (p.inlineData?.data) {
          const mime = p.inlineData.mimeType || "";
          if (mime.startsWith('image/')) {
            // Images are roughly 258 tokens each in Gemini 1.5
            count += 258;
          } else if (mime === 'application/pdf') {
            // PDFs are roughly 1000 tokens per page, or based on text
            // Hard to know pages from base64, but let's use a fairer estimate
            count += Math.ceil(p.inlineData.data.length / 8); 
          } else {
            // Text files or other data
            count += Math.ceil(p.inlineData.data.length / 4);
          }
        }
      });
    }
  });
  return count;
};

/**
 * Truncates and cleans history to stay within context limits while preserving intelligence.
 * We want to keep more history but prune very old messages or very large past code blocks.
 */
export const prepareCleanHistory = (messages: any[], maxHistory: number = 200, maxTokensTotal: number = 2000000) => {
  // Take last N messages
  const recentMessages = messages.slice(-maxHistory);
  const history = [];
  
  // We process from newest to oldest to preserve context, but we will return it in correct order
  let currentEstimatedTokens = 0;
  
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    let text = msg.text || "";
    
    // No truncation. The user requested complete, unlimited text and code.
    const tokens = Math.ceil(text.length / 4);
    if (currentEstimatedTokens + tokens > maxTokensTotal) {
      break; // Stop adding older messages if we're near the limit
    }
    
    currentEstimatedTokens += tokens;
    
    const parts: any[] = [{ text }];

    // PRESERVE RECENT FILES: If the message had files and it's within the last 4 messages, preserve them
    if (msg.role === 'user' && i >= recentMessages.length - 4 && msg.files && msg.files.length > 0) {
      msg.files.forEach((file: any) => {
        if (file.data) {
          const fileData = file.data.includes(',') ? file.data.split(',')[1] : file.data;
          const MAX_HISTORY_FILE_BYTES = 100 * 1024 * 1024;
          if (fileData.length < MAX_HISTORY_FILE_BYTES) {
            parts.push({
              inlineData: {
                data: fileData,
                mimeType: getGeminiCompatibleMimeType(file.mimeType)
              }
            });
            currentEstimatedTokens += Math.ceil(fileData.length / 4);
          }
        }
      });
    }

    history.unshift({
      role: msg.role === 'user' ? 'user' : 'model',
      parts
    });
  }

  return history;
};


export const truncateText = (text: string, maxChars: number): string => {
  if (!text || text.length <= maxChars) return text;
  return text.substring(0, maxChars) + "\n\n[... content truncated due to size limits ...]";
};

/**
 * Maps common but unsupported MIME types to supported ones for the Gemini API.
 * Specifically handles cases like application/xml which Gemini rejects.
 */
export const getGeminiCompatibleMimeType = (mimeType: string): string => {
  // Gemini 1.5 Flash/Pro supported media types for inlineData
  const supportedMedia = [
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp',
    'audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac',
    'text/plain', 'text/html', 'text/css', 'text/javascript', 'application/x-javascript', 'text/vtt', 'text/x-typescript', 'application/typescript'
  ];
  
  if (supportedMedia.includes(mimeType)) return mimeType;
  
  // Broad fallback for text-based types Gemini might be picky about
  if (
    mimeType.startsWith('text/') || 
    mimeType.includes('xml') || 
    mimeType.includes('json') || 
    mimeType.includes('javascript') || 
    mimeType.includes('typescript') ||
    mimeType.includes('markdown') ||
    mimeType.includes('yaml') ||
    mimeType.includes('csv')
  ) {
    return 'text/plain';
  }

  // Common programming languages and config formats
  const commonExtensions = ['.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.php', '.rb', '.sh', '.sql', '.ini', '.env', '.sln', '.csproj', '.ts', '.tsx', '.jsx', '.css', '.scss', '.less', '.html', '.xml', '.json', '.yaml', '.yml', '.md', '.txt', '.log'];
  if (commonExtensions.some(ext => mimeType.includes(ext))) {
    return 'text/plain';
  }

  // Default to text/plain if we can't be sure, as it's the safest non-media type
  return 'text/plain';
};

/**
 * Checks if a buffer represents a text file by looking for null bytes in the first 8KB.
 */
export const isTextFile = (buffer: ArrayBuffer): boolean => {
  const uint8 = new Uint8Array(buffer.slice(0, 8192));
  for (let i = 0; i < uint8.length; i++) {
    if (uint8[i] === 0) return false;
  }
  return true;
};
