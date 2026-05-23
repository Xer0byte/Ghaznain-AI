import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, ChevronRight, Folder, FolderOpen, 
  FileText, Image as ImageIcon, FileSpreadsheet, FileCode, 
  Trash2, Terminal, HelpCircle, FileDigit, Play 
} from 'lucide-react';

interface WorkspaceFile {
  name: string;
  type: 'image' | 'pdf' | 'spreadsheet' | 'docx' | 'text' | 'code' | 'other';
  source: 'chat' | 'sandbox' | 'generated';
  data?: string;
  index: number;
}

interface WorkspaceFileTreeProps {
  selectedFiles: { data: string; mimeType: string; name: string }[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<{ data: string; mimeType: string; name: string }[]>>;
  ideSelectedFiles: { data: string; mimeType: string; name: string }[];
  setIdeSelectedFiles: React.Dispatch<React.SetStateAction<{ data: string; mimeType: string; name: string }[]>>;
  extractedFiles?: { path: string; content: string }[];
  theme: 'light' | 'dark';
  onViewFile?: (file: { data: string; name: string }) => void;
  onSendToSandbox?: (filename: string, content: string) => void;
}

export const WorkspaceFileTree: React.FC<WorkspaceFileTreeProps> = ({
  selectedFiles,
  setSelectedFiles,
  ideSelectedFiles,
  setIdeSelectedFiles,
  extractedFiles = [],
  theme,
  onViewFile,
  onSendToSandbox,
}) => {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    chat: true,
    sandbox: true,
    generated: true,
  });

  const toggleFolder = (folderId: string) => {
    setOpenFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const getFileIcon = (file: WorkspaceFile) => {
    const iconSize = 14;
    switch (file.type) {
      case 'image':
        return <ImageIcon size={iconSize} className="text-emerald-400" />;
      case 'spreadsheet':
        return <FileSpreadsheet size={iconSize} className="text-green-500" />;
      case 'code':
        return <FileCode size={iconSize} className="text-blue-400" />;
      case 'text':
        return <FileText size={iconSize} className="text-gray-400" />;
      case 'pdf':
        return <FileDigit size={iconSize} className="text-red-400" />;
      default:
        return <FileText size={iconSize} className="text-amber-400" />;
    }
  };

  const determineFileType = (name: string, mime?: string): WorkspaceFile['type'] => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) return 'image';
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) return 'spreadsheet';
    if (['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'python', 'py', 'sh'].includes(ext || '')) return 'code';
    if (['txt', 'md'].includes(ext || '')) return 'text';
    if (ext === 'pdf') return 'pdf';
    return 'other';
  };

  // Build list of active chat files
  const chatFiles: WorkspaceFile[] = selectedFiles.map((f, idx) => ({
    name: f.name,
    type: determineFileType(f.name, f.mimeType),
    source: 'chat',
    data: f.data,
    index: idx,
  }));

  // Build list of sandbox files
  const sandboxFiles: WorkspaceFile[] = ideSelectedFiles.map((f, idx) => ({
    name: f.name,
    type: determineFileType(f.name, f.mimeType),
    source: 'sandbox',
    data: f.data,
    index: idx,
  }));

  // Build list of generated code block workspace files
  const virtualFiles: WorkspaceFile[] = extractedFiles.map((f, idx) => ({
    name: f.path,
    type: determineFileType(f.path),
    source: 'generated',
    data: f.content,
    index: idx,
  }));

  const handleDelete = (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.source === 'chat') {
      setSelectedFiles(prev => prev.filter((_, i) => i !== file.index));
    } else if (file.source === 'sandbox') {
      setIdeSelectedFiles(prev => prev.filter((_, i) => i !== file.index));
    }
  };

  const handleFileClick = (file: WorkspaceFile) => {
    if (onViewFile && file.data) {
      onViewFile({ data: file.data, name: file.name });
    }
  };

  const hasFiles = chatFiles.length > 0 || sandboxFiles.length > 0 || virtualFiles.length > 0;

  return (
    <div className={`mt-3 p-3 rounded-xl border flex flex-col gap-2 font-sans select-none ${
      theme === 'dark' ? 'bg-[#111] border-[#222]' : 'bg-[#fafafa] border-[#e2e8f0]'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Terminal size={14} className={theme === 'dark' ? 'text-[#00ff9d]' : 'text-blue-500'} />
          <span className="text-[11px] font-black uppercase tracking-widest leading-none">Workspace Files</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5 font-mono opacity-60">
          Tree
        </span>
      </div>

      {!hasFiles ? (
        <div className="text-[10px] opacity-40 text-center py-3 leading-tight italic">
          No files in catalog.<br />Upload a file to start synced grounding.
        </div>
      ) : (
        <div className="space-y-2 text-[12px] overflow-y-auto max-h-[160px] custom-scrollbar">
          {/* FOLDER: Active Chat Files */}
          {chatFiles.length > 0 && (
            <div>
              <div 
                onClick={() => toggleFolder('chat')}
                className={`flex items-center gap-1.5 py-1 px-1 rounded-md cursor-pointer transition-colors ${
                  theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'
                }`}
              >
                {openFolders.chat ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {openFolders.chat ? <FolderOpen size={13} className="text-yellow-500" /> : <Folder size={13} className="text-yellow-500" />}
                <span className="font-semibold truncate">Active Chat Files ({chatFiles.length})</span>
              </div>
              
              <AnimatePresence>
                {openFolders.chat && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pl-4 space-y-0.5 overflow-hidden"
                  >
                    {chatFiles.map((file) => (
                      <div 
                        key={`chat-${file.index}-${file.name}`}
                        onClick={() => handleFileClick(file)}
                        className={`group/file flex items-center justify-between py-1 px-2 rounded-md cursor-pointer transition-colors ${
                          theme === 'dark' ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-black/5 text-gray-700'
                        }`}
                        title="Click to preview file contents"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          {getFileIcon(file)}
                          <span className="truncate max-w-[130px]">{file.name}</span>
                        </div>
                        <button 
                          onClick={(e) => handleDelete(file, e)}
                          className="opacity-0 group-hover/file:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-500 text-gray-500 transition-all shrink-0"
                          title="Remove attachment"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* FOLDER: Neural Sandbox Attachments */}
          {sandboxFiles.length > 0 && (
            <div>
              <div 
                onClick={() => toggleFolder('sandbox')}
                className={`flex items-center gap-1.5 py-1 px-1 rounded-md cursor-pointer transition-colors ${
                  theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'
                }`}
              >
                {openFolders.sandbox ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {openFolders.sandbox ? <FolderOpen size={13} className="text-violet-500" /> : <Folder size={13} className="text-violet-500" />}
                <span className="font-semibold truncate">Sandbox Files ({sandboxFiles.length})</span>
              </div>
              
              <AnimatePresence>
                {openFolders.sandbox && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pl-4 space-y-0.5 overflow-hidden"
                  >
                    {sandboxFiles.map((file) => (
                      <div 
                        key={`sandbox-${file.index}-${file.name}`}
                        onClick={() => handleFileClick(file)}
                        className={`group/file flex items-center justify-between py-1 px-2 rounded-md cursor-pointer transition-colors ${
                          theme === 'dark' ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-black/5 text-gray-700'
                        }`}
                        title="Click to preview sandbox file"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          {getFileIcon(file)}
                          <span className="truncate max-w-[130px]">{file.name}</span>
                        </div>
                        <button 
                          onClick={(e) => handleDelete(file, e)}
                          className="opacity-0 group-hover/file:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-500 text-gray-500 transition-all shrink-0"
                          title="Remove from sandbox"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* FOLDER: Extracted Chat Code blocks */}
          {virtualFiles.length > 0 && (
            <div>
              <div 
                onClick={() => toggleFolder('generated')}
                className={`flex items-center gap-1.5 py-1 px-1 rounded-md cursor-pointer transition-colors ${
                  theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'
                }`}
              >
                {openFolders.generated ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {openFolders.generated ? <FolderOpen size={13} className="text-emerald-500" /> : <Folder size={13} className="text-emerald-500" />}
                <span className="font-semibold truncate">AI Code Output ({virtualFiles.length})</span>
              </div>
              
              <AnimatePresence>
                {openFolders.generated && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pl-4 space-y-0.5 overflow-hidden"
                  >
                    {virtualFiles.map((file) => (
                      <div 
                        key={`gen-${file.index}-${file.name}`}
                        className={`group/file flex items-center justify-between py-1 px-2 rounded-md transition-colors ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          {getFileIcon(file)}
                          <span className="truncate max-w-[110px]" title={file.name}>{file.name}</span>
                        </div>
                        {onSendToSandbox && file.data && (
                          <button 
                            onClick={() => onSendToSandbox(file.name, file.data || '')}
                            className="p-1 rounded hover:bg-[#00ff9d]/20 text-[#00ff9d] hover:text-[#00ff9d] transition-all shrink-0"
                            title="Open inside Neural Sandbox IDE"
                          >
                            <Play size={10} className="fill-current" />
                          </button>
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
