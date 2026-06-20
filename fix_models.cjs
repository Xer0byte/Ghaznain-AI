const fs = require('fs');
let f1 = fs.readFileSync('src/lib/gemini.ts', 'utf8');
f1 = f1.replace(/gemini-2\.5-flash/g, 'gemini-3.5-flash');
f1 = f1.replace(/gemini-2\.5-pro/g, 'gemini-3.1-pro-preview');
fs.writeFileSync('src/lib/gemini.ts', f1);

let f2 = fs.readFileSync('src/App.tsx', 'utf8');
f2 = f2.replace(/gemini-2\.5-flash/g, 'gemini-3.5-flash');
f2 = f2.replace(/gemini-2\.5-pro/g, 'gemini-3.1-pro-preview');
fs.writeFileSync('src/App.tsx', f2);

let f3 = fs.readFileSync('src/components/VoiceAI.tsx', 'utf8');
f3 = f3.replace(/gemini-2\.5-flash/g, 'gemini-3.5-flash');
fs.writeFileSync('src/components/VoiceAI.tsx', f3);

console.log('Updated models to 3.5');
