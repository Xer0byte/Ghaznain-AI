import React, { useMemo } from 'react';
import { X, Check } from 'lucide-react';

interface DiffViewerModalProps {
  isOpen: boolean;
  oldCode: string;
  newCode: string;
  originalPrompt: string;
  theme: 'dark' | 'light';
  onAccept: () => void;
  onReject: () => void;
}

export function DiffViewerModal({
  isOpen,
  oldCode,
  newCode,
  originalPrompt,
  theme,
  onAccept,
  onReject
}: DiffViewerModalProps) {
  if (!isOpen) return null;

  const diffLines = useMemo(() => {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    
    // Grid for LCS
    const m = oldLines.length;
    const n = newLines.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    const diff: { 
      type: 'normal' | 'added' | 'removed'; 
      oldLine?: string; 
      newLine?: string; 
      oldNo?: number; 
      newNo?: number; 
    }[] = [];
    
    let i = m;
    let j = n;
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        diff.unshift({ type: 'normal', oldLine: oldLines[i - 1], newLine: newLines[j - 1], oldNo: i, newNo: j });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diff.unshift({ type: 'added', newLine: newLines[j - 1], newNo: j });
        j--;
      } else {
        diff.unshift({ type: 'removed', oldLine: oldLines[i - 1], oldNo: i });
        i--;
      }
    }
    
    return diff;
  }, [oldCode, newCode]);

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
        onClick={onReject} 
      />

      {/* Panel */}
      <div className={`relative w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden border flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0a0a0a] border-[#222]' : 'bg-white border-[#e5e7eb]'}`}>
        
        {/* Header */}
        <div className={`p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 ${isDark ? 'border-[#1a1a1a] bg-[#111]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2 mb-1">
               <span className="text-[10px] font-black uppercase tracking-widest text-[#00ff9d] bg-[#00ff9d]/10 px-2.5 py-1 rounded-full border border-[#00ff9d]/20">Code sandbox</span>
               <span className="text-xs font-mono opacity-50">Proposed Overwrite Modification</span>
             </div>
             <h2 className="text-lg md:text-xl font-bold truncate">Review Code Upgrades</h2>
             <p className="text-xs opacity-60 mt-1 font-mono italic max-w-3xl truncate-none whitespace-normal">Prompt: "{originalPrompt}"</p>
          </div>
          <button 
            onClick={onReject}
            className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#222]' : 'hover:bg-gray-100'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Diff content screen */}
        <div className="flex-1 overflow-auto p-4 md:p-6 font-mono text-xs select-text">
          <div className="min-w-[800px] border rounded-2xl overflow-hidden divide-y divide-transparent">
            {/* Column Headers */}
            <div className={`grid grid-cols-2 text-xs font-bold divide-x ${isDark ? 'bg-[#121212] text-gray-400 border-[#1a1a1a] divide-[#1a1a1a]' : 'bg-gray-100 text-gray-500 border-gray-200 divide-gray-200'}`}>
              <div className="p-3">ORIGINAL CONSOLE CODE</div>
              <div className="p-3">AI REWRITTEN CODE PROPOSAL</div>
            </div>

            {/* List of lines */}
            <div className={`flex flex-col overflow-y-auto h-[50vh] ${isDark ? 'bg-black text-gray-300' : 'bg-white text-gray-800'}`}>
              {diffLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-2 divide-x divide-transparent hover:bg-neutral-500/5 transition-all">
                  
                  {/* Left Column (Original file) */}
                  <div className={`flex items-start font-mono text-xs p-1 ${
                    line.type === 'removed' ? 'bg-red-500/15 text-red-500 border-l-[3px] border-red-500 font-semibold' : 'opacity-85'
                  }`}>
                    <span className="w-10 text-right pr-3 font-mono opacity-30 select-none border-r border-[#222] mr-3 truncate shrink-0">
                      {line.oldNo || ''}
                    </span>
                    <span className="shrink-0 w-4 font-bold select-none text-red-500/60 mr-1">
                      {line.type === 'removed' ? '-' : ''}
                    </span>
                    <pre className="whitespace-pre flex-1 select-all overflow-x-auto selection:bg-red-500/30">
                      {line.type !== 'added' ? (line.oldLine || ' ') : ''}
                    </pre>
                  </div>

                  {/* Right Column (AI Modified proposal) */}
                  <div className={`flex items-start font-mono text-xs p-1 ${
                    line.type === 'added' ? 'bg-[#00ff9d]/15 text-[#00ff9d] border-l-[3px] border-[#00ff9d] font-semibold' : 'opacity-85'
                  }`}>
                    <span className="w-10 text-right pr-3 font-mono opacity-30 select-none border-r border-[#222] mr-3 truncate shrink-0">
                      {line.newNo || ''}
                    </span>
                    <span className="shrink-0 w-4 font-bold select-none text-[#00ff9d]/60 mr-1">
                      {line.type === 'added' ? '+' : ''}
                    </span>
                    <pre className="whitespace-pre flex-1 select-all overflow-x-auto selection:bg-[#00ff9d]/30">
                      {line.type !== 'removed' ? (line.newLine || ' ') : ''}
                    </pre>
                  </div>

                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Action Bottom Tray */}
        <div className={`p-6 border-t flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 ${isDark ? 'border-[#1a1a1a] bg-[#111]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="opacity-60">Red shows deletions.</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#00ff9d] ml-2 font-semibold"></span>
            <span className="opacity-60">Green shows upgrades.</span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={onReject}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all hover:bg-red-500/10 hover:text-red-500 active:scale-95 ${isDark ? 'bg-transparent border-[#333] text-gray-400' : 'bg-transparent border-gray-300 text-gray-600'}`}
            >
              Discard Proposed Changes
            </button>
            <button
              onClick={onAccept}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-blue-500/10 ${isDark ? 'bg-[#00ff9d] text-black hover:bg-white hover:neural-glow' : 'bg-black text-white hover:bg-gray-800'}`}
            >
              <Check size={14} strokeWidth={3} /> Merge Code Upgrades
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}