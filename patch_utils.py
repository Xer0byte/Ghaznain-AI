import re

with open('src/lib/utils.ts', 'r') as f:
    content = f.read()

replacement = r"""export const prepareCleanHistory = (messages: any[], maxHistory: number = 200, maxTokensTotal: number = 2000000) => {
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
};"""

# Use regex to replace the function completely
# From export const prepareCleanHistory to the end of its brace.
import re
pattern = re.compile(r'export const prepareCleanHistory = \(messages: any\[\], maxHistory: number = 20, maxTokensTotal: number = 800000\) => \{[\s\S]*?\n\};\n', re.MULTILINE)
content = pattern.sub(replacement + "\n\n", content)

with open('src/lib/utils.ts', 'w') as f:
    f.write(content)
