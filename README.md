# 🧠 Neural X: The Infinite AI (Xer0byte AI)

> **High-Velocity Neural IDE with Live Sandbox, Bespoke Media Generation, and Multi-Model Intelligence.** Built for professionals who demand perfect execution, neural speed, and seamless full-stack previews.

---

## 🚀 Key Visual & Functional Architecture

Neural X (Xer0byte AI) is a fully-integrated full-stack workspace designed to unify standard conversational AI with precise technical tools. It features four primary active modes that can be selected directly within the main model console or the global tools selector:

### 🧩 1. Neural Sandbox IDE & Coder
- **Real-Time Code Execution:** Run HTML, CSS, JavaScript, and complete full-stack components inline with automatic visual canvas renders.
- **Workspace Inspector:** Complete view of working files, code highlightings, and contextual workspace uploads.
- **Interactive Multi-File Workspace:** Seamlessly create, edit, and orchestrate software projects within a live sandboxed safe-run environment.

### 🎨 2. 4K Creative Image Synthesis
- **Active Mode Lock:** When selected, prompts are interpreted as detailed description vectors for image synthesis.
- **High-Fidelity AI Generation:** Instantly outputs ultra-sharp visuals utilizing state-of-the-art synthetic pipelines with pollinations fail-over safety.

### 🎵 3. Orchestral Music Composer
- **Bespoke Soundtrack Generation:** Describe background tempos, orchestral moods, or modern electronic tracks and compile playable audio files instantly inside the conversation thread.

### 📚 4. Active Guided Learning Sector
- **Interactive Socratic Tutor:** Locks the model into a structured educational persona.
- **Adaptive Question Checkpoints:** Tests your understanding on any topic step-by-step, asking highly focused questions one-by-one to safely build real skills.

---

## 🛠️ Unified Intelligence Models

Toggle seamlessly between standard models built on top of the ultra-modern `@google/genai` platform integrations:
- **Fast Mode:** Accelerated low-latency responses for quick logical checks.
- **Thinking Mode:** Enhanced logical reasoning chains for deep debugging, architectural analyses, and complex algorithms.
- **Pro Mode:** Maximum analytical depth powered by modern premium models for highly detailed system integrations.

---

## 📦 Setting Up Locally

To run this full-stack workspace locally, complete the following simple setup steps:

### 🧰 Prerequisites
Ensure you have **Node.js** (v18 or higher) and **npm** installed on your system.

### 📥 1. Clone the Workspace & Install Dependencies
```bash
# Install the exact required package dependencies
npm install
```

### 🔑 2. Configure Environment Variables
Create a `.env` file in the root directory (using `.env.example` as a template):
```env
# Secure Gemini secret key (Required)
GEMINI_API_KEY=your_actual_gemini_api_key_here

# App URL for self-referenced redirects & callback routing
APP_URL=http://localhost:3000

# Optional configuration settings
JWT_SECRET=your-custom-jwt-secret-signing-key
```

### ⚡ 3. Launch Development Workspace
The workspace uses a full-stack dual server configuration (Express + Vite middlewares) to serve the API route layers and compile frontend assets on-the-fly:
```bash
npm run dev
```
Open your browser and navigate to **`http://localhost:3000`** to interact with the environment.

---

## 🧱 The Technical Core

- **Frontend:** React 18, Vite 6, Tailwind CSS (Utility classes inside a unified single global config), Motion for fluid state transitions.
- **UI Icons:** Consolidated package-scoped imports from `lucide-react`.
- **Backend:** Express Server (hosting REST API endpoints, secure Gemini payload proxifiers) with lazy SDK initialization patterns to avoid startup crashes if secrets are pending configuration.
- **Compilation Toolchain:** Native TypeScript stripping (tsx) in dev, robust ESBuild bundling in production to produce optimized single-file deployment modules.
- **Platform Shims:** Native environment shims to load target platform DOMExceptions cleanly without deprecated warning markers.

---
<div align="center">
  <sub>Neural X: The Infinite AI Workspace • Created with AI Studio Build</sub>
</div>
