const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');
code = code.replace(/system_instruction: config\.systemInstruction,\n\s*\.\.\.config\.generationConfig/g, `system_instruction: config.systemInstruction || config.config?.systemInstruction,
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
          ],
          ...config.generationConfig,
          ...(config.config || {})`);
fs.writeFileSync('src/lib/gemini.ts', code);
