import re

with open('src/lib/gemini.ts', 'r') as f:
    content = f.read()

replacement_stream = r"""        config: {
          system_instruction: config.systemInstruction || config.config?.systemInstruction,
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
          ],
          maxOutputTokens: 8192,
          ...config.generationConfig"""

content = re.sub(r'        config: \{\s*system_instruction: config\.systemInstruction \|\| config\.config\?\.systemInstruction,\s*safetySettings: \[\s*\{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" \},\s*\{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" \},\s*\{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" \},\s*\{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" \}\s*\],\s*\.\.\.config\.generationConfig', replacement_stream, content)

with open('src/lib/gemini.ts', 'w') as f:
    f.write(content)
