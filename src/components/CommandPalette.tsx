import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Terminal, MessageSquare, Mic, Image as ImageIcon, 
  Folder, Book, Settings, Key, Command, Moon, Sun, 
  PlusCircle, RefreshCw, Trash2, BookOpen, HardDrive, Play 
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  description: string;
  shortcut?: string;
  icon: React.ComponentType<any>;
  onSelect: () => void;
  category: 'Navigation' | 'Actions' | 'Settings';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  setView: (view: any) => void;
  resetMessages: () => void;
  toggleAutoScroll: () => void;
  triggerDeepDive: () => void;
  selectedFiles: { name: string; data: string }[];
  onViewFile?: (file: { data: string; name: string }) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  setView,
  resetMessages,
  toggleAutoScroll,
  triggerDeepDive,
  selectedFiles,
  onViewFile,
}) => {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when loaded
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const commandItems: CommandItem[] = [
    {
      id: 'g-chat',
      title: 'Go to Neural Chat',
      description: 'Open conversational assistant',
      shortcut: 'G + C',
      icon: MessageSquare,
      category: 'Navigation',
      onSelect: () => { setView('chat'); onClose(); }
    },
    {
      id: 'g-ide',
      title: 'Go to Neural Sandbox (IDE)',
      description: 'Write, edit, and compile full stack apps',
      shortcut: 'G + I',
      icon: Terminal,
      category: 'Navigation',
      onSelect: () => { setView('ide'); onClose(); }
    },
    {
      id: 'g-voice',
      title: 'Go to Voice AI Call',
      description: 'Start live call voice stream screen',
      shortcut: 'G + V',
      icon: Mic,
      category: 'Navigation',
      onSelect: () => { setView('voice'); onClose(); }
    },
    {
      id: 'g-imagine',
      title: 'Go to Imagine Studio',
      description: 'Generate beautiful images with AI model',
      shortcut: 'G + M',
      icon: ImageIcon,
      category: 'Navigation',
      onSelect: () => { setView('imagine'); onClose(); }
    },
    {
      id: 'g-xer0',
      title: 'Go to Xer0byteLM Notebook',
      description: 'Connect sources and construct deep dive summaries',
      shortcut: 'G + N',
      icon: BookOpen,
      category: 'Navigation',
      onSelect: () => { setView('notebook'); onClose(); }
    },
    {
      id: 'action-new',
      title: 'Start Fresh Conversation',
      description: 'Clear chat memory logs and establish new link',
      shortcut: 'Ctrl + R',
      icon: PlusCircle,
      category: 'Actions',
      onSelect: () => { resetMessages(); setView('home'); onClose(); }
    },
    {
      id: 'action-deepdive',
      title: 'Generate Deep Dive Summary',
      description: 'Analyze all uploaded active sources instantly',
      shortcut: 'Ctrl + D',
      icon: RefreshCw,
      category: 'Actions',
      onSelect: () => { triggerDeepDive(); onClose(); }
    },
    {
      id: 'settings-theme',
      title: 'Toggle Color Theme',
      description: theme === 'dark' ? 'Switch to Clean Light Theme' : 'Switch to Cyber Dark Theme',
      shortcut: 'T + M',
      icon: theme === 'dark' ? Sun : Moon,
      category: 'Settings',
      onSelect: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); }
    },
    {
      id: 'settings-autoscroll',
      title: 'Toggle Autoscroll',
      description: 'Automatically view latest message on arrivals',
      icon: Settings,
      category: 'Settings',
      onSelect: () => { toggleAutoScroll(); onClose(); }
    }
  ];

  // Append files as command components for quick workspace previews
  const fileItems: CommandItem[] = selectedFiles.map((file, idx) => ({
    id: `file-${idx}`,
    title: `Preview: ${file.name}`,
    description: 'Jump inside text/code viewer parser',
    shortcut: undefined,
    icon: Folder,
    category: 'Actions' as const,
    onSelect: () => {
      if (onViewFile) onViewFile(file);
      onClose();
    }
  }));

  const allFilteredItems = [...commandItems, ...fileItems].filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  // Keyboard navigation inside popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % allFilteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + allFilteredItems.length) % allFilteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allFilteredItems[activeIndex]) {
          allFilteredItems[activeIndex].onSelect();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, allFilteredItems, onClose]);

  // Adjust activeIndex if search filters items
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] px-4">
          {/* Blur Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Dialog Body */}
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`w-full max-w-xl rounded-2xl border shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col ${
              theme === 'dark' 
                ? 'bg-black/95 border-[#222] text-white shadow-[#00ff9d]/5' 
                : 'bg-white border-[#e2e8f0] text-gray-900'
            }`}
          >
            {/* Search input bar */}
            <div className={`flex items-center gap-3 px-4 py-3.5 border-b ${
              theme === 'dark' ? 'border-[#222] bg-white/5' : 'border-gray-100 bg-gray-50'
            }`}>
              <Search size={20} className="opacity-45" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search synced workspace files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-none outline-none focus:ring-0 text-sm placeholder:opacity-50"
              />
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-black/10 dark:bg-white/5 font-mono opacity-50">
                ESC
              </span>
            </div>

            {/* Results Grid List */}
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar py-2">
              {allFilteredItems.length === 0 ? (
                <div className="py-12 text-center text-xs opacity-40 italic">
                  No matching neural commands or workspace resources detected...
                </div>
              ) : (
                <div>
                  {/* Categories layout */}
                  {['Navigation', 'Actions', 'Settings'].map(cat => {
                    const categoryItems = allFilteredItems.filter(item => item.category === cat);
                    if (categoryItems.length === 0) return null;

                    return (
                      <div key={cat} className="mb-2">
                        <div className="px-4 py-1.5 text-[10px] uppercase font-black tracking-widest opacity-40">
                          {cat}
                        </div>
                        {categoryItems.map(item => {
                          const idxInFullList = allFilteredItems.indexOf(item);
                          const isActive = idxInFullList === activeIndex;

                          return (
                            <div
                              key={item.id}
                              onClick={item.onSelect}
                              onMouseEnter={() => setActiveIndex(idxInFullList)}
                              className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-all ${
                                isActive 
                                  ? (theme === 'dark' ? 'bg-[#00ff9d]/10 text-white' : 'bg-black/5 text-black')
                                  : 'opacity-75 hover:opacity-100'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-4">
                                <div className={`p-1.5 rounded-lg shrink-0 transition-all ${
                                  isActive 
                                    ? (theme === 'dark' ? 'text-[#00ff9d] bg-[#00ff9d]/5' : 'bg-black text-white')
                                    : 'opacity-65'
                                }`}>
                                  <item.icon size={16} />
                                </div>
                                <div className="text-left min-w-0">
                                  <div className="text-xs font-bold leading-none truncate">{item.title}</div>
                                  <div className="text-[10px] opacity-50 mt-1 truncate">{item.description}</div>
                                </div>
                              </div>

                              {item.shortcut && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 transition-opacity ${
                                  isActive ? 'opacity-90' : 'opacity-40'
                                } ${theme === 'dark' ? 'bg-white/10' : 'bg-black/5'}`}>
                                  {item.shortcut}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick tips bar */}
            <div className={`px-4 py-2 text-[10px] opacity-40 font-mono flex justify-between items-center border-t select-none ${
              theme === 'dark' ? 'border-[#222]' : 'border-gray-100'
            }`}>
              <span>Use Arrow keys ↑↓ & Enter</span>
              <span>Open anywhere: Ctrl+K / ⌘+K</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
