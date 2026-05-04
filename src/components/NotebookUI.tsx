import React, { useState, useEffect, useRef } from 'react';
import { Book, Save, Trash2, Edit2, Plus, FileText, Link, MessageSquare, BookOpen, ChevronLeft, ChevronRight, Send, Sparkles, Check, Paperclip, X, Download, Share2, Info, Lightbulb, Music, Share, Copy } from 'lucide-react';
import Markdown from 'react-markdown';
import { generateContentStreamWithRetry, generateContentWithRetry } from '../lib/gemini';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { createExtractorFromData } from 'unrar-js';
import { firestoreService } from '../services/firestoreService';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Source {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'pdf' | 'link';
  summary?: string;
  selected?: boolean;
}

interface Note {
  id: string;
  title: string;
  content: string;
  sourceId?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function NotebookUI({ theme, user }: { theme?: string, user?: any }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'sources' | 'notes'>('chat');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [notebookSummary, setNotebookSummary] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);
  const lastSendTimeRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  // Responsive logic
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setShowSources(false);
        setShowGuide(false);
      } else {
        setShowSources(true);
        setShowGuide(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Firebase Subscriptions
  useEffect(() => {
    if (!user) return;
    
    // Subscribe to cloud data
    const unsubSources = firestoreService.subscribeToSources(user.id, (data) => {
      setSources(data as Source[]);
    });
    const unsubNotes = firestoreService.subscribeToNotes(user.id, (data) => {
      setNotes(data as Note[]);
    });
    const unsubMessages = firestoreService.subscribeToNotebookMessages(user.id, (data) => {
      setMessages(data as Message[]);
    });

    return () => {
      unsubSources();
      unsubNotes();
      unsubMessages();
    };
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollTo({ top: chatEndRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Initial Guide Generation
  useEffect(() => {
    if (sources.length > 0 && !notebookSummary) {
      generateNotebookSummary();
    }
  }, [sources]);

  const generateNotebookSummary = async () => {
    if (sources.length === 0) return;
    try {
      const combinedText = sources.map(s => `${s.title}: ${s.content.substring(0, 1000)}`).join('\n\n');
      const response = await generateContentWithRetry({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: `Create a comprehensive "Notebook Guide" for these sources. Summarize the key themes, concepts, and available data across all documents. Be professional and structured.\n\nSOURCES:\n${combinedText}` }] }]
      });
      setNotebookSummary(response.text || '');
    } catch (err) {
      console.error("Summary error:", err);
    }
  };

  const handleAddSource = async () => {
    if (!newSourceTitle.trim() || !newSourceContent.trim()) return;
    
    const newSource: Partial<Source> = {
      title: newSourceTitle,
      content: newSourceContent,
      type: 'text',
      selected: true
    };
    
    if (user) {
      const saved = await firestoreService.addSource(user.id, newSource);
      if (saved) generateSourceSummary(saved as Source);
    } else {
      const localSource = { ...newSource, id: Date.now().toString() } as Source;
      setSources(prev => [...prev, localSource]);
      generateSourceSummary(localSource);
    }
    
    setIsAddingSource(false);
    setNewSourceTitle('');
    setNewSourceContent('');
  };

  const addSourceToState = async (title: string, content: string, type: 'text' | 'pdf' | 'link') => {
    const newSource: Partial<Source> = {
      title,
      content,
      type,
      selected: true
    };
    
    if (user) {
      const saved = await firestoreService.addSource(user.id, newSource);
      if (saved) generateSourceSummary(saved as Source);
    } else {
      const localSource = { ...newSource, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) } as Source;
      setSources(prev => [...prev, localSource]);
      generateSourceSummary(localSource);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please upload files under 10MB.");
      return;
    }

    const fileName = file.name.toLowerCase();

    // Support for RAR files
    if (fileName.endsWith('.rar')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result as ArrayBuffer;
          const extractor = await createExtractorFromData(new Uint8Array(data));
          const list = extractor.getFileList();
          const arcFiles = Array.from(list.fileHeaders);
          
          let count = 0;
          for (const header of arcFiles as any[]) {
            if (header.flags.directory) continue;
            
            const extracted = extractor.extractFiles([header.name]);
            const fileData = extracted.files[0];
            if (!fileData) continue;

            const entryName = header.name.toLowerCase();
            const title = header.name.split(/[/\\]/).pop() || header.name;
            const uint8 = fileData.extract[1]; // The actual data

            if (entryName.endsWith('.pdf')) {
               try {
                  const loadingTask = pdfjsLib.getDocument(uint8);
                  const pdf = await loadingTask.promise;
                  let fullText = '';
                  for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => 'str' in item ? item.str : '').join(' ');
                    fullText += pageText + '\n';
                  }
                  await addSourceToState(title, fullText.trim() || `[PDF Content Empty for ${title}]`, 'pdf');
                  count++;
               } catch (e) { console.error("RAR PDF extraction error", e); }
            } else if (entryName.endsWith('.docx')) {
               try {
                  const result = await mammoth.extractRawText({ arrayBuffer: uint8.buffer });
                  await addSourceToState(title, result.value, 'text');
                  count++;
               } catch (e) { console.error("RAR DOCX extraction error", e); }
            } else {
               // Try reading as text (greedy)
               const text = new TextDecoder().decode(uint8);
               // Simple text check: no null characters in first 1000 chars
               if (!text.substring(0, 1000).includes('\0')) {
                  await addSourceToState(title, text, 'text');
                  count++;
               }
            }
          }
          if (count === 0) alert("No readable files found in RAR.");
          setIsAddingSource(false);
        } catch (err) {
          console.error("RAR read error:", err);
          alert("Could not read this RAR file. Ensure it's not password protected.");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // Support for ZIP files
    if (fileName.endsWith('.zip')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const zipData = event.target?.result as ArrayBuffer;
          const zip = await JSZip.loadAsync(zipData);
          
          let count = 0;
          for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;
            
            const entryName = zipEntry.name.toLowerCase();
            const title = zipEntry.name.split('/').pop() || zipEntry.name;

            // Greedy processing for ZIP
            if (entryName.endsWith('.pdf')) {
              const pdfData = await zipEntry.async("uint8array");
              try {
                const loadingTask = pdfjsLib.getDocument(pdfData);
                const pdf = await loadingTask.promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  const pageText = textContent.items.map((item: any) => 'str' in item ? item.str : '').join(' ');
                  fullText += pageText + '\n';
                }
                await addSourceToState(title, fullText.trim() || `No text extracted from ${title}`, 'pdf');
                count++;
              } catch (err) { console.error(`Error reading PDF ${title} from ZIP:`, err); }
            } else if (entryName.endsWith('.docx')) {
              const docxData = await zipEntry.async("arraybuffer");
              try {
                const result = await mammoth.extractRawText({ arrayBuffer: docxData });
                await addSourceToState(title, result.value, 'text');
                count++;
              } catch (e) { console.error(`Error reading DOCX ${title} from ZIP:`, e); }
            } else {
              // Try reading as text
              const content = await zipEntry.async("string");
              if (!content.substring(0, 1000).includes('\0')) {
                await addSourceToState(title, content, 'text');
                count++;
              }
            }
          }
          if (count === 0) {
            alert("No readable files found in ZIP.");
          }
          setIsAddingSource(false);
        } catch (err) {
          console.error("ZIP read error:", err);
          alert("Could not read this ZIP file.");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // Support for DOCX files
    if (fileName.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          const title = file.name.replace(/\.[^/.]+$/, "");
          await addSourceToState(title, result.value, 'text');
          setIsAddingSource(false);
        } catch (err) {
          console.error("DOCX read error:", err);
          alert("Could not read this DOCX file.");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    if (fileName.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
        try {
          const loadingTask = pdfjsLib.getDocument(typedarray);
          const pdf = await loadingTask.promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => 'str' in item ? item.str : '').join(' ');
            fullText += pageText + '\n';
          }
          
          const title = file.name.replace(/\.[^/.]+$/, "");
          await addSourceToState(title, fullText.trim() || "No text could be extracted from this PDF.", 'pdf');
          setIsAddingSource(false);
        } catch (err) {
          console.error("PDF read error:", err);
          alert("Could not read this PDF. It may be password protected or corrupted.");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const title = file.name.replace(/\.[^/.]+$/, "");
      addSourceToState(title, content, 'text');
      setIsAddingSource(false);
    };
    
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setIsAddingSource(true);
      processFile(file);
    }
  };

  const generateSourceSummary = async (source: Source) => {
    const updateLocalOrCloud = (summary: string) => {
      if (user) {
        firestoreService.updateSource(user.id, source.id, { summary });
      } else {
        setSources(prev => prev.map(s => s.id === source.id ? { ...s, summary } : s));
      }
    };

    updateLocalOrCloud('Generating summary... ⚡');
    try {
      const response = await generateContentWithRetry({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: `Summarize this specific document in 3-5 bullet points focusing on key takeaways. Use Markdown format. Title: ${source.title}\n\nCONTENT:\n${source.content}` }] }]
      });
      updateLocalOrCloud(response.text || '');
    } catch (err) {
      console.error("Source summary error:", err);
      updateLocalOrCloud('Failed to generate summary. You can still chat with this source.');
    }
  };

  const handleSendMessage = async () => {
    const now = Date.now();
    if (!input.trim() || isLoading || isSendingRef.current || (now - lastSendTimeRef.current < 1000)) return;
    
    isSendingRef.current = true;
    lastSendTimeRef.current = now;

    const userMsg = input.trim();
    setInput('');
    
    if (user) {
      await firestoreService.addNotebookMessage(user.id, { role: 'user', content: userMsg });
    } else {
      setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    }
    
    setIsLoading(true);

    try {
      const selectedSources = sources.filter(s => s.selected);
      const context = selectedSources.length > 0 
        ? `CONTEXT FROM SOURCES:\n${selectedSources.map(s => `--- SOURCE: ${s.title} ---\n${s.content}`).join('\n\n')}`
        : "No specific sources selected. Answer based on general knowledge.";

      const stream = await generateContentStreamWithRetry({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `${context}\n\nUSER QUESTION: ${userMsg}\n\nINSTRUCTIONS: Answer the question strictly using the provided context. If the answer is found in the context, cite the source name in brackets like [Source Title]. If the answer is not in the context, clearly state that the information is not available in the provided sources, then offer a general explanation if possible.` }] }
        ]
      });

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let fullText = '';
      if (stream) {
        for await (const chunk of stream) {
          fullText += chunk.text || '';
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: fullText }];
            }
            return prev;
          });
        }
      }

      if (user && fullText) {
        await firestoreService.addNotebookMessage(user.id, { role: 'assistant', content: fullText });
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: "An error occurred while linking to the neural source. Please try again." }]);
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  const toggleSourceSelection = (id: string) => {
    const source = sources.find(s => s.id === id);
    if (!source) return;
    
    if (user) {
      firestoreService.updateSource(user.id, id, { selected: !source.selected });
    } else {
      setSources(sources.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
    }
  };

  const generateAudioOverview = async () => {
    if (sources.length === 0) return;
    setIsLoading(true);
    try {
      const { generateTTS, generateContentWithRetry } = await import('../lib/gemini');
      
      const combinedText = sources.map(s => `${s.title}: ${s.content.substring(0, 1000)}`).join('\n\n');
      
      const scriptResponse = await generateContentWithRetry({
        model: "gemini-3-flash-preview",
        contents: [{ 
          role: 'user', 
          parts: [{ text: `Create a professional podcast-style "Conversational Briefing" based on these sources. Two hosts, Alex and Sam, are discussing the key takeaways. Make it engaging, insightful, and flow naturally. Return ONLY the script text without speaker names or metadata.\n\nSOURCES:\n${combinedText}` }] 
        }]
      });

      const script = scriptResponse.text || notebookSummary || "Please add more sources to generate a full overview.";
      const audioUrl = await generateTTS(script.substring(0, 2000));
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      console.error("Audio error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className={`flex h-full w-full overflow-hidden ${isDark ? 'bg-[#0f0f0f] text-white' : 'bg-[#f7f8f9] text-gray-900'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Global Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[200] bg-blue-600/20 backdrop-blur-sm border-4 border-dashed border-blue-500 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl shadow-2xl text-center scale-110">
             <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
               <FileText size={40} className="text-white" />
             </div>
             <h2 className="text-2xl font-bold mb-2">Drop to Upload</h2>
             <p className="opacity-60">Add this document to your neural notebook.</p>
          </div>
        </div>
      )}
      
      {/* Mobile Sidebar Overlays */}
      {(showSources || showGuide) && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity" 
          onClick={() => {
            setShowSources(false);
            setShowGuide(false);
          }}
        />
      )}

      {/* Sources Sidebar */}
      <div className={`fixed lg:relative inset-y-0 left-0 z-50 w-72 flex flex-col border-r shrink-0 transition-transform duration-300 transform ${showSources ? 'translate-x-0' : '-translate-x-full lg:hidden'} ${isDark ? 'bg-[#1a1a1a] border-[#222]' : 'bg-white border-[#e0e0e0]'}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen size={18} className="text-blue-500" />
            <span>Sources</span>
            <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-full">{sources.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsAddingSource(true)} className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors`}>
              <Plus size={18} />
            </button>
            <button onClick={() => setShowSources(false)} className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {sources.length === 0 ? (
            <div 
              onClick={() => setIsAddingSource(true)}
              className={`p-8 text-center cursor-pointer rounded-2xl border border-dashed transition-all m-2 ${isDark ? 'border-white/10 hover:bg-white/5 hover:border-blue-500/50' : 'border-gray-200 hover:bg-gray-50 hover:border-blue-500/50'}`}
            >
              <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Paperclip size={20} />
              </div>
              <p className="text-sm font-semibold mb-1">No sources added</p>
              <p className="text-xs opacity-50">Click here or drag a file to start grounding Xer0byteLM.</p>
            </div>
          ) : (
            sources.map(s => (
              <div 
                key={s.id} 
                onClick={() => setSelectedSourceId(s.id)}
                className={`group flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer border ${
                  selectedSourceId === s.id 
                  ? (isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200 shadow-sm') 
                  : (isDark ? 'bg-transparent border-transparent hover:bg-white/5' : 'bg-transparent border-transparent hover:bg-gray-50')
                }`}
              >
                <div onClick={(e) => { e.stopPropagation(); toggleSourceSelection(s.id); }} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${s.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-white/20'}`}>
                  {s.selected && <Check size={12} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.title}</div>
                  <div className="text-[10px] opacity-50 flex items-center gap-1 uppercase tracking-wider">
                    {s.type === 'pdf' ? 'PDF' : 'Original Text'}
                  </div>
                </div>
                <button onClick={(e) => { 
                  e.stopPropagation(); 
                  if (user) { firestoreService.deleteSource(user.id, s.id); } 
                  else { setSources(sources.filter(src => src.id !== s.id)); }
                }} className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t mt-auto">
          <div className="bg-blue-500/5 rounded-2xl p-4 border border-blue-500/10 text-center">
            <Lightbulb size={24} className="text-blue-500 mx-auto mb-2" />
            <div className="text-xs font-semibold mb-1">Source Grounding</div>
            <p className="text-[10px] opacity-60">Xer0byteLM will base all answers strictly on your selected sources.</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent">
        
        {/* Top Navbar */}
        <div className="h-14 border-b flex items-center justify-between px-4 md:px-6 shrink-0 bg-white dark:bg-[#1a1a1a]">
          <div className="flex items-center gap-2 md:gap-6">
            <button 
              onClick={() => setShowSources(!showSources)}
              className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${showSources ? 'text-blue-500 bg-blue-500/10' : 'opacity-60'}`}
            >
              <BookOpen size={18} />
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-white/10 hidden sm:block" />
            <button 
              onClick={() => setActiveTab('chat')}
              className={`text-xs md:text-sm font-semibold relative py-4 transition-colors ${activeTab === 'chat' ? 'text-blue-500' : 'opacity-60 hover:opacity-100'}`}
            >
              Chat
              {activeTab === 'chat' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('sources')}
              className={`text-xs md:text-sm font-semibold relative py-4 transition-colors ${activeTab === 'sources' ? 'text-blue-500' : 'opacity-60 hover:opacity-100'}`}
            >
              Docs
              {activeTab === 'sources' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`text-xs md:text-sm font-semibold relative py-4 transition-colors ${activeTab === 'notes' ? 'text-blue-500' : 'opacity-60 hover:opacity-100'}`}
            >
              Notes
              {activeTab === 'notes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
            </button>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
             <button onClick={() => setShowGuide(!showGuide)} className={`p-2 rounded-lg transition-colors ${showGuide ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>
               <Sparkles size={20} />
             </button>
             <button className="hidden sm:block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
               <Share2 size={20} />
             </button>
          </div>
        </div>

        {/* Dynamic View Area */}
        <div className="flex-1 relative overflow-hidden flex min-h-0">
          
          <div className={`flex-1 flex flex-col min-w-0 transition-all ${showGuide ? 'lg:mr-0' : ''}`}>
             
             {activeTab === 'chat' && (
               <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center space-y-6 text-center max-w-lg mx-auto">
                        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                          <Sparkles size={32} className="text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold mb-2">Welcome to your Neural Notebook</h2>
                          <p className="opacity-60 text-sm">Ask anything about your uploaded sources. Xer0byteLM will summarize, cross-reference, and analyze your data across multiple formats.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 w-full">
                          {['Summarize key findings', 'Find contradictions', 'Explain main concepts', 'Generate a quiz'].map(suggestion => (
                            <button 
                              key={suggestion}
                              onClick={() => { setInput(suggestion); }}
                              className={`p-3 text-xs rounded-xl border border-dashed transition-all text-left ${isDark ? 'border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5' : 'border-gray-200 hover:border-blue-500/50 hover:bg-blue-50'}`}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                              <Sparkles size={16} className="text-white" />
                            </div>
                          )}
                          <div className={`max-w-[85%] rounded-2xl p-4 ${
                            msg.role === 'user' 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : (isDark ? 'bg-[#1a1a1a] border border-[#222]' : 'bg-white border border-[#eee] shadow-sm')
                          }`}>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <Markdown>{msg.content}</Markdown>
                            </div>
                            {msg.role === 'assistant' && (
                              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex gap-2">
                                <button 
                                  onClick={() => {
                                   const newNote = { title: 'Chat Insight', content: msg.content };
                                   if (user) { firestoreService.addNote(user.id, newNote); }
                                   else { setNotes([{ id: Date.now().toString(), ...newNote }, ...notes]); }
                                 }}
                                  className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity"
                                >
                                  <Save size={10} /> Save to Notes
                                </button>
                                <button 
                                  onClick={() => navigator.clipboard.writeText(msg.content)}
                                  className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity"
                                >
                                  <Copy size={10} /> Copy
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {isLoading && (
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 animate-pulse">
                          <Sparkles size={16} className="text-white" />
                        </div>
                        <div className={`max-w-[85%] rounded-2xl p-4 border border-dashed ${isDark ? 'bg-white/5 border-white/20' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input area */}
                  <div className="p-4 md:p-6 bg-transparent">
                    <div className={`max-w-3xl mx-auto rounded-3xl p-2.5 flex items-end gap-3 border shadow-xl transition-all focus-within:ring-2 focus-within:ring-blue-500/20 ${
                      isDark ? 'bg-[#1a1a1a] border-[#222]' : 'bg-white border-[#eee]'
                    }`}>
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                        placeholder={`Ask about ${sources.filter(s => s.selected).length} sources...`}
                        className="flex-1 bg-transparent border-none outline-none resize-none py-3 px-3 text-sm min-h-[48px] max-h-40 custom-scrollbar"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isLoading}
                        className={`p-3 rounded-2xl transition-all ${
                          !input.trim() || isLoading 
                          ? 'opacity-30 cursor-not-allowed' 
                          : 'bg-blue-600 text-white shadow-blue-500/20 hover:scale-105 active:scale-95'
                        }`}
                      >
                        <Send size={20} />
                      </button>
                    </div>
                    <p className="text-center text-[10px] opacity-40 mt-3">Xer0byteLM uses source grounding to prevent hallucination.</p>
                  </div>
               </div>
             )}

             {activeTab === 'sources' && (
               <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0f0f0f]">
                  {selectedSourceId ? (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="p-6 border-b flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                             <FileText size={20} />
                          </div>
                          <div>
                            <h2 className="font-bold">{sources.find(s => s.id === selectedSourceId)?.title}</h2>
                            <p className="text-xs opacity-50 uppercase tracking-widest font-bold">Document Source</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><Edit2 size={16}/></button>
                           <button className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                         <div className="max-w-2xl mx-auto space-y-8">
                            <div className="bg-blue-500/5 rounded-2xl p-6 border border-blue-500/10 mb-8">
                               <div className="flex items-center gap-2 mb-4">
                                 <Sparkles size={16} className="text-blue-500" />
                                 <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Key Points</span>
                               </div>
                               <div className="prose prose-sm dark:prose-invert">
                                  <Markdown>{sources.find(s => s.id === selectedSourceId)?.summary || "Generating summary..."}</Markdown>
                               </div>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none opacity-80 whitespace-pre-wrap leading-relaxed">
                               {sources.find(s => s.id === selectedSourceId)?.content}
                            </div>
                         </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                       <FileText size={48} className="mb-4" />
                       <h3 className="font-bold text-lg">Select a document</h3>
                       <p className="text-sm">Choose a source from the left sidebar to view contents and analysis.</p>
                    </div>
                  )}
               </div>
             )}

             {activeTab === 'notes' && (
               <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0f0f0f]">
                  <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold">Your Saved Notes</h2>
                      <button 
                        onClick={() => {
                          const newNote = { title: 'New Note', content: '' };
                          if (user) { firestoreService.addNote(user.id, newNote); }
                          else { setNotes([{ id: Date.now().toString(), ...newNote }, ...notes]); }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Plus size={18} /> New Note
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {notes.length === 0 ? (
                        <div className="col-span-2 py-20 text-center opacity-30">
                           <Save size={48} className="mx-auto mb-4" />
                           <p>No notes saved yet. Save interesting insights from your research.</p>
                        </div>
                      ) : (
                        notes.map(note => (
                          <div key={note.id} className={`group p-5 rounded-2xl border transition-all hover:shadow-lg ${isDark ? 'bg-[#1a1a1a] border-[#222] hover:border-white/20' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                             <div className="flex justify-between items-start mb-3">
                               <input 
                                 value={note.title}
                                 onChange={(e) => {
                                  if (user) { firestoreService.updateNote(user.id, note.id, { title: e.target.value }); }
                                  else { setNotes(notes.map(n => n.id === note.id ? { ...n, title: e.target.value } : n)); }
                                }}
                                 placeholder="Note Title"
                                 className="font-bold bg-transparent border-none outline-none text-lg flex-1 mr-2"
                               />
                               <button onClick={() => {
                                if (user) { firestoreService.deleteNote(user.id, note.id); }
                                else { setNotes(notes.filter(n => n.id !== note.id)); }
                              }} className="opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-red-500 transition-all">
                                 <Trash2 size={16} />
                               </button>
                             </div>
                             <textarea 
                               value={note.content}
                               onChange={(e) => {
                                 if (user) { firestoreService.updateNote(user.id, note.id, { content: e.target.value }); }
                                 else { setNotes(notes.map(n => n.id === note.id ? { ...n, content: e.target.value } : n)); }
                               }}
                               placeholder="Start capturing your thoughts..."
                               className="w-full bg-transparent border-none outline-none text-sm opacity-70 min-h-[120px] resize-none leading-relaxed"
                             />
                             <div className="mt-4 pt-4 border-t border-transparent group-hover:border-inherit flex justify-between items-center transition-all">
                                <div className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Neural Draft</div>
                                <div className="flex items-center gap-2">
                                  <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><Share size={14} /></button>
                                  <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"><Copy size={14} /></button>
                                </div>
                             </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
               </div>
             )}

          </div>

          {/* Notebook Guide / Overview Panel (Right Sidebar) */}
          {showGuide && (
            <div className={`fixed lg:relative inset-y-0 right-0 z-50 w-full sm:w-80 lg:w-80 border-l flex flex-col shrink-0 transition-all duration-300 transform ${showGuide ? 'translate-x-0' : 'translate-x-full lg:hidden'} ${isDark ? 'bg-[#1a1a1a] border-[#222]' : 'bg-white border-[#e0e0e0]'}`}>
               <div className="p-4 border-b flex items-center justify-between">
                 <div className="flex items-center gap-2 font-bold text-sm tracking-tight">
                    <Sparkles size={16} className="text-blue-500" />
                    <span>Neural Guide</span>
                 </div>
                 <button onClick={() => setShowGuide(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"><X size={18}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                  <div className="space-y-4">
                     <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">Overall Summary</h3>
                     <div className={`p-4 rounded-2xl text-xs leading-relaxed ${isDark ? 'bg-white/5 border border-white/10' : 'bg-blue-50 border border-blue-100'}`}>
                        {notebookSummary || (sources.length === 0 ? "Add sources to generate a neural guide." : "Analyzing sources...")}
                     </div>
                  </div>

                  <div className="space-y-4">
                     <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">Source Distribution</h3>
                     <div className="space-y-2">
                        {sources.map(s => (
                           <div key={s.id} className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <div className="flex-1 text-[11px] font-medium truncate">{s.title}</div>
                              <div className="text-[10px] opacity-40">{Math.round(s.content.length / 1000)}kb</div>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-xl shadow-blue-500/20">
                     <div className="text-sm font-bold mb-2">Pro Analytics</div>
                     <p className="text-[10px] opacity-80 mb-4 font-medium leading-relaxed">Xer0byteLM identifies cross-document correlations and latent patterns in your neural network.</p>
                     <button className="w-full bg-white text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-opacity-90 transition-all">Extract Entity Report</button>
                  </div>
               </div>
               <div className="p-4 border-t">
                  <button 
                    disabled={isLoading || sources.length === 0}
                    onClick={generateAudioOverview}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                     <span>{isLoading ? 'Generating Audio...' : 'Export Audio Overview'}</span>
                     <Music size={14} className={isLoading ? 'animate-spin' : 'opacity-50'} />
                  </button>
               </div>
            </div>
          )}

        </div>
      </div>
      {/* Add Source Modal */}
      {isAddingSource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddingSource(false)} />
          <div className={`relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-[#eee]'}`}>
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Plus size={20} />
                </div>
                <h2 className="text-xl font-bold">Add Neural Source</h2>
              </div>
              <button onClick={() => setIsAddingSource(false)} className="p-2 opacity-50 hover:opacity-100 transition-opacity">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2 block">Source Title</label>
                <input 
                  autoFocus
                  value={newSourceTitle}
                  onChange={(e) => setNewSourceTitle(e.target.value)}
                  placeholder="e.g. Q4 Growth Report"
                  className={`w-full p-4 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 ${isDark ? 'bg-white/5 border-white/10 focus:border-blue-500/50' : 'bg-gray-50 border-gray-200 focus:border-blue-500/50'}`}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2 block">Content</label>
                <textarea 
                  value={newSourceContent}
                  onChange={(e) => setNewSourceContent(e.target.value)}
                  placeholder="Paste text, research findings, or URLs..."
                  className={`w-full p-4 rounded-xl border outline-none min-h-[200px] resize-none transition-all focus:ring-2 focus:ring-blue-500/20 ${isDark ? 'bg-white/5 border-white/10 focus:border-blue-500/50' : 'bg-gray-50 border-gray-200 focus:border-blue-500/50'}`}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'bg-white/5 border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5' : 'bg-gray-50 border-gray-200 hover:border-blue-500/50 hover:bg-blue-50'}`}
                  >
                    <Paperclip size={16} className="text-blue-500" />
                    <span>Upload File</span>
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,.js,.ts,.tsx,.json,.css,.html,.pdf,.zip,.docx,.rar" onChange={handleFileUpload} />
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsAddingSource(false)}
                    className="px-6 py-2.5 text-sm font-semibold opacity-60 hover:opacity-100 transition-opacity"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!newSourceTitle.trim() || !newSourceContent.trim()}
                    onClick={handleAddSource}
                    className={`px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${!newSourceTitle.trim() || !newSourceContent.trim() ? 'opacity-30 cursor-not-allowed bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'}`}
                  >
                    Add Source
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

