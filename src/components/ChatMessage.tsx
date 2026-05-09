import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Share, Volume2, ThumbsUp, ThumbsDown, RefreshCw, Play, PenTool, CheckCircle, Edit2, Download, FolderArchive } from 'lucide-react';
import { copyToClipboard, extractFilesFromMarkdown, downloadProjectAsZip } from '../lib/utils';
import JSZip from 'jszip';

interface ChatMessageProps {
  msg: any;
  i: number;
  messagesLength: number;
  theme: 'light' | 'dark';
  user: any;
  copyToClipboard: (text: string) => void;
  setAlertModal: (modal: any) => void;
  setInputText: (text: string) => void;
  setCanvasLanguage: (lang: string) => void;
  setCanvasContent: (content: string) => void;
  setCanvasActiveProjectId: (id: string | null) => void;
  setView: (view: any) => void;
  setModals: (modals: any) => void;
  isThinking?: boolean;
  compact?: boolean;
}

const MemoizedMarkdown = React.memo(({ content, theme }: { content: string; theme: string }) => {
  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match ? match[1] : '';
          
          if (!inline && match) {
            return (
              <div className="relative group/code my-4">
                <div className="absolute right-2 top-2 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity">
                  <button 
                    onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))}
                    className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors"
                    title="Copy code"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <SyntaxHighlighter
                  style={theme === 'dark' ? vscDarkPlus : prism}
                  language={lang}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '0.75rem',
                    fontSize: '0.85rem',
                    background: theme === 'dark' ? '#0d0d0d' : '#f8f8f8',
                    border: theme === 'dark' ? '1px solid #333' : '1px solid #eee'
                  }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code className={`${className} px-1.5 py-0.5 rounded-md ${theme === 'dark' ? 'bg-white/10 text-[#00ff9d]' : 'bg-black/5 text-[#006633] font-semibold'}`} {...props}>
              {children}
            </code>
          );
        },
        table({ children }) {
           return (
             <div className="overflow-x-auto my-4 rounded-xl border border-inherit">
               <table className="min-w-full divide-y divide-inherit border-collapse">
                 {children}
               </table>
             </div>
           );
        },
        th({ children }) {
           return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider bg-inherit">{children}</th>;
        },
        td({ children }) {
           return <td className="px-4 py-3 text-sm border-t border-inherit">{children}</td>;
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

export const ChatMessage: React.FC<ChatMessageProps> = React.memo(({ 
  msg, i, messagesLength, theme, user, copyToClipboard, 
  setAlertModal, setInputText, setCanvasLanguage, setCanvasContent, 
  setCanvasActiveProjectId, setView, setModals, compact = false
}) => {
  const isAI = msg.role === 'ai';
  const [isZipping, setIsZipping] = useState(false);
  
  const extractedFiles = useMemo(() => {
    if (!isAI || !msg.text) return [];
    return extractFilesFromMarkdown(msg.text);
  }, [isAI, msg.text]);
  
  const showDownloadButton = useMemo(() => {
    return isAI && extractedFiles.length > 0 && msg.text?.includes('[ALLOW_ZIP_DOWNLOAD]');
  }, [isAI, extractedFiles, msg.text]);
  
  const displayMessageText = useMemo(() => {
    if (!msg.text) return "";
    return msg.text.replace(/\[ALLOW_ZIP_DOWNLOAD\]/g, '').trim();
  }, [msg.text]);

  const handleDownloadProject = async () => {
    if (extractedFiles.length === 0) return;
    setIsZipping(true);
    try {
      await downloadProjectAsZip('ai_generated_project', extractedFiles, JSZip);
    } catch (error) {
      console.error("ZIP Generation error:", error);
      setAlertModal({ isOpen: true, message: "Failed to generate ZIP file." });
    } finally {
      setIsZipping(false);
    }
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className={`flex w-full ${compact ? 'mb-4' : 'mb-8'} ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`${compact ? 'max-w-[95%] p-3 text-xs md:text-sm' : 'max-w-[90%] md:max-w-[85%] p-4 md:p-6 text-[15px] md:text-[16px]'} rounded-2xl md:rounded-3xl leading-relaxed relative group overflow-hidden break-all whitespace-pre-wrap ${
        msg.role === 'user' 
          ? (theme === 'dark' ? (compact ? 'bg-[#00ff9d] text-black font-medium' : 'bg-[#333] text-white shadow-xl') : 'bg-black text-white shadow-lg')
          : (theme === 'dark' ? 'bg-[#18181A] border border-[#333] shadow-2xl text-[#eee]' : 'bg-white border border-[#eaeaea] shadow-xl text-[#111]')
      }`}>
        {msg.text.startsWith('[SANDBOX]') && msg.role === 'user' && (
           <div className="flex items-center gap-1.5 opacity-60 text-[10px] uppercase font-bold tracking-widest mb-2"><PenTool size={10}/> Sandbox instruction</div>
        )}
        {msg.imageUrl && (
          <div className="mb-3 rounded-xl md:rounded-2xl overflow-hidden border border-white/10">
            <img src={msg.imageUrl} alt="Generated" loading="lazy" className="max-w-full h-auto object-contain" referrerPolicy="no-referrer" />
          </div>
        )}
        {msg.videoUrl && (
          <div className="mb-3 rounded-xl md:rounded-2xl overflow-hidden border border-white/10">
            <video controls src={msg.videoUrl} className="max-w-full h-auto object-contain" />
          </div>
        )}
        {msg.audioUrl && (
          <div className="mb-3 rounded-xl md:rounded-2xl overflow-hidden border border-white/10">
            <audio controls src={msg.audioUrl} className="w-full" />
          </div>
        )}
        
        <div className={!isAI ? 'text-white w-full overflow-hidden break-all' : 'w-full overflow-hidden min-w-0'}>
          {!isAI ? msg.text.replace('[SANDBOX]', '').trim() : null}
        </div>
        
        {isAI ? (
          <div className={`prose ${theme === 'dark' ? 'prose-invert prose-headings:text-white prose-a:text-[#00ff9d] prose-strong:text-white prose-code:text-[#00ff9d]' : 'prose-zinc prose-a:text-[#006633] prose-strong:text-black'} max-w-none w-full overflow-hidden break-all min-w-0`}>
            {msg.text.startsWith('--- SANDBOX UPDATE ---') ? (
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-1.5 text-[#00ff9d] text-[10px] uppercase font-bold tracking-widest"><CheckCircle size={10}/> Sandbox Code Updated</div>
                 <MemoizedMarkdown content={displayMessageText.replace('--- SANDBOX UPDATE ---', '').trim()} theme={theme} />
              </div>
            ) : (
              <MemoizedMarkdown content={displayMessageText.replace('[SANDBOX]', '').trim()} theme={theme} />
            )}
            
            {showDownloadButton && (
              <div className={`mb-4 p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500 ${theme === 'dark' ? 'bg-[#222]/50 border-[#444]' : 'bg-[#f0f0f0]/50 border-[#ddd]'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-[#00ff9d]/10 text-[#00ff9d]' : 'bg-[#006633]/10 text-[#006633]'}`}>
                    <FolderArchive size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider opacity-80">Project Package Detected</h4>
                    <p className="text-[10px] opacity-60">{extractedFiles.length === 1 ? "1 file" : `${extractedFiles.length} files`} extracted for this project.</p>
                  </div>
                </div>
                <button 
                  onClick={handleDownloadProject}
                  disabled={isZipping}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 ${theme === 'dark' ? 'bg-[#00ff9d] text-black hover:bg-white' : 'bg-black text-white hover:bg-gray-800'}`}
                >
                  {isZipping ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                  {isZipping ? 'Generating...' : 'Download Project ZIP'}
                </button>
              </div>
            )}

            {/* AI Message Actions */}
            <div className={`flex flex-wrap items-center gap-1 mt-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity`}>
              <button onClick={() => copyToClipboard(msg.text)} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Copy">
                <Copy size={14} />
              </button>
              <button onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'Xer0byte AI Response', text: msg.text }).catch(console.error);
                } else {
                  copyToClipboard(msg.text);
                  setAlertModal({ isOpen: true, message: "Copied to clipboard to share!" });
                }
              }} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Share">
                <Share size={14} />
              </button>
              <button onClick={() => {
                const utterance = new SpeechSynthesisUtterance(msg.text);
                window.speechSynthesis.speak(utterance);
              }} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Read Aloud">
                <Volume2 size={14} />
              </button>
              <button className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Good response">
                <ThumbsUp size={14} />
              </button>
              <button className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Bad response">
                <ThumbsDown size={14} />
              </button>
              {i === messagesLength - 1 && (
                <button onClick={() => {
                  setInputText(msg.text);
                }} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Regenerate">
                  <RefreshCw size={14} />
                </button>
              )}
              {msg.text.length > 200 && (
                <button onClick={() => {
                  if (!user) { setModals((prev: any) => ({...prev, signIn: true})); return; }
                  if (user.role !== 'admin' && user.plan === 'free') {
                    setModals((prev: any) => ({ ...prev, upgradePro: true }));
                    return;
                  }
                  let content = msg.text;
                  let lang = 'python';
                  const codeMatch = content.match(/```([a-z0-9#\-\+]+)?\n([\s\S]*?)```/i);
                  if (codeMatch && codeMatch.length > 2) {
                    lang = (codeMatch[1] || 'python').toLowerCase();
                    const supportedLangs = ['html', 'javascript', 'typescript', 'python', 'java', 'csharp', 'php', 'ruby', 'go', 'swift', 'kotlin', 'dart', 'elixir', 'erlang', 'c', 'cpp', 'rust', 'zig', 'nim', 'd', 'ada', 'assembly', 'r', 'julia', 'sql', 'prolog', 'lisp', 'haskell', 'clojure', 'scala', 'ocaml', 'fsharp', 'bash', 'basic', 'cobol', 'crystal', 'fortran', 'groovy', 'lua', 'pascal', 'perl', 'brainfuck'];
                    if (!supportedLangs.includes(lang)) {
                      if (lang === 'js' || lang === 'jsx') lang = 'javascript';
                      else if (lang === 'ts' || lang === 'tsx') lang = 'typescript';
                      else if (lang === 'py') lang = 'python';
                      else if (lang === 'c++') lang = 'cpp';
                      else if (lang === 'c#') lang = 'csharp';
                      else if (lang === 'sh') lang = 'bash';
                      else lang = 'python';
                    }
                    content = content.match(/```[\s\S]*?```/g)?.map(block => block.replace(/```[a-z0-9#\-\+]*\n/i, '').replace(/```$/, '')).join('\n\n') || content;
                  } else {
                    const codeMatchGeneral = content.match(/```[\s\S]*?```/g);
                    if (codeMatchGeneral) content = codeMatchGeneral.map(block => block.replace(/```[a-z0-9#\-\+]*\n/i, '').replace(/```$/, '')).join('\n\n');
                  }
                  setCanvasLanguage(lang);
                  setCanvasContent(content);
                  setCanvasActiveProjectId(null);
                  setView('ide');
                }} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Run in Live Sandbox">
                  <Play size={14} /> <span className="hidden md:inline">Run Code</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* User message is already rendered above */}
            {/* User Message Actions */}
            <div className="absolute -bottom-10 right-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
              <button onClick={() => setInputText(msg.text)} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Edit">
                <Edit2 size={14} />
              </button>
              <button onClick={() => copyToClipboard(msg.text)} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Copy">
                <Copy size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});
