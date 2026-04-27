import React, { useState } from 'react';
import { Book, Save, Trash2, Edit2 } from 'lucide-react';

export default function NotebookUI({ theme }: { theme?: string }) {
  const [notes, setNotes] = useState<{id: number, title: string, content: string}[]>([
    { id: 1, title: 'Ideas', content: 'Explore quantum algorithms.' }
  ]);
  const [activeNote, setActiveNote] = useState<number>(1);

  const isDark = theme === 'dark';

  return (
    <div className={`flex h-full rounded-2xl overflow-hidden border ${isDark ? 'bg-[#111] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
      <div className={`w-1/3 border-r flex flex-col ${isDark ? 'border-[#333] bg-[#1a1a1a]' : 'border-[#ddd] bg-[#f9f9f9]'}`}>
        <div className={`p-4 border-b font-bold flex justify-between items-center ${isDark ? 'border-[#333]' : 'border-[#ddd]'}`}>
          <span className="flex items-center gap-2"><Book size={16} /> Notebooks</span>
          <button 
            onClick={() => {
               const newId = Date.now();
               setNotes([...notes, { id: newId, title: 'New Note', content: '' }]);
               setActiveNote(newId);
            }}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
          >
             <Edit2 size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notes.map(n => (
            <div 
              key={n.id}
              onClick={() => setActiveNote(n.id)}
              className={`p-4 border-b cursor-pointer transition-colors ${isDark ? 'border-[#333] hover:bg-[#222]' : 'border-[#ddd] hover:bg-[#f0f0f0]'} ${activeNote === n.id ? (isDark ? 'bg-[#222] border-l-2 border-l-[#00ff9d]' : 'bg-[#eee] border-l-2 border-l-[#00ff9d]') : ''}`}
            >
              <div className="font-medium truncate">{n.title}</div>
              <div className="text-xs opacity-50 truncate mt-1">{n.content || 'Empty note...'}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {notes.find(n => n.id === activeNote) ? (
          <>
            <input 
              value={notes.find(n => n.id === activeNote)?.title || ''}
              onChange={e => setNotes(notes.map(n => n.id === activeNote ? { ...n, title: e.target.value } : n))}
              className={`p-4 text-xl font-bold border-b outline-none bg-transparent ${isDark ? 'border-[#333]' : 'border-[#ddd]'}`}
              placeholder="Note Title"
            />
            <textarea
              value={notes.find(n => n.id === activeNote)?.content || ''}
              onChange={e => setNotes(notes.map(n => n.id === activeNote ? { ...n, content: e.target.value } : n))}
              className="flex-1 p-4 outline-none resize-none bg-transparent"
              placeholder="Start writing your thoughts here..."
            />
            <div className={`p-3 border-t flex justify-end ${isDark ? 'border-[#333]' : 'border-[#ddd]'}`}>
              <button 
                onClick={() => {
                  setNotes(notes.filter(n => n.id !== activeNote));
                  setActiveNote(notes[0]?.id || 0);
                }}
                className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} /> Delete Note
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center opacity-50">
            Select or create a note to start editing
          </div>
        )}
      </div>
    </div>
  );
}
