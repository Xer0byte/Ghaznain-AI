import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Share, Volume2, ThumbsUp, ThumbsDown, RefreshCw, Play, PenTool, CheckCircle, Edit2, Download, FolderArchive } from 'lucide-react';
import { copyToClipboard, extractFilesFromMarkdown, downloadProjectAsZip } from '../lib/utils';
import JSZip from 'jszip';
import { DataVisualizer } from './DataVisualizer';

// Extracts and parses markdown tables to render charts automatically
function parseTablesFromMarkdown(text: string) {
  if (!text) return [];
  const lines = text.split('\n');
  const tables: string[][] = [];
  let currentTable: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      currentTable.push(line);
    } else {
      if (currentTable.length >= 3) {
        tables.push([...currentTable]);
      }
      currentTable = [];
    }
  }
  if (currentTable.length >= 3) {
    tables.push(currentTable);
  }

  const parsedTables = tables.map((rawLines, tableIndex) => {
    const parseRow = (rowStr: string) => 
      rowStr.split('|')
        .map(cell => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    
    const headers = parseRow(rawLines[0]);
    const rows = rawLines.slice(2).map(rowStr => parseRow(rowStr));
    
    const data = rows.map((cells) => {
      const obj: any = {};
      headers.forEach((hdr, colIdx) => {
        const valueStr = cells[colIdx] || '';
        const cleanVal = valueStr.replace(/[$,\s%]/g, '');
        const num = parseFloat(cleanVal);
        obj[hdr] = isNaN(num) ? valueStr : num;
      });
      return obj;
    });

    const numericKeys = headers.filter(hdr => {
      return data.some(row => typeof row[hdr] === 'number');
    });

    const labelKeys = headers.filter(hdr => !numericKeys.includes(hdr));
    const labelKey = labelKeys[0] || headers[0];

    return {
      id: `table-visual-${tableIndex}`,
      headers,
      numericKeys,
      labelKey,
      data
    };
  }).filter(t => t.data.length > 0 && t.numericKeys.length > 0);

  return parsedTables;
}

interface ChatMessageProps {
  msg: any;
  i: number;
  messagesLength: number;
  theme: 'light' | 'dark';
  user: any;
  copyToClipboard: (text: string) => any;
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

const CodeBlock = ({ children, lang, theme }: { children: string; lang: string; theme: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(children);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="not-prose relative my-6 w-full max-w-full overflow-hidden rounded-xl border border-[#eee] dark:border-[#222] shadow-sm font-sans flex flex-col">
      {/* Sleek Toolbar Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#f6f6f6] dark:bg-[#121212] border-b border-[#eee] dark:border-[#222] select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Decorative Terminal Dots */}
          <div className="flex gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-60"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-60"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-60"></span>
          </div>
          {lang && (
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-[#555] dark:text-white/40 ml-2 truncate max-w-[120px]">
              {lang}
            </span>
          )}
        </div>
        <button 
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight transition-all active:scale-95 border duration-150 shrink-0 select-none ${
            copied 
              ? 'bg-emerald-600 border-emerald-500 text-white' 
              : 'bg-white dark:bg-[#1e1e1e] border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 shadow-sm'
          }`}
          title="Copy Code Snippet"
        >
          {copied ? <CheckCircle size={11} className="text-white" /> : <Copy size={11} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Actual Highlighter Container with Horizontal Scrolling */}
      <div className="relative w-full overflow-x-auto scrollbar-thin">
        <SyntaxHighlighter
          style={theme === 'dark' ? vscDarkPlus : prism}
          language={lang || 'plaintext'}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: '0px', 
            fontSize: '13px',
            lineHeight: '1.65',
            background: theme === 'dark' ? '#070707' : '#fafafa',
            padding: '1.25rem',
            overflowX: 'auto',
            border: 'none',
            minWidth: '100%',
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const MemoizedMarkdown = React.memo(({ content, theme }: { content: string; theme: string }) => {
  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match ? match[1] : '';
          
          const isInline = !className && !String(children).includes('\n');
          
          if (!isInline) {
            return (
              <CodeBlock lang={lang || 'plaintext'} theme={theme}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          }
          return (
            <code className={`${className || ''} px-1.5 py-0.5 rounded-md ${theme === 'dark' ? 'bg-white/10 text-[#00ff9d]' : 'bg-black/5 text-[#006633] font-semibold'}`} {...props}>
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

  const parsedTables = useMemo(() => {
    if (!isAI || !displayMessageText) return [];
    return parseTablesFromMarkdown(displayMessageText);
  }, [isAI, displayMessageText]);

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

        <div className={`${compact ? 'p-3 text-xs md:text-sm' : 'p-4 md:p-5 text-[15px] md:text-[16px]'} rounded-2xl md:rounded-3xl leading-relaxed relative group transition-all border w-full max-w-full min-w-0 overflow-hidden ${
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
          
          <div className={!isAI ? 'text-white w-full' : 'w-full min-w-0'}>
            {!isAI ? msg.text.replace('[SANDBOX]', '').trim() : null}
          </div>

          {/* User Attached Files Preview and Downloads */}
          {msg.files && msg.files.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-white/20'} w-full flex flex-wrap gap-2`}>
              {msg.files.map((file: any, fIdx: number) => {
                const isImg = file.mimeType?.startsWith('image/');
                const isPdf = file.mimeType === 'application/pdf' || file.name?.endsWith('.pdf');
                
                return (
                  <div 
                    key={fIdx} 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] max-w-full select-none ${
                      theme === 'dark'
                        ? 'bg-[#1b1b1b] border-white/5 text-gray-200'
                        : 'bg-white/10 border-white/10 text-white'
                    }`}
                  >
                    {isImg ? (
                      <span className="text-emerald-400">🖼️</span>
                    ) : isPdf ? (
                      <span className="text-rose-400">📕</span>
                    ) : (
                      <span className="text-sky-450 text-blue-300">📄</span>
                    )}
                    <span className="truncate max-w-[150px] font-bold" title={file.name}>
                      {file.name || 'Attachment'}
                    </span>
                    {file.data && (
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = file.data.startsWith('data:') ? file.data : `data:${file.mimeType || 'application/octet-stream'};base64,${file.data}`;
                          link.download = file.name || 'download';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="ml-1 opacity-70 hover:opacity-100 hover:scale-110 active:scale-95 transition-all text-white"
                        title="Download"
                      >
                        <Download size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
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
              
              {parsedTables.map((tbl: any) => (
                <DataVisualizer key={tbl.id} tableData={tbl} theme={theme} />
              ))}
              
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
              <div className="flex flex-wrap items-center gap-2 mt-6 transition-all duration-200 border-t border-inherit pt-4">
                <button 
                  onClick={() => copyToClipboard(msg.text)} 
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 border ${
                    theme === 'dark' 
                      ? 'bg-[#151515] text-[#ccc] border-[#222] hover:bg-[#222] hover:text-[#00ff9d]' 
                      : 'bg-[#fafafa] text-[#444] border-[#eee] hover:bg-[#eee] hover:text-black'
                  }`} 
                  title="Copy Response"
                >
                  <Copy size={12} /> <span>Copy</span>
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const isIframe = window.self !== window.top;
                      if (!isIframe && navigator.share && navigator.canShare && navigator.canShare({ text: msg.text })) {
                        await navigator.share({ title: 'AI Response', text: msg.text });
                      } else {
                        const success = await copyToClipboard(msg.text);
                        if (success) {
                          setAlertModal({ isOpen: true, message: "Response successfully copied to clipboard! Ready to share." });
                        }
                      }
                    } catch (error) {
                      console.error("Web Share failed, fallback to copy to clipboard", error);
                      const success = await copyToClipboard(msg.text);
                      if (success) {
                        setAlertModal({ isOpen: true, message: "Response copied to clipboard!" });
                      }
                    }
                  }} 
                  className={`p-2 rounded-xl text-xs flex items-center justify-center shadow-sm transition-all active:scale-95 border ${
                    theme === 'dark' 
                      ? 'bg-[#151515] text-[#ccc] border-[#222] hover:bg-[#222] hover:text-[#00ff9d]' 
                      : 'bg-[#fafafa] text-[#444] border-[#eee] hover:bg-[#eee] hover:text-black'
                  }`} 
                  title="Share"
                >
                  <Share size={12} />
                </button>
                <button 
                  onClick={() => {
                    const utterance = new SpeechSynthesisUtterance(msg.text);
                    window.speechSynthesis.speak(utterance);
                  }} 
                  className={`p-2 rounded-xl text-xs flex items-center justify-center shadow-sm transition-all active:scale-95 border ${
                    theme === 'dark' 
                      ? 'bg-[#151515] text-[#ccc] border-[#222] hover:bg-[#222] hover:text-[#00ff9d]' 
                      : 'bg-[#fafafa] text-[#444] border-[#eee] hover:bg-[#eee] hover:text-black'
                  }`} 
                  title="Speak"
                >
                  <Volume2 size={12} />
                </button>
                <div className={`h-4 w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'} mx-0.5`}></div>
                <button className={`p-2 rounded-xl text-xs transition-colors border ${theme === 'dark' ? 'bg-[#151515]/40 text-[#555] border-[#222] hover:text-[#aaa]' : 'bg-[#fafafa]/40 text-gray-400 border-[#eee] hover:text-gray-800'}`} title="Helpful">
                  <ThumbsUp size={12} />
                </button>
                <button className={`p-2 rounded-xl text-xs transition-colors border ${theme === 'dark' ? 'bg-[#151515]/40 text-[#555] border-[#222] hover:text-[#aaa]' : 'bg-[#fafafa]/40 text-gray-400 border-[#eee] hover:text-gray-800'}`} title="Not helpful">
                  <ThumbsDown size={12} />
                </button>
                {i === messagesLength - 1 && (
                  <button 
                    onClick={() => {
                      setInputText(msg.text);
                    }} 
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 border ${
                      theme === 'dark' 
                        ? 'bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30 hover:bg-[#00ff9d]/20' 
                        : 'bg-black text-white border-transparent hover:bg-gray-800'
                    }`} 
                    title="Regenerate"
                  >
                    <RefreshCw size={12} /> <span>Retry</span>
                  </button>
                )}
                {msg.text.length > 200 && (
                  <button onClick={() => {
                    if (!user) { setModals((prev: any) => ({...prev, signIn: true})); return; }
                    const hasProAccess = user.role === 'admin' || user.plan === 'pro' || user.plan === 'business_pro';
                    if (!hasProAccess) {
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
            null
          )}
        </div>

        {/* User Message Actions positioned inline underneath user bubbles (avoids layout overlap completely) */}
        {!isAI && (
          <div className="flex items-center gap-2 mt-2 px-1 animate-fadeIn">
            <button 
              onClick={() => handleEdit ? handleEdit(i) : setInputText(msg.text)} 
              className={`px-3 py-1.5 rounded-xl text-[10px] md:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 ${
                theme === 'dark' 
                  ? 'bg-[#222] text-gray-300 hover:bg-[#333] hover:text-white border border-[#333]' 
                  : 'bg-white text-gray-700 hover:bg-gray-100 hover:text-black border border-gray-200 shadow'
              }`} 
              title="Edit Message"
            >
              <Edit2 size={12} /> <span>Edit</span>
            </button>
            <button 
              onClick={() => copyToClipboard(msg.text)} 
              className={`px-3 py-1.5 rounded-xl text-[10px] md:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 ${
                theme === 'dark' 
                  ? 'bg-[#222] text-gray-300 hover:bg-[#333] hover:text-white border border-[#333]' 
                  : 'bg-white text-gray-700 hover:bg-gray-100 hover:text-black border border-gray-200 shadow'
              }`} 
              title="Copy"
            >
              <Copy size={12} /> <span>Copy</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export const ChatMessage = React.memo(ChatMessageComponent);
