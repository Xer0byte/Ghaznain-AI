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
export const truncateText = (text: string, maxChars: number): string => {
  if (!text || text.length <= maxChars) return text;
  return text.substring(0, maxChars) + "\n\n[... content truncated due to size limits ...]";
};
