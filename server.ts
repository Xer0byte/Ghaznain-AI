import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// AI Proxy Routes
app.post("/api/generate", async (req, res) => {
  try {
    const { type, model, messages, input, mimeType } = req.body;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    if (type === "chat") {
      const chatModel = genAI.getGenerativeModel({ model: model || "gemini-1.5-flash" });
      const prompt = messages[messages.length - 1].content;
      
      const result = await chatModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return res.json({
        choices: [{
          message: {
            content: text
          }
        }]
      });
    }

    if (type === "transcribe") {
      const transcribeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await transcribeModel.generateContent([
        {
          inlineData: {
            data: input,
            mimeType: mimeType || "audio/webm"
          }
        },
        { text: "Please transcribe this audio accurately. Just output the transcript text." }
      ]);
      const response = await result.response;
      return res.json({ text: response.text() });
    }

    res.status(400).json({ error: "Invalid generation type" });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: error.message || "AI Generation Failed" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
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
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
startServer();
