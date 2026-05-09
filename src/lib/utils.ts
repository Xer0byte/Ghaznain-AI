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
          // Images and files are billed differently, but for 1.5 Pro/Flash
          // an image usually counts for about 258 tokens (standard) to 1000+ tokens
          // Let's use a conservative estimate for base64 data
          count += Math.ceil(p.inlineData.data.length / 4);
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
export const prepareCleanHistory = (messages: any[], maxHistory: number = 20, maxTokensTotal: number = 800000) => {
  // Take last N messages
  const recentMessages = messages.slice(-maxHistory);
  const history = [];
  
  // We process from newest to oldest to preserve context, but we will return it in correct order
  let currentEstimatedTokens = 0;
  
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    let text = msg.text || "";
    
    // Most recent AI response and most recent user message should be preserved as much as possible
    const isVeryRecent = i >= recentMessages.length - 2;
    
    // Prune very large code blocks from older history to save tokens
    if (!isVeryRecent && msg.role === 'ai' && text.includes('```')) {
      if (text.length > 5000) {
        // Find if there are many code blocks and keep only the first/last parts or replace with summary
        const codeBlockCount = (text.match(/```/g) || []).length / 2;
        if (codeBlockCount > 2) {
           text = text.replace(/```[\s\S]*?```/g, (match, offset, str) => {
             // Keep small snippets, truncate large ones
             if (match.length > 1000) return "```\n// ... existing code truncated for context optimization ...\n```";
             return match;
           });
        }
      }
    }

    // Rough truncation for absolute safety on individual messages if they are monstrous
    if (text.length > 40000) {
      text = truncateText(text, 40000);
    }

    const tokens = Math.ceil(text.length / 4);
    if (currentEstimatedTokens + tokens > maxTokensTotal) {
      break; // Stop adding older messages if we're near the limit
    }
    
    currentEstimatedTokens += tokens;
    history.unshift({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text }]
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
  if (mimeType.startsWith('text/') || mimeType.includes('xml') || mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) {
    return 'text/plain';
  }

  // Default to text/plain if we can't be sure, as it's the safest non-media type
  return 'text/plain';
};
