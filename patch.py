import re

with open('src/lib/gemini.ts', 'r') as f:
    content = f.read()

replacement = """system_instruction: config.systemInstruction || config.config?.systemInstruction,
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
          ],
          ...config.generationConfig"""

content = re.sub(r'system_instruction:\s*config\.systemInstruction,\s*\.\.\.config\.generationConfig', replacement, content)

with open('src/lib/gemini.ts', 'w') as f:
    f.write(content)
