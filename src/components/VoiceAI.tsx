import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, MicOff, Volume2, VolumeX, Loader2, Sparkles, AlertCircle, Languages, RotateCcw, Trash2, User, Users } from 'lucide-react';
import { generateContentWithRetry } from '../lib/gemini';

interface VoiceAIProps {
  theme: 'dark' | 'light';
  onClose: () => void;
  token?: string | null;
  isPrivate?: boolean;
  onError?: (msg: string) => void;
}

type VoiceMode = 'assistant' | 'interpreter';
type ActiveSpeaker = 'auto' | 'me' | 'partner';

interface VoiceMessage {
  id: string;
  role: 'user' | 'ai' | 'me' | 'partner';
  originalText: string;
  translatedText?: string;
  detectedLang?: string;
  timestamp: number;
}

const VoiceAI: React.FC<VoiceAIProps> = ({ theme, onClose, onError }) => {
  const [mode, setMode] = useState<VoiceMode>('assistant');
  const [activeSpeaker, setActiveSpeaker] = useState<ActiveSpeaker>('auto');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSpokenText, setLastSpokenText] = useState<string>('');

  const isProcessingRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<VoiceMode>('assistant');
  const activeSpeakerRef = useRef<ActiveSpeaker>('auto');
  const isMutedRef = useRef(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    activeSpeakerRef.current = activeSpeaker;
  }, [activeSpeaker]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, transcript]);

  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text: string) => {
    if (isMutedRef.current) return;
    window.speechSynthesis.cancel();
    setLastSpokenText(text);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1;
    utterance.rate = 1.0; 
    utterance.pitch = 1;

    const isUrduOrHindi = /[\u0600-\u06FF]/.test(text);
    const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
    
    let preferredVoice: SpeechSynthesisVoice | undefined;
    if (isUrduOrHindi) {
      preferredVoice = voices.find(v => v.lang.startsWith('ur') || v.lang.startsWith('hi'));
    }
    if (!preferredVoice) {
      preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Female'))) || voices[0];
    }
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => {
      setStatus('idle');
      setIsListening(false);
      setIsProcessing(false);
      isProcessingRef.current = false;
    };
    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error:", e);
      setStatus('idle');
      setIsListening(false);
      setIsProcessing(false);
      isProcessingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  };

  const replayLast = () => {
    if (lastSpokenText) {
      speak(lastSpokenText);
    }
  };

  const clearConversation = () => {
    window.speechSynthesis.cancel();
    setMessages([]);
    setTranscript('');
    setError(null);
    setStatus('idle');
    setLastSpokenText('');
  };

  const toggleListening = async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      setIsListening(false);
      setStatus('idle');
    } else {
      window.speechSynthesis.cancel();
      setTranscript('');
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.minDecibels = -60;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        let silenceStart = Date.now();
        let isSpeaking = false; 
        let hasSpoken = false;
        let animationFrameId: number;

        const detectSilence = () => {
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const average = sum / dataArray.length;

          if (average > 45) {
            isSpeaking = true;
            hasSpoken = true;
            silenceStart = Date.now();
          } else {
            if (!isSpeaking && Date.now() - silenceStart > 6000) { 
              if (mediaRecorder.state === "recording") { mediaRecorder.stop(); } 
              return; 
            }
            if (isSpeaking && Date.now() - silenceStart > 1400) {
              if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
              }
              return;
            }
          }
          if (mediaRecorder.state === "recording") {
            animationFrameId = requestAnimationFrame(detectSilence);
          }
        };

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          cancelAnimationFrame(animationFrameId);
          if (audioContext.state !== "closed") audioContext.close();
          if (!hasSpoken) { 
            setIsListening(false); 
            setStatus("idle"); 
            return; 
          }
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            setStatus('thinking');
            try {
              if (modeRef.current === 'interpreter') {
                const speakerHint = activeSpeakerRef.current === 'me' 
                  ? "Speaker is expected to speak Urdu or Roman Urdu. Translate to natural conversational English."
                  : activeSpeakerRef.current === 'partner'
                  ? "Speaker is expected to speak English. Translate to natural conversational Pakistani Urdu (both in Urdu script and Roman Urdu)."
                  : "Auto-detect language. If Urdu or Roman Urdu, translate to natural English. If English, translate to natural Urdu.";

                const interpreterInstruction = `# Role:
You are a professional Real-Time Two-Way Voice Interpreter (Urdu ⇄ English).

# Guidance:
${speakerHint}

# Operational Format (STRICT JSON):
1. If no clear human speech is found, return exactly: [NO_SPEECH]
2. Otherwise, return exactly in this JSON format:
{
  "speaker": "me" | "partner",
  "detectedLanguage": "Urdu" | "Roman Urdu" | "English",
  "originalTranscript": "what was said",
  "translation": "natural, fluent, contextual translation preserving tone, slang, informal speech, and Pakistani nuance",
  "spokenText": "the concise translation text to be spoken aloud via TTS"
}`;

                const response = await generateContentWithRetry({
                  model: "gemini-3.8-flash",
                  systemInstruction: interpreterInstruction,
                  contents: [
                    {
                      role: "user",
                      parts: [
                        { inlineData: { data: base64Audio, mimeType: "audio/webm" } },
                        { text: "Interpret this audio." }
                      ]
                    }
                  ]
                });

                const rawText = response.text?.trim() || "";
                if (rawText.includes("[NO_SPEECH]") || rawText === "") {
                  setIsListening(false);
                  setStatus("idle");
                  return;
                }

                try {
                  const cleanedJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
                  const data = JSON.parse(cleanedJson);

                  const role = data.speaker === 'me' ? 'me' : 'partner';
                  const newMsg: VoiceMessage = {
                    id: Date.now().toString(),
                    role: role,
                    originalText: data.originalTranscript || "Audio",
                    translatedText: data.translation || "",
                    detectedLang: data.detectedLanguage || "Detected",
                    timestamp: Date.now()
                  };

                  setMessages(prev => [...prev, newMsg]);
                  const toSpeak = (data.spokenText || data.translation || "").replace(/[*#_`~]/g, "");
                  if (toSpeak) {
                    speak(toSpeak);
                  }
                } catch {
                  const cleanText = rawText.replace(/[*#_`~]/g, "");
                  setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: activeSpeakerRef.current === 'me' ? 'me' : 'partner',
                    originalText: cleanText,
                    translatedText: cleanText,
                    timestamp: Date.now()
                  }]);
                  speak(cleanText);
                }
              } else {
                const personaInstruction = `# Role: 
You are "Xer0byte Voice Pro," a highly advanced, real-time conversational AI assistant.
Respond in the exact same language the user speaks (English, Roman Urdu, or Urdu). Keep responses concise, natural, and conversational.
NO MARKDOWN (no asterisks, bullet points, headers). Format:
TRANSCRIPT: (what user said)
RESPONSE: (your response)`;

                const response = await generateContentWithRetry({
                  model: "gemini-3.8-flash",
                  systemInstruction: personaInstruction,
                  contents: [
                    ...messages.map(m => ({ 
                      role: m.role === 'user' ? 'user' : 'model', 
                      parts: [{ text: m.originalText }] 
                    } as any)),
                    {
                      role: "user",
                      parts: [
                        { inlineData: { data: base64Audio, mimeType: "audio/webm" } },
                        { text: "Audio input." }
                      ]
                    }
                  ]
                });

                const fullText = response.text?.trim() || "";
                if (fullText.includes("[NO_SPEECH]") || fullText === "") {
                  setIsListening(false);
                  setStatus("idle");
                  return;
                }
                
                let recognizedText = "(Audio)";
                let aiResponse = fullText;
                
                const transMatch = fullText.match(/TRANSCRIPT:\s*(.*)\nRESPONSE:\s*([\s\S]*)/i);
                if (transMatch) {
                  recognizedText = transMatch[1].trim();
                  aiResponse = transMatch[2].trim();
                }
                
                const cleanResponse = aiResponse.replace(/[*#_`~]/g, "");
                setMessages(prev => [
                  ...prev, 
                  { id: (Date.now() - 1).toString(), role: 'user', originalText: recognizedText, timestamp: Date.now() },
                  { id: Date.now().toString(), role: 'ai', originalText: cleanResponse, timestamp: Date.now() }
                ]);
                speak(cleanResponse);
              }
            } catch (error) {
              console.error("Transcription error:", error);
              setError("Audio processing busy. Please try again.");
              setStatus('idle');
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        detectSilence();
        setIsListening(true);
        setStatus('listening');
      } catch (err) {
        console.error("Failed to start recognition:", err);
        setError("Microphone access denied. Please check device permissions.");
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-6 backdrop-blur-3xl ${theme === 'dark' ? 'bg-black/95 text-white' : 'bg-white/95 text-black'}`}
    >
      {/* Top Bar Header */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        {/* Mode Switcher Pill */}
        <div className={`flex items-center gap-1 p-1 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
          <button
            onClick={() => setMode('assistant')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              mode === 'assistant' 
                ? 'bg-[#00ff9d] text-black shadow-md' 
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <Sparkles size={14} />
            <span>Voice Assistant</span>
          </button>
          <button
            onClick={() => setMode('interpreter')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              mode === 'interpreter' 
                ? 'bg-[#00ff9d] text-black shadow-md' 
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <Languages size={14} />
            <span>Interpreter (Urdu ⇄ English)</span>
          </button>
        </div>

        {/* Action Controls (Mute, Clear, Close) */}
        <div className="flex items-center gap-2">
          {lastSpokenText && (
            <button
              onClick={replayLast}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition-all ${theme === 'dark' ? 'border-white/10 hover:bg-white/10 text-white' : 'border-black/10 hover:bg-black/10 text-black'}`}
              title="Replay last speech"
            >
              <RotateCcw size={16} />
            </button>
          )}

          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition-all ${
              isMuted 
                ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                : (theme === 'dark' ? 'border-white/10 hover:bg-white/10 text-white' : 'border-black/10 hover:bg-black/10 text-black')
            }`}
            title={isMuted ? "Unmute Voice" : "Mute Voice"}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition-all ${theme === 'dark' ? 'border-white/10 hover:bg-white/10 text-red-400' : 'border-black/10 hover:bg-black/10 text-red-600'}`}
              title="Clear conversation"
            >
              <Trash2 size={16} />
            </button>
          )}

          <button 
            onClick={onClose}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition-all ${theme === 'dark' ? 'border-white/10 hover:bg-white/10 text-white' : 'border-black/10 hover:bg-black/10 text-black'}`}
            title="Close Voice Mode"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Speaker Selector in Interpreter Mode */}
      {mode === 'interpreter' && (
        <div className="w-full max-w-md my-2 flex items-center justify-center gap-2">
          <button
            onClick={() => setActiveSpeaker('auto')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              activeSpeaker === 'auto'
                ? 'bg-blue-500 text-white border-blue-400 shadow-sm'
                : (theme === 'dark' ? 'border-white/10 text-white/70 hover:bg-white/5' : 'border-black/10 text-black/70 hover:bg-black/5')
            }`}
          >
            Auto Detect
          </button>
          <button
            onClick={() => setActiveSpeaker('me')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              activeSpeaker === 'me'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : (theme === 'dark' ? 'border-white/10 text-white/70 hover:bg-white/5' : 'border-black/10 text-black/70 hover:bg-black/5')
            }`}
          >
            <User size={12} />
            <span>My Speech (Urdu)</span>
          </button>
          <button
            onClick={() => setActiveSpeaker('partner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              activeSpeaker === 'partner'
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                : (theme === 'dark' ? 'border-white/10 text-white/70 hover:bg-white/5' : 'border-black/10 text-black/70 hover:bg-black/5')
            }`}
          >
            <Users size={12} />
            <span>Other Person (English)</span>
          </button>
        </div>
      )}

      {/* Live Status Header */}
      <div className="text-center my-2">
        <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          {mode === 'interpreter' ? "Urdu ⇄ English Live Interpreter" : "Xer0byte Voice Pro"}
        </h2>
        <p className={`text-sm sm:text-base font-medium mt-1 ${theme === 'dark' ? 'text-blue-200/70' : 'text-blue-900/70'}`}>
          {error ? (
            <span className="text-red-500 flex items-center justify-center gap-1.5"><AlertCircle size={16} /> {error}</span>
          ) : (
            status === 'idle' ? (mode === 'interpreter' ? "Tap microphone to speak in Urdu or English" : "Tap microphone to start conversation") :
            status === 'listening' ? "Listening to your voice..." :
            status === 'thinking' ? "Processing speech..." :
            "Speaking output..."
          )}
        </p>
      </div>

      {/* Conversation / Transcripts Container */}
      <div className={`w-full max-w-3xl flex-1 my-2 overflow-y-auto flex flex-col p-4 sm:p-5 rounded-2xl border transition-all scrollbar-hide ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
        {messages.map((m) => {
          if (mode === 'interpreter') {
            const isMe = m.role === 'me';
            return (
              <div 
                key={m.id} 
                className={`mb-3 w-fit max-w-[85%] p-3.5 rounded-2xl ${
                  isMe 
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 self-end rounded-br-sm' 
                    : 'bg-purple-500/15 border border-purple-500/30 text-purple-300 self-start rounded-bl-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-[11px] uppercase font-bold tracking-wider opacity-70">
                  <span>{isMe ? 'My Speech' : 'Other Person'}</span>
                  {m.detectedLang && <span>• {m.detectedLang}</span>}
                </div>
                <p className="text-sm opacity-80 mb-1">{m.originalText}</p>
                {m.translatedText && (
                  <p className="text-base font-semibold leading-relaxed border-t border-white/10 pt-1.5 mt-1 text-white">
                    {m.translatedText}
                  </p>
                )}
              </div>
            );
          }

          return (
            <div 
              key={m.id} 
              className={`mb-3 w-fit max-w-[80%] p-3.5 rounded-2xl ${
                m.role === 'user' 
                  ? 'bg-[#00ff9d]/20 text-[#00ff9d] self-end rounded-br-sm' 
                  : (theme === 'dark' ? 'bg-white/10 text-white self-start rounded-bl-sm' : 'bg-black/10 text-black self-start rounded-bl-sm')
              }`}
            >
              <p className="text-base leading-relaxed">{m.originalText}</p>
            </div>
          );
        })}

        {transcript && (
          <div className="mb-3 w-fit max-w-[80%] p-3.5 rounded-2xl bg-[#00ff9d]/10 text-[#00ff9d] self-end rounded-br-sm border border-[#00ff9d]/30 animate-pulse">
            <p className="text-base leading-relaxed">{transcript}</p>
          </div>
        )}

        {!transcript && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <Sparkles className={`mb-3 ${theme === 'dark' ? 'text-white/20' : 'text-black/20'}`} size={36} />
            <p className={`text-base font-medium opacity-50 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              {mode === 'interpreter' 
                ? 'Speak in Urdu (will translate to English) or English (will translate to Urdu)' 
                : 'Start speaking to converse with Xer0byte AI...'}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Main Mic Button Section */}
      <div className="relative flex flex-col items-center justify-center my-2">
        <AnimatePresence>
          {isListening && (
            <>
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 2, opacity: 0.15 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className={`absolute w-36 h-36 rounded-full ${mode === 'interpreter' ? 'bg-purple-500' : 'bg-[#00ff9d]'}`}
              />
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 2.8, opacity: 0.05 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                className={`absolute w-36 h-36 rounded-full ${mode === 'interpreter' ? 'bg-purple-500' : 'bg-[#00ff9d]'}`}
              />
            </>
          )}
        </AnimatePresence>

        <button 
          onClick={toggleListening}
          disabled={isProcessing}
          className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
            isListening 
              ? (mode === 'interpreter' 
                  ? 'bg-purple-500 text-white scale-110 shadow-[0_0_35px_rgba(168,85,247,0.5)]' 
                  : 'bg-[#00ff9d] text-black scale-110 shadow-[0_0_35px_rgba(0,255,157,0.5)]') 
              : (theme === 'dark' 
                  ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20' 
                  : 'bg-black/5 text-black hover:bg-black/15 border border-black/15')
          }`}
        >
          {isProcessing ? (
            <Loader2 size={32} className="animate-spin" />
          ) : isListening ? (
            <Mic size={32} />
          ) : (
            <MicOff size={32} />
          )}
        </button>
      </div>

      {/* Footer Audio Bar */}
      <div className="flex items-center gap-3 px-5 py-2 rounded-2xl border text-xs opacity-70">
        <Volume2 size={15} />
        <div className={`w-28 h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/15' : 'bg-black/15'}`}>
          <motion.div 
            animate={status === 'speaking' ? { width: ['0%', '100%'] } : { width: '0%' }}
            transition={status === 'speaking' ? { duration: 2.5, repeat: Infinity } : {}}
            className="h-full bg-[#00ff9d]"
          />
        </div>
        <span className="font-mono">{status.toUpperCase()}</span>
      </div>
    </motion.div>
  );
};

export default VoiceAI;
