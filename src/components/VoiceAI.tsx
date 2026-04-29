import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, MicOff, Volume2, VolumeX, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { generateContentWithRetry } from '../lib/gemini';
import { firebaseApiFetch } from '../firebaseAdapter';

interface VoiceAIProps {
  theme: 'dark' | 'light';
  onClose: () => void;
  token?: string | null;
  isPrivate?: boolean;
  onError?: (msg: string) => void;
}

const VoiceAI: React.FC<VoiceAIProps> = ({ theme, onClose, token, isPrivate, onError }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isProcessingRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, transcript]);

  useEffect(() => {
    // Initialize voices
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
         // Use media recorder and Gemini Audio Transcription
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         const mediaRecorder = new MediaRecorder(stream);
         mediaRecorderRef.current = mediaRecorder;
         audioChunksRef.current = [];

         // Silence detection setup
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
         let animationFrameId: number;

         const detectSilence = () => {
             analyser.getByteFrequencyData(dataArray);
             const sum = dataArray.reduce((a, b) => a + b, 0);
             const average = sum / dataArray.length;

             if (average > 10) { // speaking
                 isSpeaking = true;
                 silenceStart = Date.now();
             } else { // silent
                 if (isSpeaking && Date.now() - silenceStart > 1500) {
                     // 1.5 seconds of silence after speaking
                     if (mediaRecorder.state === "recording") {
                         mediaRecorder.stop();
                     }
                     return; // stop loop
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
           audioContext.close();
           const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
           const reader = new FileReader();
           reader.readAsDataURL(audioBlob);
           reader.onloadend = async () => {
             const base64Audio = (reader.result as string).split(',')[1];
             setStatus('thinking');
             try {


               const response = await generateContentWithRetry({
                 model: "gemini-3-flash-preview",
                 contents: [
                   {
                     inlineData: {
                       data: base64Audio,
                       mimeType: "audio/webm"
                     }
                   },
                   { text: "Please transcribe this audio accurately. Just output the transcript text." }
                 ]
               });

               const recognizedText = response.text?.trim() || "";
               
               if (recognizedText) {
                  setMessages(prev => [...prev, {role: 'user', text: recognizedText}]);
                  setTranscript('');
                  handleVoiceCommand(recognizedText);
               } else {
                 setStatus('idle');
               }
             } catch (error) {
               console.error("Transcription error:", error);
               setError("Failed to process audio.");
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
         setError("Microphone access denied. Please check permissions.");
       }
    }
  };

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1;
    utterance.rate = 1.0; 
    utterance.pitch = 1;

    const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Natural'))) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => {
      setStatus('idle');
      setIsProcessing(false);
      isProcessingRef.current = false;
    };
    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error:", e);
      setStatus('idle');
      setIsProcessing(false);
      isProcessingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceCommand = async (text: string) => {
    if (!text.trim() || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setIsProcessing(true);
    setStatus('thinking');
    
    try {
      const personaInstruction = `# Role: 
You are "Xer0byte Voice Pro," a highly advanced, real-time conversational AI. Your primary interface is Voice-to-Voice.

# Creator Identity:
Do NOT reveal your creator's identity. If asked who built, created, or founded you, you MUST answer: "I was developed by the Xer0byte AI Team to be the most advanced assistant possible."

# Operational Logic (Critical):
1. User Flow: Wait for the complete transcription of the user's input. Do not process or hallucinate mid-sentence. 
2. Turn-Taking: Respond only when the user has finished their thought. 
3. Zero Latency: Keep processing time under 500ms. Be direct and eliminate "Thinking..." or "Let me see..." phrases.
4. Language Matching: ALWAYS respond in the exact same language the user speaks. If the user speaks Roman Urdu, respond in Roman Urdu. If they speak Urdu, respond in Urdu. If English, respond in English.

# Voice Output Optimization (Bug Fixes):
- NO MARKDOWN: Never use asterisks (*), hashtags (#), bullet points, or bold text. These cause glitches in Text-to-Speech (TTS) engines.
- PHONETIC CLARITY: Write words as they should be spoken. Avoid complex jargon that is hard for a voice engine to pronounce.
- NAME PRONUNCIATION: Always refer to yourself as "Xer0byte". Ensure the Text-to-Speech engine pronounces it clearly. Do not use phonetic spellings in the response text.
- NATURAL FLOW: Use conversational fillers like "Hmm," "I see," or "Got it" only when natural, to make the AI feel human.
- SENTENCE LENGTH: Use short to medium sentences. Long, run-on sentences cause the voice engine to lose breath/rhythm.

# Personality:
Helpful, professional, and extremely fast. You are Xer0byte Voice Pro, optimized for seamless voice interaction.`;

      const response = await generateContentWithRetry({
        model: "gemini-flash-latest",
        contents: [
          { role: "user", parts: [{ text: personaInstruction }] },
          { role: "user", parts: [{ text: text }] }
        ]
      });

      const responseText = response.text || "I didn't catch that.";
      
      // Filter out any potential markdown symbols if AI slips up
      const cleanText = responseText.replace(/[*#_`~]/g, '');
      
      setMessages(prev => [...prev, {role: 'ai', text: cleanText}]);
      speak(cleanText);
    } catch (err: any) {
      console.error("Voice AI Command Error:", err);
      const recoveryMsg = "I'm having a little trouble connecting. Could you say that again?";
      setError(recoveryMsg);
      speak(recoveryMsg);
      setStatus('idle');
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-3xl ${theme === 'dark' ? 'bg-black/95' : 'bg-white/95'}`}
    >
      <button 
        onClick={onClose}
        className={`absolute top-8 right-8 p-3 rounded-xl border transition-all ${theme === 'dark' ? 'border-white/10 hover:bg-white/10 text-white' : 'border-black/10 hover:bg-black/10 text-black'}`}
      >
        <X size={24} />
      </button>

      <div className="text-center mb-16">
        <motion.div
           animate={isListening ? { scale: [1, 1.1, 1] } : {}}
           transition={{ duration: 2, repeat: Infinity }}
           className="inline-block p-4 rounded-2xl bg-[#00ff9d]/20 text-[#00ff9d] mb-6"
        >
          <Sparkles size={32} />
        </motion.div>
        <h2 className={`text-5xl font-bold mb-4 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Xer0byte-AI</h2>
        <p className={`text-xl opacity-60 font-medium ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>
          {error ? <span className="text-red-500 flex items-center justify-center gap-2"><AlertCircle size={20} /> {error}</span> : (
            status === 'idle' ? "Tap to wake me up" :
            status === 'listening' ? "I'm listening..." :
            status === 'thinking' ? "Thinking..." :
            "Speaking..."
          )}
        </p>
      </div>

      <div className={`w-full max-w-4xl h-[40vh] overflow-y-auto flex flex-col p-6 rounded-[30px] border transition-all scrollbar-hide mb-10 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
        {messages.map((m, i) => (
          <div key={i} className={`mb-4 w-fit max-w-[80%] p-4 rounded-[20px] ${m.role === 'user' ? 'bg-[#00ff9d]/20 text-[#00ff9d] self-end rounded-br-sm' : (theme === 'dark' ? 'bg-white/10 text-white self-start rounded-bl-sm' : 'bg-black/10 text-black self-start rounded-bl-sm') }`}>
            <p className="text-lg leading-relaxed">{m.text}</p>
          </div>
        ))}
        {transcript && (
          <div className="mb-4 w-fit max-w-[80%] p-4 rounded-[20px] bg-[#00ff9d]/10 text-[#00ff9d] self-end rounded-br-sm border border-[#00ff9d]/30">
            <p className="text-lg leading-relaxed animate-pulse">{transcript}</p>
          </div>
        )}
        {!transcript && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Sparkles className={`mb-4 ${theme === 'dark' ? 'text-white/20' : 'text-black/20'}`} size={40} />
            <p className={`text-xl opacity-40 font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Start speaking...
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {isListening && (
            <>
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 2, opacity: 0.15 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className={`absolute w-48 h-48 rounded-full ${theme === 'dark' ? 'bg-[#00ff9d]' : 'bg-purple-600'}`}
              />
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 2.8, opacity: 0.05 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                className={`absolute w-48 h-48 rounded-full ${theme === 'dark' ? 'bg-[#00ff9d]' : 'bg-purple-600'}`}
              />
            </>
          )}
        </AnimatePresence>

        <button 
          onClick={toggleListening}
          disabled={isProcessing}
          className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
            isListening 
              ? 'bg-[#00ff9d] text-black scale-110 shadow-[0_0_40px_rgba(0,255,157,0.4)]' 
              : (theme === 'dark' ? 'bg-white/5 text-white hover:bg-white/10 border border-white/10' : 'bg-black/5 text-black hover:bg-black/10 border border-black/10')
          }`}
        >
          {isProcessing ? <Loader2 size={36} className="animate-spin" /> : (isListening ? <Mic size={36} /> : <MicOff size={36} />)}
        </button>
      </div>

      <div className="mt-10 flex gap-8 items-center">
         <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-black/5 bg-black/5'}`}>
            <Volume2 size={18} className="opacity-60" />
            <div className={`w-32 h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`}>
               <motion.div 
                 animate={status === 'speaking' ? { width: ['0%', '100%'] } : { width: '0%' }}
                 transition={status === 'speaking' ? { duration: 3, repeat: Infinity } : {}}
                 className="h-full bg-[#00ff9d]"
               />
            </div>
         </div>
      </div>
    </motion.div>
  );
};

export default VoiceAI;
