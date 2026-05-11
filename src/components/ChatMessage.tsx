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
  handleEdit?: (index: number) => void;
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

const ChatMessageComponent = React.forwardRef<HTMLDivElement, ChatMessageProps>(({ 
  msg, i, messagesLength, theme, user, copyToClipboard, 
  setAlertModal, setInputText, setCanvasLanguage, setCanvasContent, 
  setCanvasActiveProjectId, setView, setModals, handleEdit, compact = false
}, ref) => {
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
      ref={ref}
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        type: "spring",
        stiffness: 260,
        damping: 20
      }}
      className={`flex w-full ${compact ? 'mb-4' : 'mb-8 md:mb-12'} ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[95%] md:max-w-[85%] min-w-0`}>
        {/* Role Identity */}
        {!compact && (
          <div className={`flex items-center gap-2 mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white/30' : 'text-black/30'}`}>
            {isAI ? 'Assistant' : 'You'}
          </div>
        )}

        <div className={`${compact ? 'p-3 text-xs md:text-sm' : 'p-4 md:p-5 text-[15px] md:text-[16px]'} rounded-2xl md:rounded-3xl leading-relaxed relative group transition-all border ${
          msg.role === 'user' 
            ? (theme === 'dark' 
                ? 'bg-[#222] border-[#333] text-white shadow-lg' 
                : 'bg-black text-white border-transparent shadow-lg')
            : (theme === 'dark' 
                ? 'bg-[#111] border-[#222] shadow-xl text-[#eee]' 
                : 'bg-white border-[#eee] shadow-md text-[#111]')
        }`}>
          {msg.text.startsWith('[SANDBOX]') && msg.role === 'user' && (
             <div className="flex items-center gap-1.5 opacity-60 text-[10px] uppercase font-bold tracking-widest mb-3"><PenTool size={10}/> Sandbox Instruction</div>
          )}
          {msg.imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border border-white/10 group/img relative">
              <img src={msg.imageUrl} alt="Generated" loading="lazy" className="max-w-full h-auto object-contain" referrerPolicy="no-referrer" />
            </div>
          )}
          {msg.videoUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
              <video controls src={msg.videoUrl} className="max-w-full h-auto object-contain" />
            </div>
          )}
          {msg.audioUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
              <audio controls src={msg.audioUrl} className="w-full" />
            </div>
          )}
          
          <div className={!isAI ? (theme === 'dark' && compact ? 'text-black w-full' : 'text-white w-full') : 'w-full min-w-0'}>
            {!isAI ? msg.text.replace('[SANDBOX]', '').trim() : null}
          </div>
          
          {isAI ? (
            <div className={`prose ${theme === 'dark' ? 'prose-invert prose-headings:text-white prose-a:text-[#00ff9d] prose-strong:text-white' : 'prose-zinc prose-a:text-blue-600 prose-strong:text-black'} max-w-none w-full min-w-0`}>
              {msg.text.startsWith('--- SANDBOX UPDATE ---') ? (
                <div className="flex flex-col gap-3">
                   <div className="flex items-center gap-1.5 text-[#00ff9d] text-[10px] uppercase font-bold tracking-widest border-b border-[#00ff9d]/20 pb-2"><CheckCircle size={10}/> System Updated</div>
                   <MemoizedMarkdown content={displayMessageText.replace('--- SANDBOX UPDATE ---', '').trim()} theme={theme} />
                </div>
              ) : (
                <MemoizedMarkdown content={displayMessageText.replace('[SANDBOX]', '').trim()} theme={theme} />
              )}
              
              {showDownloadButton && (
                <div className={`my-6 p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-[#00ff9d]/10 text-[#00ff9d]' : 'bg-black/5 text-black'}`}>
                      <FolderArchive size={24} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">Project Ready</h4>
                      <p className="text-[10px] opacity-50 font-medium">{extractedFiles.length} files extracted.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleDownloadProject}
                    disabled={isZipping}
                    className={`w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
                  >
                    {isZipping ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                    {isZipping ? 'Processing...' : 'Download ZIP'}
                  </button>
                </div>
              )}

              {/* AI Message Actions */}
              <div className={`flex flex-wrap items-center gap-2 mt-5 transition-all duration-200`}>
                <button onClick={() => copyToClipboard(msg.text)} className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`} title="Copy Response">
                  <Copy size={13} /> <span>Copy</span>
                </button>
                <button onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: 'AI Response', text: msg.text }).catch(console.error);
                  } else {
                    copyToClipboard(msg.text);
                    setAlertModal({ isOpen: true, message: "Copied to clipboard!" });
                  }
                }} className={`p-2 rounded-xl text-xs flex items-center justify-center shadow-sm transition-all active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`} title="Share">
                  <Share size={13} />
                </button>
                <button onClick={() => {
                  const utterance = new SpeechSynthesisUtterance(msg.text);
                  window.speechSynthesis.speak(utterance);
                }} className={`p-2 rounded-xl text-xs flex items-center justify-center shadow-sm transition-all active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`} title="Speak">
                  <Volume2 size={13} />
                </button>
                <div className={`h-4 w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'} mx-1`}></div>
                <button className={`p-2 rounded-lg text-xs transition-colors ${theme === 'dark' ? 'text-white/20 hover:text-white' : 'text-gray-300 hover:text-black'}`} title="Helpful">
                  <ThumbsUp size={13} />
                </button>
                <button className={`p-2 rounded-lg text-xs transition-colors ${theme === 'dark' ? 'text-white/20 hover:text-white' : 'text-gray-300 hover:text-black'}`} title="Not helpful">
                  <ThumbsDown size={13} />
                </button>
                {i === messagesLength - 1 && (
                  <button onClick={() => {
                    setInputText(msg.text);
                  }} className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 ${theme === 'dark' ? 'bg-[#00ff9d] text-black hover:bg-white' : 'bg-black text-white hover:bg-gray-800'}`} title="Regenerate">
                    <RefreshCw size={13} /> <span>Retry</span>
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
                  }} className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-[#00ff9d]' : 'bg-black text-white hover:bg-gray-800'}`} title="Open in Sandbox">
                    <Play size={13} /> <span>Preview</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* User Message Actions */}
              <div className="absolute -bottom-10 right-0 flex items-center gap-2 pt-2">
                <button 
                  onClick={() => handleEdit ? handleEdit(i) : setInputText(msg.text)} 
                  className={`px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`} 
                  title="Edit Message"
                >
                  <Edit2 size={12} /> <span>Edit</span>
                </button>
                <button 
                  onClick={() => copyToClipboard(msg.text)} 
                  className={`px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`} 
                  title="Copy"
                >
                  <Copy size={12} /> <span>Copy</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export const ChatMessage = React.memo(ChatMessageComponent);
