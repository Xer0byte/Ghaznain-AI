import re

with open('src/components/ChatMessage.tsx', 'r') as f:
    content = f.read()

replacement_download_btn = """  const showDownloadButton = useMemo(() => {
    return isAI && extractedFiles.length > 0;
  }, [isAI, extractedFiles]);"""

content = re.sub(r'const showDownloadButton = useMemo\(\(\) => \{.*?\}, \[isAI, extractedFiles, msg\.text\]\);', replacement_download_btn, content, flags=re.DOTALL)

replacement_ui = """              {showDownloadButton && (
                <div className={`my-6 flex flex-col gap-3`}>
                  <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-[#00ff9d]/10 text-[#00ff9d]' : 'bg-black/5 text-black'}`}>
                        <FolderArchive size={24} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">Project / Files Ready</h4>
                        <p className="text-[10px] opacity-50 font-medium">{extractedFiles.length} files generated.</p>
                      </div>
                    </div>
                    {extractedFiles.length > 1 && (
                      <button 
                        onClick={handleDownloadProject}
                        disabled={isZipping}
                        className={`w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
                      >
                        {isZipping ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        {isZipping ? 'Processing...' : 'Download ZIP'}
                      </button>
                    )}
                  </div>
                  
                  {/* Individual Files List */}
                  <div className="flex flex-col gap-2">
                    {extractedFiles.map((f: any, idx: number) => (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-white border-gray-200'} shadow-sm`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`p-1.5 rounded-md ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                            <FileIcon size={16} className="opacity-70" />
                          </div>
                          <span className="text-sm font-medium truncate">{f.path}</span>
                        </div>
                        <button 
                          onClick={() => {
                            const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = f.path.split('/').pop() || f.path;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          }}
                          className={`p-2 rounded-md transition-all active:scale-95 ${theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-black'}`}
                          title="Download File"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}"""

content = re.sub(r'\{showDownloadButton && \(\s*<div className=\{`my-6 p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4.*?</button>\s*</div>\s*\)\}', replacement_ui, content, flags=re.DOTALL)

with open('src/components/ChatMessage.tsx', 'w') as f:
    f.write(content)
