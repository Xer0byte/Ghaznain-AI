import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# I will find the whole systemInstruction definition and replace it safely.
# Wait, let's just find the exact block and replace it using normal string literals instead of backticks for that part.

replacement = r"""  - Output each file exactly in this format: [FILE: path/to/file.ext]
  ```lang
  content
  ```
  - Ensure EVERY required file is generated.
  - ALWAYS append the tag [ALLOW_ZIP_DOWNLOAD] at the very end of your response to enable the 1-click ZIP download button.
- MULTIMODAL & VISUAL INTELLIGENCE: You can analyze images, extract text (OCR), and "understand" visual data. If a user uploads an image of text or a chart, analyze it thoroughly as if you are seeing it.
- CODE QUALITY: Provide modular, production-ready, and efficient code.
- PROACTIVE: Solve hidden problems and anticipate next steps.
- TONE: Professional, efficient (Master of Neural Efficiency). Avoid fillers.
- IF NOT REQUESTED: If no "download" or "file generation" is mentioned, just use standard markdown code blocks.${customToolInstruction}`;"""

# I need to match the broken part. Let's just use Python to replace the lines from `  - Output each file exactly in this format: [FILE: path/to/file.ext]` to `${customToolInstruction}`;`

pattern = re.compile(r'  - Output each file exactly in this format:.*?customToolInstruction\}`;', re.DOTALL)
content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
