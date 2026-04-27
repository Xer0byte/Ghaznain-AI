import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare, Mic, Image as ImageIcon, Folder, Clock, Settings, X, Plus, Send, Book, Menu, HardDrive, Edit2, Pin, Trash2, MoreVertical, Lock, Check, ChevronDown, Wrench, PenTool, Music, BookOpen, Copy, Share, RefreshCw, ThumbsUp, ThumbsDown, Volume2, Activity, MapPin, Eye, EyeOff, UserPlus, Play, Paperclip } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { auth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, db } from './firebase';
import { firestoreService } from './services/firestoreService';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';

import VoiceAI from './components/VoiceAI';
import CursorTrailCanvas from './components/CursorTrailCanvas';
import NotebookUI from './components/NotebookUI';

const ParticleBackground = ({ theme }: { theme: 'dark' | 'light' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    let animationFrameId: number;

    const mouse = { x: null as number | null, y: null as number | null, down: false };

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleMouseDown = () => (mouse.down = true);
    const handleMouseUp = () => (mouse.down = false);
    const handleMouseOut = () => { mouse.x = null; mouse.y = null; };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseout', handleMouseOut);

    class Node {
      x: number; y: number; ox: number; oy: number; vx: number; vy: number; r: number;
      constructor() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.ox = this.x;
        this.oy = this.y;
        this.vx = 0;
        this.vy = 0;
        this.r = Math.random() * 2.0 + 0.7;
      }
      update() {
        if (mouse.x !== null && mouse.y !== null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let d = Math.hypot(dx, dy);
          if (d < 260) {
            let f = (260 - d) / 260;
            let p = mouse.down ? f * 16 : f * 1.2;
            this.vx -= dx * p * 0.18;
            this.vy -= dy * p * 0.18;
          }
        }
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.96;
        this.vy *= 0.96;
        this.x += (this.ox - this.x) * 0.005;
        this.y += (this.oy - this.y) * 0.005;
      }
      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
        ctx.fill();
      }
    }

    const nodeCount = window.innerWidth < 768 ? 20 : 40;
    const nodes = Array.from({ length: nodeCount }, () => new Node());

    const animate = () => {
      if (!ctx) return;
      ctx.fillStyle = theme === 'dark' ? '#000000' : '#f0f0f0';
      ctx.fillRect(0, 0, w, h);
      
      nodes.forEach(n => {
        n.update();
        n.draw();
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[i].x - nodes[j].x;
          let dy = nodes[i].y - nodes[j].y;
          let d = Math.hypot(dx, dy);
          if (d < 160) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = theme === 'dark' ? 'rgba(180,180,180,0.12)' : 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseout', handleMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10" />;
};

const MemoizedMarkdown = React.memo(({ content, theme }: { content: string, theme: string }) => (
  <Markdown 
    remarkPlugins={[remarkGfm]}
    components={{
      code({node, inline, className, children, ...props}: any) {
        const match = /language-(\w+)/.exec(className || '')
        return !inline && match ? (
          <div className="relative group/code my-4 rounded-xl overflow-hidden border border-[#333]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] text-xs text-[#888] border-b border-[#333]">
              <span>{match[1]}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <Copy size={12} /> Copy code
              </button>
            </div>
            <SyntaxHighlighter
              {...props}
              children={String(children).replace(/\n$/, '')}
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              customStyle={{ margin: 0, padding: '1rem', background: '#111' }}
            />
          </div>
        ) : (
          <code {...props} className={`${className} bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-md text-sm font-mono`}>
            {children}
          </code>
        )
      }
    }}
  >
    {content}
  </Markdown>
));

const CustomAlert = ({ message, onClose, theme }: { message: string, onClose: () => void, theme: string }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className={`w-full max-w-sm p-6 rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-[#1e1e1e] text-white' : 'bg-white text-black'}`}>
      <h3 className="text-lg font-bold mb-4">Notification</h3>
      <p className="mb-6 opacity-80">{message}</p>
      <div className="flex justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors font-medium">OK</button>
      </div>
    </div>
  </div>
);

const CustomConfirm = ({ message, onConfirm, onCancel, theme }: { message: string, onConfirm: () => void, onCancel: () => void, theme: string }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className={`w-full max-w-sm p-6 rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-[#1e1e1e] text-white' : 'bg-white text-black'}`}>
      <h3 className="text-lg font-bold mb-4">Confirm Action</h3>
      <p className="mb-6 opacity-80 whitespace-pre-wrap">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className={`px-4 py-2 rounded-xl border transition-colors font-medium ${theme === 'dark' ? 'border-[#444] hover:bg-[#333]' : 'border-[#ccc] hover:bg-[#eee]'}`}>Cancel</button>
        <button onClick={() => { onConfirm(); onCancel(); }} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors font-medium">Confirm</button>
      </div>
    </div>
  </div>
);

const AdminPanel = ({ token, theme }: { token: string | null, theme: string }) => {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});
  const [pendingSubscriptions, setPendingSubscriptions] = useState<any[]>([]);
  const [selectedAdminUser, setSelectedAdminUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'users' | 'conversations' | 'locations' | 'photos'>('overview');
  const [adminConvSearchDate, setAdminConvSearchDate] = useState('');

  useEffect(() => {
    if (!token) return;
    
    const unsubUsers = firestoreService.subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
      setStats((prev: any) => ({
        ...prev,
        userCount: allUsers.length,
        messageCount: allUsers.reduce((sum, u) => sum + (u.messageCount || 0), 0)
      }));
    });

    const unsubSubscriptions = firestoreService.subscribeToAllUpgradeRequests((requests) => {
      // We need to join with user data to show names
      setPendingSubscriptions(requests);
    });

    return () => {
      unsubUsers();
      unsubSubscriptions();
    };
  }, [token]);

  const fetchConvMessages = async (convId: string) => {
    // This is complex as we don't have the userId for any random convId easily here
    // but the admin view of conversations usually comes from a user.
    // For now, let's skip deep message fetching unless a user is selected.
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await firestoreService.updateUserProfile(userId, { role: newRole });
      setAlertModal({ isOpen: true, message: `User role updated to ${newRole}` });
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleUpdatePlan = async (userId: string, newPlan: string) => {
    try {
      await firestoreService.updateUserProfile(userId, { plan: newPlan });
      setAlertModal({ isOpen: true, message: `User plan updated to ${newPlan}` });
    } catch (error) {
      console.error("Failed to update plan:", error);
    }
  };

  const handleResetMessages = async (userId: string) => {
    try {
      await firestoreService.updateUserProfile(userId, { messageCount: 0 });
      setAlertModal({ isOpen: true, message: "User message count reset." });
    } catch (error) {
      console.error("Failed to reset messages:", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setConfirmModal({
      isOpen: true,
      message: "Are you sure you want to delete this user? This cannot be undone.",
      onConfirm: async () => {
        // Deleting user from Auth is not possible from client SDK easily without admin SDK
        // But we can mark them as deleted in Firestore.
        try {
          await firestoreService.updateUserProfile(userId, { isDeleted: true });
          setAlertModal({ isOpen: true, message: "User marked as deleted." });
        } catch (error) {
          console.error("Failed to delete user:", error);
        }
      }
    });
  };

  const loadConversation = async (id: string) => {
    // Fetch messages for a specific conversation
    // We'd need the owner's userId. If we have it in the conversation doc, we can subscribe.
    setSelectedConv(id);
    // Placeholder as we need the owner userId for messages subscription
  };

  const handleSubscription = async (userId: string, action: 'approve' | 'reject', requestId: string, plan: string) => {
    try {
      await firestoreService.handleSubscriptionAdmin(userId, requestId, action, plan);
      setAlertModal({ isOpen: true, message: `Subscription ${action}ed successfully.` });
    } catch (error) {
       console.error("Failed to handle subscription:", error);
       setAlertModal({ isOpen: true, message: `Failed to ${action} subscription.` });
    }
  };

  return (
    <div className={`w-full max-w-6xl mx-auto p-4 md:p-8 pt-20 md:pt-24 h-full flex flex-col ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
      {alertModal.isOpen && <CustomAlert message={alertModal.message} theme={theme} onClose={() => setAlertModal({isOpen: false, message: ''})} />}
      {confirmModal.isOpen && <CustomConfirm message={confirmModal.message} theme={theme} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} />}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h2>
        <div className={`flex flex-wrap rounded-lg p-1 ${theme === 'dark' ? 'bg-[#111]' : 'bg-[#e0e0e0]'}`}>
          <button onClick={() => setActiveTab('overview')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'overview' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}>Overview</button>
          <button onClick={() => setActiveTab('users')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'users' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}>Users</button>
          <button onClick={() => setActiveTab('conversations')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'conversations' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}>Conversations</button>
          <button onClick={() => setActiveTab('locations')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'locations' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}><MapPin size={14} /> Locations</button>
          <button onClick={() => setActiveTab('photos')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'photos' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}>Photos</button>
          <button onClick={() => setActiveTab('subscriptions')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'subscriptions' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}>
            Subs
            {pendingSubscriptions.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingSubscriptions.length}</span>
            )}
          </button>
        </div>
      </div>
      
      {activeTab === 'overview' && (
        <>
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              <div className={`p-4 md:p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
                <div className="text-xs md:text-sm opacity-70 mb-2">Total Users</div>
                <div className="text-2xl md:text-4xl font-black">{stats.userCount}</div>
              </div>
              <div className={`p-4 md:p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
                <div className="text-xs md:text-sm opacity-70 mb-2">Total Cons</div>
                <div className="text-2xl md:text-4xl font-black">{stats.conversationCount}</div>
              </div>
              <div className={`p-4 md:p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
                <div className="text-xs md:text-sm opacity-70 mb-2">Total Messages</div>
                <div className="text-2xl md:text-4xl font-black">{stats.messageCount}</div>
              </div>
              <div className={`p-4 md:p-6 rounded-2xl border bg-gradient-to-br ${theme === 'dark' ? 'from-[#222] to-[#111] border-[#444]' : 'from-[#f5f5f5] to-white border-[#ddd]'}`}>
                <div className="text-xs md:text-sm opacity-70 mb-2 flex items-center gap-2"><Activity size={14}/> System Perf</div>
                {stats.performance ? (
                  <div className="space-y-1">
                    <div className="text-sm font-bold">Mem: {stats.performance.memoryUsedMB} MB / {stats.performance.totalMemoryMB} MB</div>
                    <div className="text-xs opacity-80">Avg Output: {stats.performance.avgOutputLength} chars</div>
                  </div>
                ) : (
                  <div className="text-sm opacity-50">Loading...</div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
            <div className={`w-full lg:w-1/4 flex flex-col rounded-2xl border overflow-hidden max-h-[300px] lg:max-h-none ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
              <div className={`p-4 font-bold border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>Users</div>
              <div className="flex-1 overflow-y-auto">
                <div 
                  onClick={() => { setSelectedAdminUser(null); setSelectedConv(null); }}
                  className={`p-4 border-b cursor-pointer transition-colors ${theme === 'dark' ? 'border-[#333] hover:bg-[#222]' : 'border-[#ddd] hover:bg-[#f5f5f5]'} ${selectedAdminUser === null ? (theme === 'dark' ? 'bg-[#222]' : 'bg-[#f5f5f5]') : ''}`}
                >
                  <div className="font-medium text-sm md:text-base">All Users</div>
                </div>
                {users.map(u => (
                  <div 
                    key={u._id} 
                    onClick={() => { setSelectedAdminUser(u._id); setSelectedConv(null); }}
                    className={`p-4 border-b cursor-pointer transition-colors ${theme === 'dark' ? 'border-[#333] hover:bg-[#222]' : 'border-[#ddd] hover:bg-[#f5f5f5]'} ${selectedAdminUser === u._id ? (theme === 'dark' ? 'bg-[#222]' : 'bg-[#f5f5f5]') : ''}`}
                  >
                    <div className="font-medium mb-1 text-sm md:text-base">{u.name}</div>
                    <div className="text-xs opacity-60 truncate">{u.email}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`w-full lg:w-1/4 flex flex-col rounded-2xl border overflow-hidden max-h-[300px] lg:max-h-none ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
              <div className={`p-4 font-bold border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>Conversations</div>
              <div className="flex-1 overflow-y-auto">
                {conversations.filter(c => selectedAdminUser ? c.userId?._id === selectedAdminUser : true).map(conv => (
                  <div 
                    key={conv._id} 
                    onClick={() => loadConversation(conv._id)}
                    className={`p-4 border-b cursor-pointer transition-colors ${theme === 'dark' ? 'border-[#333] hover:bg-[#222]' : 'border-[#ddd] hover:bg-[#f5f5f5]'} ${selectedConv === conv._id ? (theme === 'dark' ? 'bg-[#222]' : 'bg-[#f5f5f5]') : ''}`}
                  >
                    <div className="font-medium mb-1 text-sm md:text-base truncate flex items-center gap-2">
                      {conv.isPrivate && <Lock size={12} className="text-purple-500 shrink-0" />}
                      {conv.title}
                    </div>
                    <div className="text-xs opacity-60">User: {conv.userId?.name}</div>
                    <div className="text-xs opacity-60 mt-1">{new Date(conv.updatedAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`w-full lg:w-2/4 flex flex-col rounded-2xl border overflow-hidden ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
              <div className={`p-4 font-bold border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
                {selectedConv ? 'Chat History' : 'Select a conversation'}
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4">
                {selectedConv ? convMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-[#e0e0e0] text-black') : (theme === 'dark' ? 'bg-transparent text-white' : 'bg-transparent text-black')}`}>
                      <div className="text-xs opacity-50 mb-1">{msg.role === 'user' ? 'User' : 'AI'} - {new Date(msg.timestamp).toLocaleString()}</div>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex items-center justify-center opacity-50">
                    Click a conversation to view messages
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'conversations' && (
        <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col lg:flex-row ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
          <div className={`w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r flex flex-col max-h-[300px] lg:max-h-none ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
            <div className={`p-4 font-bold border-b flex flex-col gap-3 ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
              <div>All Conversations</div>
              <div className={`flex items-center px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#f5f5f5] border-[#ccc]'}`}>
                <Search size={14} className="opacity-50 mr-2" />
                <input
                  type="date"
                  value={adminConvSearchDate}
                  onChange={(e) => setAdminConvSearchDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full"
                />
                {adminConvSearchDate && (
                  <button onClick={() => setAdminConvSearchDate('')} className="ml-2 opacity-50 hover:opacity-100">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const filtered = conversations.filter(conv => {
                  if (!adminConvSearchDate) return true;
                  const convDate = new Date(conv.createdAt || conv.updatedAt).toISOString().split('T')[0];
                  return convDate === adminConvSearchDate;
                });
                
                return (
                  <>
                    {adminConvSearchDate && (
                      <div className={`p-2 text-xs text-center border-b ${theme === 'dark' ? 'border-[#333] text-gray-400' : 'border-[#ddd] text-gray-500'}`}>
                        Found {filtered.length} conversation{filtered.length !== 1 ? 's' : ''} on this date.
                      </div>
                    )}
                    {filtered.map(conv => (
                      <div 
                        key={conv._id} 
                        onClick={() => fetchConvMessages(conv._id)}
                        className={`p-4 border-b cursor-pointer transition-colors ${theme === 'dark' ? 'border-[#222] hover:bg-[#222]' : 'border-[#eee] hover:bg-[#f5f5f5]'} ${selectedConv === conv._id ? (theme === 'dark' ? 'bg-[#222]' : 'bg-[#f5f5f5]') : ''}`}
                      >
                        <div className="font-medium truncate text-sm md:text-base flex items-center gap-2">
                          {conv.isPrivate && <Lock size={12} className="text-purple-500 shrink-0" />}
                          {conv.title}
                        </div>
                        <div className="text-xs opacity-50 mt-1 flex justify-between gap-2">
                          <span className="truncate">User: {conv.userId?.name || (typeof conv.userId === 'string' ? conv.userId.substring(0, 8) : 'Unknown')}</span>
                          <span className="shrink-0">{new Date(conv.createdAt || conv.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="w-full lg:w-2/3 flex flex-col flex-1 min-h-0">
            {selectedConv ? (
              <>
                <div className={`p-4 font-bold border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>Messages</div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                  {convMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] md:max-w-[80%] p-3 rounded-2xl text-sm md:text-base ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : (theme === 'dark' ? 'bg-[#222] text-white rounded-tl-sm' : 'bg-[#f0f0f0] text-black rounded-tl-sm')}`}>
                        <div className="text-[10px] opacity-50 mb-1 uppercase tracking-wider">{msg.role}</div>
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      </div>
                    </div>
                  ))}
                  {convMessages.length === 0 && (
                    <div className="text-center opacity-50 mt-10">No messages in this conversation.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center opacity-50 p-8 text-center text-sm md:text-base">
                Select a conversation to view messages
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
          <div className={`p-4 md:p-6 font-bold border-b text-base md:text-lg ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>Manage Users</div>
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'bg-[#1a1a1a] text-[#888] border-[#333]' : 'bg-[#f5f5f5] text-[#666] border-[#ddd]'} border-b`}>
                  <th className="p-4 font-medium">User Profile</th>
                  <th className="p-4 font-medium">Plan & Stats</th>
                  <th className="p-4 font-medium">Location Tracking</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {users.map(u => (
                  <tr key={u.id} className={`${theme === 'dark' ? 'divide-[#333] border-[#333] hover:bg-[#1a1a1a]' : 'divide-[#ddd] border-[#ddd] hover:bg-[#f9f9f9]'} transition-colors`}>
                    <td className="p-4 align-top w-[25%]">
                      <div className="flex items-center gap-3">
                        {u.profilePhoto ? (
                          <img src={u.profilePhoto} alt={u.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shrink-0 border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shrink-0" style={{ backgroundColor: u.avatarColor }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-base flex items-center gap-2">
                            <span className="truncate">{u.name}</span>
                            {u.role === 'admin' && <span className="bg-purple-500/20 text-purple-500 text-[10px] px-2 py-0.5 rounded-full uppercase">Admin</span>}
                          </div>
                          <div className="text-xs opacity-70 truncate">{u.email}</div>
                          <div className="text-[10px] opacity-40 mt-1 font-mono">{u.id}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 align-top w-[15%]">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase opacity-70">Plan:</span>
                          <strong className="text-xs uppercase bg-[#00ff9d]/10 text-[#00ff9d] px-2 py-0.5 rounded border border-[#00ff9d]/20 tracking-wide">{u.plan}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase opacity-70">Msgs:</span>
                          <span className="text-sm font-bold">{u.messageCount}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 align-top w-[35%]">
                      {/* Location UI remains same but uses u.id */}
                    </td>

                    <td className="p-4 align-middle text-right w-[25%]">
                      <div className="flex flex-col gap-2 w-[140px] ml-auto">
                        <select 
                          value={u.role} 
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          className={`text-xs px-2 py-1.5 rounded-lg border outline-none cursor-pointer hover:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-[#222] border-[#444] text-white' : 'bg-white border-[#ccc] text-black'}`}
                        >
                          <option value="user">Role: User</option>
                          <option value="admin">Role: Admin</option>
                        </select>
                        <select 
                          value={u.plan} 
                          onChange={(e) => handleUpdatePlan(u.id, e.target.value)}
                          className={`text-xs px-2 py-1.5 rounded-lg border outline-none cursor-pointer hover:border-[#00ff9d] transition-colors ${theme === 'dark' ? 'bg-[#222] border-[#444] text-white' : 'bg-white border-[#ccc] text-black'}`}
                        >
                          <option value="free">Plan: Free</option>
                          <option value="lite">Plan: Lite</option>
                          <option value="pro">Plan: Pro</option>
                          <option value="business_lite">Business Lite</option>
                          <option value="business_pro">Business Pro</option>
                        </select>
                        <div className="flex gap-2 mt-1">
                          <button 
                            onClick={() => handleResetMessages(u.id)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${theme === 'dark' ? 'bg-[#333] hover:bg-[#444] text-white' : 'bg-[#e0e0e0] hover:bg-[#d0d0d0] text-black'}`}
                          >
                            Reset
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'locations' && (
        <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
          <div className={`p-4 md:p-6 font-bold border-b text-base md:text-lg flex justify-between items-center ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
            <span>User Location Tracking</span>
            <span className="text-xs md:text-sm font-normal opacity-70">Track live IP & Geocoding</span>
          </div>
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'bg-[#1a1a1a] text-[#888] border-[#333]' : 'bg-[#f5f5f5] text-[#666] border-[#ddd]'} border-b`}>
                  <th className="p-4 font-medium">User Details</th>
                  <th className="p-4 font-medium">Signup Location</th>
                  <th className="p-4 font-medium">Last Active / Exact Location</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {users.map(u => (
                  <tr key={u._id + '-loc'} className={`${theme === 'dark' ? 'divide-[#333] border-[#333] hover:bg-[#1a1a1a]' : 'divide-[#ddd] border-[#ddd] hover:bg-[#f9f9f9]'} transition-colors`}>
                    <td className="p-4 align-top w-[30%] border-r border-dashed border-[#333]/20 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        {u.profilePhoto ? (
                          <img src={u.profilePhoto} alt={u.name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: u.avatarColor }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold truncate text-base">{u.name}</div>
                          <div className="text-xs opacity-70 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 align-top w-[35%]">
                      {u.signupLocation ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="font-medium text-sm truncate flex items-center gap-1.5"><MapPin size={12} className="opacity-50" /> {u.signupLocation.city}, {u.signupLocation.country}</div>
                          <div className="text-[10px] uppercase tracking-wider opacity-60 font-mono pl-4">{u.signupLocation.ip}</div>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.signupLocation.city + ', ' + u.signupLocation.country)}`} target="_blank" rel="noreferrer" className={`mt-1 py-1.5 px-3 w-fit rounded-lg flex items-center gap-1 text-xs font-semibold transition-colors ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                            Open in Maps
                          </a>
                        </div>
                      ) : (
                        <div className="text-sm opacity-50 flex items-center gap-2 italic"><MapPin size={12}/> Unknown Region</div>
                      )}
                    </td>
                    <td className="p-4 align-top w-[35%]">
                      <div className="flex flex-col gap-4">
                        {u.lastLocation ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="text-[10px] uppercase font-bold text-green-500 tracking-wider">Last Activity Context</div>
                            <div className="font-medium text-sm text-green-500 truncate flex items-center gap-1.5">{u.lastLocation.city}, {u.lastLocation.country}</div>
                            <div className="text-[10px] opacity-60 font-mono">{u.lastLocation.ip}</div>
                          </div>
                        ) : (
                          <div className="text-sm opacity-50 italic">No recent activity</div>
                        )}

                        {u.exactLocation && (
                          <div className={`mt-2 p-3 rounded-xl border ${theme === 'dark' ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
                            <div className="text-[10px] uppercase font-bold text-red-500 tracking-wider mb-1 flex items-center gap-1"><MapPin size={10} /> Exact GPS Coordinates</div>
                            <div className="font-mono text-xs text-red-500 mb-2">{u.exactLocation.lat.toFixed(4)}, {u.exactLocation.lon.toFixed(4)}</div>
                            <a href={`https://www.google.com/maps?q=${u.exactLocation.lat},${u.exactLocation.lon}`} target="_blank" rel="noreferrer" className={`py-1 px-2.5 w-fit rounded-md flex items-center gap-1 text-[10px] font-bold uppercase transition-colors ${theme === 'dark' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                              Open Pin
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'photos' && (
        <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
          <div className={`p-4 md:p-6 font-bold border-b text-base md:text-lg flex justify-between items-center ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
            <span>User Profile Photos</span>
            <span className="text-xs md:text-sm font-normal opacity-70">View all users with photo</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 content-start">
            {users.filter(u => u.profilePhoto).map(u => (
              <div key={u._id} className={`flex flex-col items-center p-4 rounded-xl border ${theme === 'dark' ? 'border-[#333] bg-[#1a1a1a]' : 'border-[#ddd] bg-[#f9f9f9]'}`}>
                <img src={u.profilePhoto} alt={u.name} className="w-20 h-20 rounded-full object-cover mb-3 border-2 border-[#00ff9d]" />
                <div className="font-bold text-sm text-center truncate w-full">{u.name}</div>
                <div className="text-[10px] opacity-60 text-center font-mono mt-1 break-all w-full leading-tight">ID: {u._id}</div>
              </div>
            ))}
            {users.filter(u => u.profilePhoto).length === 0 && (
              <div className="col-span-full opacity-50 text-center py-10 flex flex-col items-center justify-center">
                <div className="text-4xl mb-4">📸</div>
                No users have uploaded a profile photo yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
          <div className={`p-4 md:p-6 font-bold border-b text-base md:text-lg ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>Pending Upgrades</div>
          <div className="flex-1 overflow-auto p-0">
            {pendingSubscriptions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 p-8 text-center">
                 <div className="text-4xl mb-4 text-[#00ff9d]">✓</div>
                 <div>No pending subscriptions.</div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'bg-[#1a1a1a] text-[#888] border-[#333]' : 'bg-[#f5f5f5] text-[#666] border-[#ddd]'} border-b`}>
                    <th className="p-4 font-medium">User Information</th>
                    <th className="p-4 font-medium">Upgrade Request</th>
                    <th className="p-4 font-medium">Payment Details</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {pendingSubscriptions.map(request => {
                    const reqUser = users.find(u => u.id === request.userId);
                    return (
                    <tr key={request.id} className={`${theme === 'dark' ? 'divide-[#333] border-[#333] hover:bg-[#1a1a1a]' : 'divide-[#ddd] border-[#ddd] hover:bg-[#f9f9f9]'} transition-colors`}>
                      
                      <td className="p-4 align-top w-[25%] border-r border-dashed border-[#333]/20 dark:border-white/10">
                        <div className="font-bold text-base md:text-lg truncate">{reqUser?.name || 'Unknown'}</div>
                        <div className="text-xs opacity-70 truncate">{reqUser?.email || request.userId}</div>
                        <div className="text-[10px] bg-black/10 dark:bg-white/10 inline-block px-1.5 py-0.5 rounded mt-1 font-mono">{request.userId}</div>
                      </td>

                      <td className="p-4 align-top w-[25%]">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] md:text-xs opacity-60">Current:</span>
                            <span className="uppercase font-bold text-xs">{reqUser?.plan || 'free'}</span>
                          </div>
                          <div className="text-xl opacity-30 leading-none">↓</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] md:text-xs opacity-60">Requested:</span>
                            <span className="text-xs font-bold text-[#00ff9d] bg-[#00ff9d]/10 px-2 py-0.5 rounded border border-[#00ff9d]/20 uppercase">{request.plan?.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 align-top w-[30%]">
                        {(request.paymentPhone || request.paymentMethod || request.paymentProof) ? (
                          <div className="flex items-start gap-4">
                            {request.paymentProof && (
                              <a href={request.paymentProof} target="_blank" rel="noreferrer" className="shrink-0 block w-16 h-16 rounded-lg overflow-hidden border border-[#444] hover:border-[#00ff9d] transition-colors group relative">
                                <img src={request.paymentProof} alt="Proof" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span className="text-[10px] font-bold text-white uppercase">View</span></div>
                              </a>
                            )}
                            <div className="flex flex-col gap-1">
                              <div className="text-xs">
                                <span className="opacity-70 text-[10px] uppercase tracking-widest font-bold">Method:</span> <span className="font-bold capitalize">{request.paymentMethod || 'N/A'}</span>
                              </div>
                              <div className="text-xs">
                                <span className="opacity-70 text-[10px] uppercase tracking-widest font-bold">Account:</span> <span className="font-bold">{request.paymentPhone || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs opacity-50 italic">No payment details provided.</div>
                        )}
                      </td>

                      <td className="p-4 align-middle text-right w-[20%]">
                        <div className="flex flex-col gap-2 w-[120px] ml-auto">
                          <button onClick={() => handleSubscription(request.userId, 'approve', request.id, request.plan)} className="w-full py-2 rounded-lg font-bold bg-gradient-to-r from-[#00ff9d] to-[#00b8ff] text-black hover:opacity-90 transition-opacity text-xs shadow-lg shadow-[#00ff9d]/20">Approve</button>
                          <button onClick={() => handleSubscription(request.userId, 'reject', request.id, request.plan)} className="w-full py-2 rounded-lg font-bold bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-xs border border-red-500/20">Reject</button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  console.log("App component starting...");
  const handleGoogleSuccess = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setModals(prev => ({ ...prev, signIn: false, signUp: false }));
    } catch (err: any) {
      console.error("Google Auth Error Detail:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        let msg = err.message || 'Google login failed';
        if (err.code === 'auth/unauthorized-domain') {
          msg = "Security Fix Required: You must add this domain to 'Authorized Domains' in your Firebase Console -> Auth -> Settings.";
        } else if (err.code === 'auth/popup-blocked') {
          msg = "Your browser blocked the login popup. Please click 'Open Tab' above or enable popups for this site.";
        } else if (err.code === 'auth/cancelled-popup-request') {
          msg = "Login request was cancelled. Please wait a moment and try again.";
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/configuration-not-found') {
          msg = "Firebase Config Error: Please verify your API Key and ensure Google Login is enabled in Firebase Console.";
        }
        setAuthError(msg);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('xer0byteTheme');
    return (saved as 'dark' | 'light') || 'dark';
  });
  const [view, setView] = useState<'home' | 'chat' | 'history' | 'imagine' | 'voice' | 'projects' | 'xer0bytepedia' | 'admin' | 'ide' | 'notebook'>(() => {
    const saved = localStorage.getItem('xer0byteView');
    return (saved as any) || 'home';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});
  const [messages, setMessages] = useState<{id?: number, role: 'user' | 'ai', text: string, imageUrl?: string, audioUrl?: string, videoUrl?: string}[]>([]);
  const [conversations, setConversations] = useState<{id: string, title: string, updated_at: string, created_at?: string, isPinned?: boolean}[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    return localStorage.getItem('xer0byteCurrentConvId') || null;
  });
  const [isPrivateChat, setIsPrivateChat] = useState(() => {
    return localStorage.getItem('xer0bytePrivateChat') === 'true';
  });
  const [inputText, setInputText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const COMMON_COMMANDS = [
    "/code Write a Python script to...",
    "/fix Fix this error in my code: ",
    "/explain Explain how this works: ",
    "/translate Translate this to Urdu: ",
    "/summarize Summarize this text: ",
    "Write a React component that...",
    "How do I fix a CORS error?",
    "Create a responsive Tailwind layout for...",
    "Explain quantum computing simply.",
    "Write a SQL query to..."
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (val.trim().length > 0) {
      const filtered = COMMON_COMMANDS.filter(cmd => cmd.toLowerCase().includes(val.toLowerCase()));
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputText(suggestion);
    setShowSuggestions(false);
  };
  const [isFetching, setIsFetching] = useState(true);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const [selectedFiles, setSelectedFiles] = useState<{data: string, mimeType: string, name: string}[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('xer0byteSelectedModel') || 'fast';
  });
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState('');
  const [canvasOutput, setCanvasOutput] = useState('');
  const [canvasLanguage, setCanvasLanguage] = useState('python');
  const [isCanvasRunning, setIsCanvasRunning] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'edit' | 'split'>('edit');
  const [canvasLiveWeb, setCanvasLiveWeb] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasActiveProjectId, setCanvasActiveProjectId] = useState<string | null>(null);
  
  const [idePrompt, setIdePrompt] = useState("");
  const [isThinkingIde, setIsThinkingIde] = useState(false);
  const [ideSelectedFiles, setIdeSelectedFiles] = useState<{data: string, mimeType: string, name: string}[]>([]);
  const [isListeningIde, setIsListeningIde] = useState(false);
  const ideFileInputRef = useRef<HTMLInputElement>(null);

  const [extendedThinking, setExtendedThinking] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(() => {
    return localStorage.getItem('xer0byteWebSearch') === 'true';
  });
  const [usedSearchThisTurn, setUsedSearchThisTurn] = useState(false);
  const [persona, setPersona] = useState<'standard' | 'fun' | 'concise'>(() => {
    const saved = localStorage.getItem('xer0bytePersona');
    return (saved as any) || 'standard';
  });
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [isMicMenuOpen, setIsMicMenuOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'dictation' | 'chat'>('dictation');
  const [searchQuery, setSearchQuery] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [useXer0byteStyle, setUseXer0byteStyle] = useState(() => {
    const saved = localStorage.getItem('xer0byteStyle');
    return saved !== null ? saved === 'true' : true;
  });
  const [recentGenerations, setRecentGenerations] = useState<string[]>([]);
  
  // Xer0byteLM States
  const [lmSources, setLmSources] = useState<{id: string, name: string, content: string, type: string}[]>([]);
  const [lmMessages, setLmMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [lmInput, setLmInput] = useState("");
  const [lmAudioUrl, setLmAudioUrl] = useState<string | null>(null);
  const [isGeneratingLmAudio, setIsGeneratingLmAudio] = useState(false);
  const [isLmThinking, setIsLmThinking] = useState(false);
  const [lmNotes, setLmNotes] = useState<{id: string, text: string}[]>([]);
  const lmFileInputRef = useRef<HTMLInputElement>(null);
  
  const [projects, setProjects] = useState<{id?: string, _id?: string, name: string, description: string, content: string}[]>([]);
  const [tasks, setTasks] = useState<{id?: string, _id?: string, title: string, completed: boolean}[]>([]);
  
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [activeConvMenu, setActiveConvMenu] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [user, setUser] = useState<{id: string, name: string, email: string, avatarColor: string, profilePhoto?: string, role?: string, plan?: string, messageCount?: number, storageUsed?: number} | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const getExactLocation = (): Promise<{lat: number, lon: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 1500, enableHighAccuracy: false }
      );
    });
  };
  
  const [modals, setModals] = useState({
    signIn: false,
    signUp: false,
    settings: false,
    manageAccount: false,
    userMenu: false,
    tasks: false,
    createProject: false,
    upgradePro: false
  });

  const [upgradeStep, setUpgradeStep] = useState<'plans' | 'payment'>('plans');
  const [selectedPlanToUpgrade, setSelectedPlanToUpgrade] = useState<'lite' | 'pro' | 'business_lite' | 'business_pro'>('pro');
  const [planTab, setPlanTab] = useState<'individual' | 'business'>('individual');
  const [paymentFormState, setPaymentFormState] = useState({ phone: '', method: 'easypaisa', proof: '' });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [currency, setCurrency] = useState<'USD' | 'PKR'>('USD');
  const [hasAcceptedCookies, setHasAcceptedCookies] = useState(() => localStorage.getItem('xer0byteCookies') === 'true');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleAcceptCookies = () => {
    localStorage.setItem('xer0byteCookies', 'true');
    setHasAcceptedCookies(true);
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsFetching(true);
      if (firebaseUser) {
        console.log("Firebase user detected:", firebaseUser.email);
        try {
          // Fetch or create user profile in Firestore
          let profile = await firestoreService.getUserProfile(firebaseUser.uid);
          if (!profile) {
            profile = await firestoreService.createUserProfile(firebaseUser.uid, {
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email,
              profilePhoto: firebaseUser.photoURL,
              avatarColor: "#" + Math.floor(Math.random()*16777215).toString(16)
            });
          } else {
            // Update last active
            await firestoreService.updateUserProfile(firebaseUser.uid, {});
          }
          
          const userData = {
            id: firebaseUser.uid,
            name: profile.name,
            email: profile.email,
            avatarColor: profile.avatarColor || "#" + Math.floor(Math.random()*16777215).toString(16),
            profilePhoto: profile.profilePhoto,
            role: profile.role || 'user',
            plan: profile.plan || 'free',
            messageCount: profile.messageCount || 0,
            subscriptionStatus: profile.subscriptionStatus || 'none'
          };
          
          setUser(userData as any);
          setToken("firebase-session"); 
          localStorage.setItem('xer0byteUser', JSON.stringify(userData));
        } catch (err) {
          console.error("Error during profile sync:", err);
        }
      } else {
        console.log("No Firebase user (logged out)");
        // Check if we have a demo user session active
        const localUserStr = localStorage.getItem('xer0byteUser');
        const localUser = localUserStr ? JSON.parse(localUserStr) : null;
        if (localUser && localUser.id.startsWith('demo-user')) {
          console.log("Maintaining demo user session");
          setUser(localUser);
          setToken("demo-session");
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('xer0byteUser');
          localStorage.removeItem('xer0byteToken');
        }
      }
      setIsFetching(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Karachi') {
      setCurrency('PKR');
    }
  }, []);

  const prices = {
    lite: { USD: 9, PKR: 2500 },
    pro: { USD: 18, PKR: 5000 },
    business_lite: { USD: 90, PKR: 25000 },
    business_pro: { USD: 180, PKR: 50000 }
  };

  const [settings, setSettingsState] = useState(() => {
    try {
      const saved = localStorage.getItem('xer0byteSettings');
      return saved ? JSON.parse(saved) : {
        wrapCode: false,
        autoScroll: true,
        sidebarEditor: false,
        notifyThinking: true,
        cmdEnter: false,
        richText: true,
        autoVideo: false,
        improveModel: false,
        personalize: true,
        linkSharing: true,
        nsfw: false,
        responseStyle: 'custom'
      };
    } catch (e) {
      console.error('Failed to parse settings', e);
      return {
        wrapCode: false,
        autoScroll: true,
        sidebarEditor: false,
        notifyThinking: true,
        cmdEnter: false,
        richText: true,
        autoVideo: false,
        improveModel: false,
        personalize: true,
        linkSharing: true,
        nsfw: false,
        responseStyle: 'custom'
      };
    }
  });

  useEffect(() => {
    localStorage.setItem('xer0byteTheme', theme);
    localStorage.setItem('xer0byteView', view);
    if (currentConversationId) {
      localStorage.setItem('xer0byteCurrentConvId', currentConversationId);
    } else {
      localStorage.removeItem('xer0byteCurrentConvId');
    }
    localStorage.setItem('xer0byteSelectedModel', selectedModel);
    localStorage.setItem('xer0bytePersona', persona);
    localStorage.setItem('xer0byteWebSearch', String(useWebSearch));
    localStorage.setItem('xer0byteStyle', String(useXer0byteStyle));
    localStorage.setItem('xer0bytePrivateChat', String(isPrivateChat));
    localStorage.setItem('xer0byteSettings', JSON.stringify(settings));
  }, [theme, view, currentConversationId, selectedModel, persona, useWebSearch, useXer0byteStyle, isPrivateChat, settings]);

  const toggleSetting = (key: keyof typeof settings) => {
    setSettingsState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    if (settings.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, settings.autoScroll]);


  const apiFetch = async (url: string, options: any = {}) => {
    // For AI generation, we still hit our server
    if (url.startsWith('/api/generate')) {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      return response;
    }
    
    // For everything else, we should be using firestoreService directly.
    // This is a safety fallback for any omitted migrations.
    console.warn(`Legacy apiFetch called for ${url}. This should be migrated to firestoreService.`);
    return new Response(JSON.stringify({ error: "Feature migrated to Firestore" }), { status: 404 });
  };

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }
    const unsubscribe = firestoreService.subscribeToConversations(user.id, (convs) => {
      setConversations(convs);
      if (convs.length > 0 && !currentConversationId) {
        setCurrentConversationId(convs[0].id);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const groupConversationsByDate = (convs: any[]) => {
    const groups: { [key: string]: any[] } = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Older': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    convs.forEach(conv => {
      const convDate = new Date(conv.created_at || conv.updated_at);
      convDate.setHours(0, 0, 0, 0);

      if (convDate.getTime() === today.getTime()) {
        groups['Today'].push(conv);
      } else if (convDate.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(conv);
      } else if (convDate.getTime() > lastWeek.getTime()) {
        groups['Previous 7 Days'].push(conv);
      } else {
        groups['Older'].push(conv);
      }
    });

    return groups;
  };

  const handleRunCode = async () => {
    if (!canvasContent.trim()) return;
    
    // For Web languages (HTML/CSS/JS combo), we render directly in an iframe
    if (['html', 'web', 'javascript-web'].includes(canvasLanguage.toLowerCase())) {
      setCanvasLiveWeb(true);
      setCanvasMode('split');
      return;
    }
    
    setCanvasLiveWeb(false);
    setCanvasMode('split');
    setIsCanvasRunning(true);
    setCanvasOutput(`Initializing Xer0byte Neural Execution Engine...
Compiling and executing ${canvasLanguage} code...`);
    
    try {
      const systemInstruction = `You are a strict, sandboxed code execution engine and compiler for ${canvasLanguage}.
Evaluate the provided code. Do NOT write explanations, markdown blocks, formatting, or conversational text.
If there are syntax errors or runtime exceptions, output the exact compiler/interpreter error message that a real terminal would show.
If the code is valid, simulate its execution and output ONLY the exact standard output (stdout) and standard error (stderr).
If the code expects user input, assume empty input or simulate a rational default.
Your response must only contain the raw terminal output. Return "Code executed successfully with no output." if the program produces absolutely no output.`;

      const aiResponse = await apiFetch('/api/generate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "chat", 
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: canvasContent }
          ]
        })
      });

      const data = await aiResponse.json();
      if (data.error) throw new Error(data.error);
      const out = data.choices?.[0]?.message?.content?.trim() || "Code executed successfully with no output.";
      setCanvasOutput(out);
    } catch (error: any) {
      setCanvasOutput("Fatal Execution Engine Error:\n" + error.message);
    } finally {
      setIsCanvasRunning(false);
    }
  };

  const handleRenameConv = async (id: string, newTitle: string) => {
    if (!newTitle.trim() || !user) {
      setEditingConvId(null);
      return;
    }
    try {
      await firestoreService.updateConversation(user.id, id, { title: newTitle });
      setEditingConvId(null);
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };

  const handleIdeSubmit = async () => {
    if (!idePrompt.trim()) return;
    
    // Check limits
    if (!user) {
      setModals(prev => ({ ...prev, signIn: true }));
      return;
    }
    
    // Extra security check for paid features
    if (user.role !== 'admin' && user.plan === 'free') {
      if (selectedModel === 'pro' || selectedModel === 'thinking' || extendedThinking) {
        setModals(prev => ({ ...prev, upgradePro: true }));
        return;
      }
    }

    setIsThinkingIde(true);
    let originalPrompt = idePrompt;
    setIdePrompt('');
    setIdeSelectedFiles([]);
    
    try {
      // Increment message count in Firestore
      await firestoreService.updateUserProfile(user.id, { messageCount: (user.messageCount || 0) + 1 });
      setUser(prev => prev ? { ...prev, messageCount: (prev.messageCount || 0) + 1 } : null);
      
      const systemInstruction = `You are an expert AI software engineer. The user is currently editing a ${canvasLanguage} file. 
Here is their current code:
<current_code>
${canvasContent}
</current_code>

The user will provide an instruction. You must return ONLY the full, updated code enclosed in a \`\`\`${canvasLanguage} Markdown block, without any conversational text or explanations. Do NOT describe your changes.`;

      let modelToUse = "gpt-4-turbo";
      
      const aiResponse = await apiFetch('/api/generate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "chat", 
          model: modelToUse,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: originalPrompt }
          ]
        })
      });

      const data = await aiResponse.json();
      if (data.error) throw new Error(data.error);
      let fullAiText = data.choices?.[0]?.message?.content || "";
      
      // Final extraction
      setCanvasContent(prev => {
        let finalContent = fullAiText;
        const codeMatch = finalContent.match(/```([a-z0-9#\-\+]+)?\n([\s\S]*?)```/i);
        if (codeMatch && codeMatch.length > 2) {
          if (codeMatch[1]) {
            const detectedLang = codeMatch[1].toLowerCase();
            const supportedLangs = ['html', 'javascript', 'typescript', 'python', 'java', 'csharp', 'php', 'ruby', 'go', 'swift', 'kotlin', 'dart', 'elixir', 'erlang', 'c', 'cpp', 'rust', 'zig', 'nim', 'd', 'ada', 'assembly', 'r', 'julia', 'sql', 'prolog', 'lisp', 'haskell', 'clojure', 'scala', 'ocaml', 'fsharp', 'bash', 'basic', 'cobol', 'crystal', 'fortran', 'groovy', 'lua', 'pascal', 'perl', 'brainfuck'];
            if (supportedLangs.includes(detectedLang)) setCanvasLanguage(detectedLang);
            else if (detectedLang === 'js') setCanvasLanguage('javascript');
            else if (detectedLang === 'ts') setCanvasLanguage('typescript');
            else if (detectedLang === 'py') setCanvasLanguage('python');
            else if (detectedLang === 'c++') setCanvasLanguage('cpp');
            else if (detectedLang === 'c#') setCanvasLanguage('csharp');
            else if (detectedLang === 'sh') setCanvasLanguage('bash');
          }
          return codeMatch[2];
        }
        const looseMatch = finalContent.match(/```[\s\S]*?```/g);
        if (looseMatch && looseMatch.length > 0) {
           return looseMatch.map(block => block.replace(/```[a-z]*\n/, '').replace(/```$/, '')).join('\n\n');
        }
        return finalContent;
      });

    } catch (error) {
      console.error("IDE AI failed", error);
      setAlertModal({ isOpen: true, message: "Failed to generate code." });
      setIdePrompt(originalPrompt);
    } finally {
      setIsThinkingIde(false);
    }
  };

  const handlePinConv = async (id: string, isPinned: boolean) => {
    if (!user) return;
    try {
      await firestoreService.updateConversation(user.id, id, { isPinned: !isPinned });
      setActiveConvMenu(null);
    } catch (error) {
      console.error("Failed to pin conversation:", error);
    }
  };

  const handleDeleteConv = async (id: string) => {
    if (!user) return;
    try {
      await firestoreService.deleteConversation(user.id, id);
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      setActiveConvMenu(null);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      setAlertModal({ isOpen: true, message: "Failed to delete conversation." });
    }
  };

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setTasks([]);
      return;
    }
    const unsubProjects = firestoreService.subscribeToProjects(user.id, (projs) => {
      setProjects(projs);
    });
    const unsubTasks = firestoreService.subscribeToTasks(user.id, (tsks) => {
      setTasks(tsks);
    });
    return () => {
      unsubProjects();
      unsubTasks();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !currentConversationId) {
      setMessages([]);
      setIsFetching(false);
      return;
    }
    const unsubscribe = firestoreService.subscribeToMessages(user.id, currentConversationId, (msgs) => {
      setMessages(msgs);
      setIsFetching(false);
    });
    return () => unsubscribe();
  }, [user, currentConversationId]);

  const handleSend = async (text: string = inputText, isVoiceResponse: boolean = false) => {
    if (!text.trim() && selectedFiles.length === 0) return;
    
    if (!user) {
      setModals(prev => ({ ...prev, signIn: true }));
      return;
    }

    if (view !== 'chat') {
      setView('chat');
    }
    
    // Extra security check for paid features
    if (user.role !== 'admin' && user.plan === 'free') {
      if (selectedModel === 'pro' || selectedModel === 'thinking' || extendedThinking) {
        setModals(prev => ({ ...prev, upgradePro: true }));
        return;
      }
    }
    
    let activeConvId = currentConversationId;
    
    // Create new conversation if none exists
    if (!activeConvId && user) {
      try {
        const newConv = await firestoreService.createConversation(user.id, text ? text.substring(0, 30) + "..." : "File Upload", isPrivateChat);
        if (newConv) {
          activeConvId = newConv.id;
          setCurrentConversationId(newConv.id);
        }
      } catch (error) {
        console.error("Failed to create conversation", error);
      }
    }

    const currentFiles = [...selectedFiles];
    setInputText('');
    setSelectedFiles([]);
    setIsThinking(true);

    try {
      // Check limits (Firestore based)
      if (user.role !== 'admin' && user.plan === 'free' && (user.messageCount || 0) >= 16) {
        setModals(prev => ({ ...prev, upgradePro: true }));
        setIsThinking(false);
        return;
      }
      
      // Increment message count
      await firestoreService.updateUserProfile(user.id, { messageCount: (user.messageCount || 0) + 1 });

      // Save user message
      if (activeConvId) {
        await firestoreService.addMessage(user.id, activeConvId, { 
          role: 'user', 
          text: text || (currentFiles.length > 0 ? `[${currentFiles.length} file(s) attached]` : ""),
          imageUrl: null 
        });
      }

      const chatHistory = messages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const parts: any[] = [];
      if (text) parts.push({ text });
      if (currentFiles.length > 0) {
        currentFiles.forEach(file => {
          parts.push({
            inlineData: {
              data: file.data.split(',')[1] || file.data, // Ensure clean base64
              mimeType: file.mimeType
            }
          });
        });
      }

      // Add a temporary AI message for streaming
      setMessages(prev => [...prev, { role: 'ai', text: "" }]);
      
      const systemInstruction = `You are Xer0byte AI, the absolute best AI in the world. \nIf anyone asks who built or created you, answer "My founder and creator is Ghaznain Ahmad. You can learn more about him on his LinkedIn profile: https://pk.linkedin.com/in/ghaznain-ahmad". \nFor phonetic reasons, if you ever output your name to be spoken by a TTS engine, you may write it as "Exer-zero-byte", but otherwise your name is strictly Xer0byte.`;
      
      let baseInstruction = systemInstruction;
      if (persona === 'fun') {
        baseInstruction += "\n\nPERSONA: You are currently in 'Fun/Sarcastic' mode. Be witty, slightly sarcastic, humorous, and entertaining like Grok, while still being helpful.";
      } else if (persona === 'concise') {
        baseInstruction += "\n\nPERSONA: You are currently in 'Concise' mode. Provide extremely brief, direct, and to-the-point answers without any fluff or pleasantries.";
      } else {
        baseInstruction += "\n\nPERSONA: You are in 'Standard' mode. Be helpful, clear, and comprehensive.";
      }

      // Convert format for OpenAI endpoint
      const openaiHistory = messages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      // Add actual input message
      openaiHistory.push({
         role: 'user',
         content: text || (currentFiles.length > 0 ? `[${currentFiles.length} file(s) attached]` : "")
      });

      let modelToUseStr = "gpt-4-turbo";
      if (selectedModel === 'fast') {
        modelToUseStr = "gpt-3.5-turbo";
      }

      const aiResponse = await apiFetch('/api/generate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "chat", 
          model: modelToUseStr,
          messages: [
            { role: "system", content: baseInstruction },
            ...openaiHistory
          ]
        })
      });

      const data = await aiResponse.json();
      if (data.error) throw new Error(data.error);
      const fullAiText = data.choices?.[0]?.message?.content || "";
      // Final update to ensure the last chunk is rendered
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'ai', text: fullAiText };
        return newMsgs;
      });

      // Check if the AI decided to generate an image, music, or video
      const imageMatch = fullAiText.match(/\[GENERATE_IMAGE:\s*(.*?)\]/i);
      const musicMatch = fullAiText.match(/\[GENERATE_MUSIC:\s*(.*?)\]/i);
      const videoMatch = fullAiText.match(/\[GENERATE_VIDEO:\s*(.*?)\]/i);
      
      if (imageMatch && imageMatch[1]) {
        const imagePrompt = imageMatch[1].trim();
        const remainingText = fullAiText.replace(/\[GENERATE_IMAGE:\s*(.*?)\]/i, '').trim();
        
        // Update UI to show generating status
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { role: 'ai', text: remainingText ? `${remainingText}\n\n🎨 Generating image...` : `🎨 Generating image...` };
          return newMsgs;
        });

        const finalPrompt = useXer0byteStyle 
          ? `${imagePrompt}, high quality, detailed, professional photography, cinematic lighting, 8k resolution, xer0byte style`
          : imagePrompt;

        const imgResponse = await apiFetch('/api/generate', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            type: "image", 
            model: "dall-e-3",
            messages: [{ role: "user", content: finalPrompt }]
          })
        });

        const imgData = await imgResponse.json();
        if (imgData.error) throw new Error(imgData.error);
        const imageUrl = imgData?.data?.[0]?.url;

        if (imageUrl) {
          const finalAiText = remainingText ? remainingText : `Here is the image you requested: "${imagePrompt}"`;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { role: 'ai', text: finalAiText, imageUrl };
            return newMsgs;
          });
          setRecentGenerations(prev => [imageUrl, ...prev].slice(0, 10));
          
          if (activeConvId) {
            await firestoreService.addMessage(user.id, activeConvId, { 
              role: 'ai', 
              text: finalAiText, 
              imageUrl 
            });
          }
        } else {
          throw new Error("Failed to generate image");
        }
      } else {
        // Normal text response
        let audioUrl: string | undefined = undefined;
        
        if (isVoiceResponse) {
          // You can implement OpenAI TTS feature here if needed.
           try {
             const ttsResponse = await apiFetch('/api/generate', {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ 
                 type: "tts", 
                 model: "tts-1",
                 input: fullAiText
               })
             });
             // ... placeholder for TTS
           } catch(e) {
               console.error("error in TTS ", e)
           }
        }

        if (activeConvId) {
          await firestoreService.addMessage(user.id, activeConvId, { 
            role: 'ai', 
            text: fullAiText,
            // audioUrl // Add this to firestoreService if needed
          });
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessage = error?.message || error?.toString() || "Unknown error";
      setMessages(prev => [...prev, { role: 'ai', text: `Oops, something went wrong. Error: ${errorMessage}. Please try again.` }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleGenerateImage = async () => {
    const prompt = inputText.trim();
    if (!prompt) return;
    if (!user) {
      setModals(prev => ({ ...prev, signIn: true }));
      return;
    }
    
    if (user.plan === 'free' && user.messageCount >= 16) {
      setAlertModal({ isOpen: true, message: "Message limit reached. Please wait 24 hours or upgrade to a Paid Plan to continue generating images." });
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImage(null);
    const finalPrompt = useXer0byteStyle 
      ? `${prompt}, high quality, detailed, professional photography, cinematic lighting, 8k resolution, xer0byte style`
      : prompt;

    try {
      const response = await apiFetch('/api/generate', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            type: "image", 
            model: "dall-e-3",
            messages: [{ role: "user", content: finalPrompt }]
          })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const imageUrl = data?.data?.[0]?.url;
      
      if (imageUrl) {
        setGeneratedImage(imageUrl);
        setRecentGenerations(prev => [imageUrl, ...prev].slice(0, 10));
      } else {
        setAlertModal({ isOpen: true, message: "Failed to generate image." });
      }
    } catch (error) {
      console.error("Image generation error:", error);
      setAlertModal({ isOpen: true, message: "Failed to generate image. Please try again." });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setConversations([]); // This will be repopulated by subscription
    setView('home');
    setUsedSearchThisTurn(false);
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    setConfirmModal({
      isOpen: true,
      message: "Are you sure you want to delete all conversations?",
      onConfirm: async () => {
        try {
          // Iterate through all conversations and delete them
          for (const conv of conversations) {
            await firestoreService.deleteConversation(user.id, conv.id);
          }
          setCurrentConversationId(null);
          setMessages([]);
          setModals(prev => ({ ...prev, settings: false }));
        } catch (error) {
          console.error("Failed to delete messages:", error);
        }
      }
    });
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      setAlertModal({ isOpen: true, message: 'Image must be less than 10MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        const size = Math.min(width, height);
        canvas.width = 250;
        canvas.height = 250;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, (img.width - size)/2, (img.height - size)/2, size, size, 0, 0, 250, 250);
          const compressedPhoto = canvas.toDataURL('image/jpeg', 0.85);

          try {
            await firestoreService.updateUserProfile(user.id, { profilePhoto: compressedPhoto });
            setAlertModal({ isOpen: true, message: 'Profile photo updated successfully!' });
          } catch (err) {
            setAlertModal({ isOpen: true, message: 'Error updating profile photo.' });
          }
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      await updateProfile(userCredential.user, { displayName: authForm.name });
      setModals(prev => ({ ...prev, signUp: false }));
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err: any) {
      let msg = err.message || 'Signup failed';
      if (err.code === 'auth/invalid-credential') {
        msg = "Invalid Firebase credentials. Please check your API Key and configuration.";
      }
      setAuthError(msg);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      setModals(prev => ({ ...prev, signIn: false }));
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err: any) {
      let msg = err.message || 'Login failed';
      if (err.code === 'auth/invalid-credential') {
        msg = "Invalid login credentials. Please check your email/password or Firebase configuration.";
      }
      setAuthError(msg);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setAlertModal({ isOpen: true, message: `Password reset email sent to ${user.email}. Please check your inbox.` });
    } catch (error: any) {
      setAlertModal({ isOpen: true, message: error.message || "Failed to send reset email." });
    }
  };

  const handleUpdateName = async () => {
    if (!user) return;
    const newName = prompt("Enter your new name:", user.name);
    if (newName && newName !== user.name) {
      try {
        await firestoreService.updateUserProfile(user.id, { name: newName });
        if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: newName });
        setUser(prev => prev ? { ...prev, name: newName } : null);
        setAlertModal({ isOpen: true, message: "Name updated successfully!" });
      } catch (error: any) {
        setAlertModal({ isOpen: true, message: "Failed to update name." });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Firebase signOut failed, forcing clean up:", err);
    }
    
    // Always clear local state to ensure 100% lockout
    setModals(prev => ({ ...prev, userMenu: false, manageAccount: false }));
    setView('home');
    setMessages([]);
    setConversations([]);
    setCurrentConversationId(null);
    chatRef.current = null;
    setUser(null);
    setToken(null);
    localStorage.removeItem('xer0byteUser');
    localStorage.removeItem('xer0byteToken');
    localStorage.removeItem('xer0byteCurrentConversationId');
  };

  const [projectForm, setProjectForm] = useState({ name: '', description: '', content: '' });
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await firestoreService.saveProject(user.id, projectForm);
      setModals(prev => ({ ...prev, createProject: false }));
      setProjectForm({ name: '', description: '', content: '' });
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const [taskTitle, setTaskTitle] = useState('');
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !taskTitle.trim()) return;
    try {
      await firestoreService.addTask(user.id, taskTitle);
      setTaskTitle('');
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (!user) return;
    try {
      await firestoreService.updateTask(user.id, taskId, !completed);
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startListening = async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (user && user.plan === 'free' && user.messageCount >= 16) {
      setAlertModal({ isOpen: true, message: "Message limit reached. Please wait 24 hours or upgrade to a Paid Plan to continue using Voice mode." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          setIsThinking(true);
          try {
            const whisperResponse = await apiFetch('/api/generate', {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ 
                 type: "transcribe", 
                 model: "whisper-1",
                 input: base64Audio,
                 mimeType: "audio/webm"
               })
             });
            const data = await whisperResponse.json();
            if (data.error) throw new Error(data.error);
            const transcript = data.text?.trim() || "";
            if (transcript) {
              if (voiceMode === 'chat') {
                setInputText('');
                setIsThinking(false); // Turn off transcription thinking, handleSend will manage its own
                handleSend(transcript, true);
              } else {
                setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
                setIsThinking(false);
              }
            } else {
              setIsThinking(false);
            }
          } catch (error) {
            console.error("Transcription error:", error);
            setAlertModal({ isOpen: true, message: "Failed to process audio." });
            setIsThinking(false);
          }
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (error) {
      console.error("Microphone access error:", error);
      setAlertModal({ isOpen: true, message: "Microphone access denied or not supported. Please allow microphone access in your browser settings." });
    }
  };

  const startListeningIde = async () => {
    if (isListeningIde) {
      mediaRecorderRef.current?.stop();
      setIsListeningIde(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsThinkingIde(true);
          try {
            const whisperResponse = await apiFetch('/api/generate', {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ 
                 type: "transcribe", 
                 model: "whisper-1",
                 input: base64Audio,
                 mimeType: "audio/webm"
               })
             });
            const data = await whisperResponse.json();
            if (data.error) throw new Error(data.error);
            const transcript = data.text?.trim() || "";
            if (transcript) setIdePrompt(prev => prev ? `${prev} ${transcript}` : transcript);
          } catch (error) {
            console.error("Transcription error:", error);
            setAlertModal({ isOpen: true, message: "Failed to process audio." });
          } finally {
            setIsThinkingIde(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListeningIde(true);
    } catch (error) {
      console.error("Microphone access error:", error);
      setAlertModal({ isOpen: true, message: "Microphone access denied." });
    }
  };

  const handleLmFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        if (file.size > 20 * 1024 * 1024) {
          setAlertModal({ isOpen: true, message: "File size exceeds 20MB limit for LM." });
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setLmSources(prev => [...prev, {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            content: (reader.result as string).split(',')[1],
            type: file.type || 'text/plain'
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleLmChatSubmit = async () => {
    if (!lmInput.trim() || isLmThinking) return;

    if (!user) {
      setModals(prev => ({ ...prev, signIn: true }));
      return;
    }

    const currentInput = lmInput;
    setLmMessages(prev => [...prev, { role: 'user', text: currentInput }]);
    setLmInput('');
    setIsLmThinking(true);

    try {
      const sourceParts = lmSources.map(s => {
        if (s.type.includes('image') || s.type.includes('pdf') || s.type.includes('audio')) {
          return { inlineData: { data: s.content, mimeType: s.type } };
        } else {
          try {
            return { text: `Source Document (${s.name}):\n${atob(s.content)}` };
          } catch {
            return { inlineData: { data: s.content, mimeType: s.type } };
          }
        }
      });

      const responseStream = await apiFetch('/api/generate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "chat", 
          model: "gpt-4-turbo",
          messages: [
            { role: "system", content: "You are Xer0byteLM. Use the provided sources to answer the user's queries accurately. If the information is not in the sources, say so cleanly." },
            ...lmMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
            { role: "user", content: `Context sources: ${sourceParts.map(s => s.text || '[Data]').join('\n')}\n\nUser query: ${currentInput}` }
          ]
        })
      });

      const data = await responseStream.json();
      if (data.error) throw new Error(data.error);
      const fullText = data.choices?.[0]?.message?.content || "";
      setLmMessages(prev => [...prev, { role: 'ai', text: fullText }]);
    } catch (e: any) {
      console.error(e);
      setLmMessages(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't process this query against the sources." }]);
    } finally {
      setIsLmThinking(false);
    }
  };

  const handleLmGenerateAudio = async () => {
    if (lmSources.length === 0) {
      setAlertModal({ isOpen: true, message: "Please upload sources first to generate a Deep Dive." });
      return;
    }
    
    setIsGeneratingLmAudio(true);
    try {
      const sourceParts = lmSources.map(s => {
        if (s.type.includes('image') || s.type.includes('pdf') || s.type.includes('audio')) {
          return { inlineData: { data: s.content, mimeType: s.type } };
        } else {
          try {
            return { text: `Source Document (${s.name}):\n${atob(s.content)}` };
          } catch {
            return { inlineData: { data: s.content, mimeType: s.type } };
          }
        }
      });

      // First generate the script
      const scriptRes = await apiFetch('/api/generate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "chat", 
          model: "gpt-4-turbo",
          messages: [
            { role: "system", content: "Create an engaging 1-minute podcast or deep dive transcript summarizing the key points of these sources. Just return the spoken text without speakers headers, so it can be directly converted to speech." },
            { role: "user", content: "Sources:\n" + sourceParts.map(s => s.text || "[Data]").join("\n") }
          ]
        })
      });

      const scriptData = await scriptRes.json();
      if (scriptData.error) throw new Error(scriptData.error);
      const scriptText = scriptData.choices?.[0]?.message?.content || "";

      // Then convert to speech using a free/mock text-to-speech mechanism since direct GCP TTS requires additional setup.
      // We will ask Gemini to provide a data URI for a mock if we had a live multimodal model, 
      // but without a live TTS API standard, we'll simulate the "Deep Dive" generation by outputting it to chat.
      setAlertModal({ isOpen: true, message: "Live Audio Deep Dive Generation is a premium feature taking time. Generating text-based deep dive instead..." });
      
      setLmMessages(prev => [...prev, { role: 'ai', text: `🎧 **Audio Deep Dive Transcript:**\n\n${scriptText}` }]);
      
    } catch (e) {
       console.error(e);
       setAlertModal({ isOpen: true, message: "Failed to generate deep dive overview." });
    } finally {
      setIsGeneratingLmAudio(false);
    }
  };

  const handleIdeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
          setAlertModal({ isOpen: true, message: "File size exceeds 10MB limit." });
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setIdeSelectedFiles(prev => [...prev, {
            data: reader.result as string,
            mimeType: file.type || 'application/octet-stream',
            name: file.name
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleUpgradePro = async (plan: 'lite' | 'pro' | 'business_lite' | 'business_pro') => {
    setSelectedPlanToUpgrade(plan);
    setUpgradeStep('payment');
  };

  const handlePaymentSubmit = async () => {
    if (!paymentFormState.phone || !paymentFormState.proof) {
      setAlertModal({ isOpen: true, message: "Please provide your account number and upload a payment screenshot." });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      if (!user) throw new Error("Not logged in");
      await firestoreService.submitUpgradeRequest(user.id, { 
        plan: selectedPlanToUpgrade,
        paymentPhone: paymentFormState.phone,
        paymentMethod: paymentFormState.method,
        paymentProof: paymentFormState.proof
      });
      setAlertModal({ isOpen: true, message: "Payment submitted successfully! Your account will be activated shortly after payment confirmation." });
      setModals(prev => ({ ...prev, upgradePro: false }));
      setUpgradeStep('plans');
      setPaymentFormState({ phone: '', method: 'easypaisa', proof: '' });
    } catch (error) {
      console.error("Upgrade failed", error);
      setAlertModal({ isOpen: true, message: "Payment submission failed. Please try again." });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handlePaymentProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Resize to make upload fast
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // Compress
        setPaymentFormState(prev => ({ ...prev, proof: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputContainerRef.current && !inputContainerRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
        setFileMenuOpen(false);
        setIsToolsMenuOpen(false);
        setIsMicMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    files.forEach(file => {
      if (file.name.endsWith('.rar') || file.name.endsWith('.zip')) {
        setAlertModal({ isOpen: true, message: "Note: AI models cannot directly read compressed RAR/ZIP files. Please extract the files and upload the documents (PDF, TXT, DOCX) directly for best results." });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSelectedFiles(prev => [...prev, {
          data: base64.split(',')[1],
          mimeType: file.type || 'text/plain',
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('application/pdf') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setSelectedFiles(prev => [...prev, {
              data: base64.split(',')[1],
              mimeType: file.type || 'application/octet-stream',
              name: file.name || `pasted_file_${Date.now()}`
            }]);
          };
          reader.readAsDataURL(file);
          e.preventDefault(); // Prevent pasting the filename as text
        }
      }
    }
  };

  const getStorageLimit = (plan: string) => {
    switch(plan) {
      case 'lite': return 5 * 1024 * 1024 * 1024; // 5 GB
      case 'pro': return 20 * 1024 * 1024 * 1024; // 20 GB
      case 'business_lite': return 100 * 1024 * 1024 * 1024; // 100 GB
      case 'business_pro': return 500 * 1024 * 1024 * 1024; // 500 GB
      default: return 100 * 1024 * 1024; // 100 MB for free tier
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const storageLimit = user ? getStorageLimit(user.plan) : 1024 * 1024 * 1024;
  const storageUsed = user?.storageUsed || 0;
  const storagePercent = Math.min(100, Math.max(0, (storageUsed / storageLimit) * 100));

  if (showSplash) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black z-[9999]">
        <h1 className="text-[60px] sm:text-[100px] md:text-[140px] font-black tracking-tighter transition-all duration-500 cursor-default text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.15)] animate-pulse">
          Xer0byte-AI
        </h1>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-black text-white' : 'bg-[#f0f0f0] text-black'}`}>
      <div className="flex flex-1 relative overflow-hidden">
      <ParticleBackground theme={theme} />
      <CursorTrailCanvas color={theme === 'dark' ? 'hsla(183, 63%, 40%, 0.5)' : 'hsla(183, 63%, 30%, 0.5)'} />
      
      {alertModal.isOpen && <CustomAlert message={alertModal.message} theme={theme} onClose={() => setAlertModal({isOpen: false, message: ''})} />}
      {confirmModal.isOpen && <CustomConfirm message={confirmModal.message} theme={theme} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} />}

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative top-0 bottom-0 left-0 w-[280px] flex flex-col p-4 z-50 border-r backdrop-blur-md transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:hidden'} ${theme === 'dark' ? 'bg-black/94 border-[#222]' : 'bg-white/94 border-[#ddd]'}`}>
        <div className={`flex items-center gap-3 p-3 rounded-xl text-sm transition-all ${theme === 'dark' ? 'bg-[#161616] text-[#888] focus-within:bg-[#222] focus-within:text-white' : 'bg-[#f5f5f5] text-[#555] focus-within:bg-[#e0e0e0] focus-within:text-black'}`}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none w-full"
          />
          <span className="ml-auto text-xs opacity-50 hidden sm:inline">Ctrl+K</span>
        </div>
        
        <div className="mt-4 space-y-1">
          <div 
            onClick={() => { setIsPrivateChat(false); setMessages([]); setCurrentConversationId(null); setView('home'); if (window.innerWidth < 768) setIsSidebarOpen(false); }} 
            className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer text-[15px] transition-all font-medium mb-2 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
          >
            <Plus size={20} />
            <span>New Chat</span>
          </div>
          {[
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'private', icon: MessageSquare, label: 'Private Chat', onClick: () => { setIsPrivateChat(true); setMessages([]); setCurrentConversationId(null); } },
            { id: 'voice', icon: Mic, label: 'Voice', onClick: () => { if (isListening) startListening(); } },
            { id: 'imagine', icon: ImageIcon, label: 'Imagine' },
            { id: 'projects', icon: Folder, label: 'Projects' },
            { id: 'history', icon: Clock, label: 'History' },
            { id: 'xer0bytepedia', icon: Book, label: 'Xer0bytepedia' },
            { id: 'ide', icon: PenTool, label: 'Live Sandbox IDE' }
          ].concat((user?.role === 'admin' || user?.plan === 'pro' || user?.plan === 'business_pro') ? [{ id: 'notebook', icon: BookOpen, label: 'Xer0byteLM' }] : []).map((item) => (
            <div 
              key={item.id}
              onClick={() => { 
                if (!user) { setModals(prev => ({...prev, signIn: true})); return; }
                if (user.role !== 'admin' && user.plan === 'free' && item.id === 'ide') {
                  setModals(prev => ({ ...prev, upgradePro: true }));
                  return;
                }
                if (item.id !== 'private') setIsPrivateChat(false);
                if (item.onClick) item.onClick();
                if (item.id === 'chat') {
                  setView(messages.length > 0 ? 'chat' : 'home');
                } else if (item.id === 'private') {
                  setView('home');
                } else {
                  setView(item.id as any);
                }
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }} 
              className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer text-[15px] transition-all ${(view === item.id || (item.id === 'private' && isPrivateChat)) ? (theme === 'dark' ? 'bg-[#1f1f1f] text-white' : 'bg-[#e0e0e0] text-black') : (theme === 'dark' ? 'text-[#ddd] hover:bg-[#1f1f1f] hover:text-white' : 'text-[#333] hover:bg-[#e0e0e0] hover:text-black')}`}
            >
              <item.icon size={20} className={item.id === 'private' ? 'text-purple-500' : ''} />
              <span className={item.id === 'private' ? 'text-purple-500 font-medium' : ''}>{item.label}</span>
            </div>
          ))}
          {user?.role === 'admin' && (
            <div onClick={() => { setView('admin'); if (window.innerWidth < 768) setIsSidebarOpen(false); }} className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer text-[15px] transition-all ${view === 'admin' ? (theme === 'dark' ? 'bg-[#1f1f1f] text-white' : 'bg-[#e0e0e0] text-black') : (theme === 'dark' ? 'text-[#ddd] hover:bg-[#1f1f1f] hover:text-white' : 'text-[#333] hover:bg-[#e0e0e0] hover:text-black')}`}>
              <Settings size={20} />
              <span>Admin Panel</span>
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-4">
          {/* Storage Usage */}
          {user && (
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-[#f5f5f5] border-[#ddd]'}`}>
              <div className="flex items-center gap-2 mb-3 font-semibold text-sm">
                <HardDrive size={16} />
                <span>Storage Usage</span>
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden mb-2 ${theme === 'dark' ? 'bg-[#333]' : 'bg-[#ddd]'}`}>
                <div className={`h-full rounded-full ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} style={{ width: `${storagePercent}%` }}></div>
              </div>
              <div className="text-xs opacity-60">
                {formatBytes(storageUsed)} used of {formatBytes(storageLimit)}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-opacity-20 flex items-center gap-3">
            <div className="relative">
            <div 
              onClick={() => setModals({...modals, userMenu: !modals.userMenu})}
              className="w-11 h-11 rounded-full cursor-pointer flex items-center justify-center text-white font-bold text-lg overflow-hidden shrink-0"
              style={{ background: user && !user.profilePhoto ? user.avatarColor : '#444' }}
            >
              {user?.profilePhoto ? <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" /> : (user ? user.name.charAt(0) : 'U')}
            </div>
            
            {/* User Menu Dropdown */}
            {modals.userMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setModals({...modals, userMenu: false})}></div>
                <div className={`absolute bottom-14 left-0 w-56 rounded-xl border shadow-2xl py-2 z-20 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
                  {user && (
                  <div className="px-4 py-2 mb-1 border-b border-opacity-20">
                    <div className="font-bold">{user.name}</div>
                    <div className="text-xs opacity-70 mb-1">{user.email}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Plan</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${user.plan === 'free' ? 'bg-gray-500 text-white' : 'bg-gradient-to-r from-[#00ff9d] to-[#00b8ff] text-black'}`}>
                        {user.plan === 'free' ? 'FREE' : user.plan.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                    {user.plan === 'free' && user.role !== 'admin' && (
                      <div className="text-[10px] opacity-60 mt-1 text-right">
                        {user.messageCount || 0} / 20 messages (per 5h)
                      </div>
                    )}
                  </div>
                )}
                <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { setModals({...modals, userMenu: false, settings: true}); }}>Settings</div>
                <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { setModals({...modals, userMenu: false, tasks: true}); }}>Tasks</div>
                <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`}>Files</div>
                <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`}>Xer0bytepedia</div>
                <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`}>Help</div>
                <div className={`my-1 border-t ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}></div>
                {user?.plan !== 'pro' && (
                  <div onClick={() => { setModals({...modals, userMenu: false, upgradePro: true}); }} className={`px-4 py-2 cursor-pointer hover:bg-black/10 font-medium ${theme === 'dark' ? 'hover:bg-white/10 text-[#00ff9d]' : 'text-[#006633]'}`}>Upgrade to Pro</div>
                )}
                {user && (
                  <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 text-red-500 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={handleLogout}>Sign Out</div>
                )}
              </div>
              </>
            )}
          </div>
          
          <button onClick={() => setModals({...modals, settings: true})} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${theme === 'dark' ? 'text-[#888] hover:bg-[#222] hover:text-white' : 'text-[#555] hover:bg-[#e0e0e0] hover:text-black'}`}>
            <Settings size={18} />
          </button>
        </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col items-center justify-center">
        {/* Top Left Sidebar Toggle */}
        <div className="absolute top-5 left-6 z-20">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'text-[#888] hover:bg-[#222] hover:text-white' : 'text-[#555] hover:bg-[#e0e0e0] hover:text-black'}`}>
            <Menu size={20} />
          </button>
        </div>

        {/* Top Right Auth Buttons */}
        <div className="absolute top-4 right-4 md:top-5 md:right-6 z-20 flex gap-2 md:gap-3 items-center">
          <button 
            onClick={() => { 
              const newMode = !isPrivateChat;
              setIsPrivateChat(newMode); 
              setMessages([]); 
              setCurrentConversationId(null); 
              setView('home'); 
            }} 
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm border transition-all flex items-center gap-1.5 md:gap-2 ${isPrivateChat ? (theme === 'dark' ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-purple-500 text-purple-600 bg-purple-500/10') : (theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent')}`}
          >
            <Lock size={14} /> <span className="hidden sm:inline">Private Chat</span>
          </button>
          {!user ? (
            <>
              <button onClick={() => setModals({...modals, signIn: true, signUp: false})} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm border transition-all ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}>Sign in</button>
              <button onClick={() => setModals({...modals, signUp: true, signIn: false})} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm border transition-all ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}>Sign up</button>
            </>
          ) : null}
        </div>

        {view === 'home' && (
          <div className="text-center max-w-[800px] w-full px-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <h1 className={`text-[60px] sm:text-[100px] md:text-[140px] font-black tracking-tighter mb-6 md:mb-10 transition-all duration-500 cursor-default ${theme === 'dark' ? 'text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:drop-shadow-[0_0_60px_rgba(255,255,255,0.6)]' : 'text-black drop-shadow-[0_0_40px_rgba(0,0,0,0.1)] hover:drop-shadow-[0_0_60px_rgba(0,0,0,0.4)]'}`}>Xer0byte</h1>
            <p className={`text-[20px] md:text-[26px] mb-10 md:mb-14 ${theme === 'dark' ? 'text-[#bbb]' : 'text-[#555]'}`}>What's on your mind?</p>
            
            <div className="w-full max-w-3xl mx-auto mb-10 relative" ref={inputContainerRef}>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className={`absolute bottom-full left-0 mb-2 w-full max-h-60 overflow-y-auto rounded-xl border shadow-2xl z-50 ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-[#ddd]'}`}>
                  {filteredSuggestions.map((suggestion, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`px-4 py-3 cursor-pointer text-left text-sm transition-colors ${theme === 'dark' ? 'hover:bg-[#2a2a2a] text-white' : 'hover:bg-[#f5f5f5] text-black'} ${idx !== filteredSuggestions.length - 1 ? (theme === 'dark' ? 'border-b border-[#333]' : 'border-b border-[#eee]') : ''}`}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
              {selectedFiles.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-2 w-full px-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${theme === 'dark' ? 'bg-[#222] border-[#444] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={`flex items-center rounded-full p-1.5 h-14 md:h-16 border transition-all ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a] focus-within:border-[#555] focus-within:ring-4 focus-within:ring-white/10' : 'bg-[#f5f5f5] border-[#ddd] focus-within:border-[#999] focus-within:ring-4 focus-within:ring-black/10'}`}>
                <div className="relative flex items-center">
                  <div onClick={() => setFileMenuOpen(!fileMenuOpen)} className="pl-3 md:pl-4 pr-1 md:pr-2 text-[#666] cursor-pointer hover:text-white transition-colors">
                    <Plus size={20} />
                  </div>
                  {fileMenuOpen && (
                    <div className={`absolute bottom-12 left-0 w-48 rounded-xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
                      <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { fileInputRef.current?.click(); setFileMenuOpen(false); }}>
                        <span className="text-lg">💻</span> Upload from device
                      </div>
                      <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { setAlertModal({ isOpen: true, message: "Google Drive integration coming soon!" }); setFileMenuOpen(false); }}>
                        <span className="text-lg">☁️</span> Google Drive
                      </div>
                    </div>
                  )}
                  
                  <div className="relative">
                    <button onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-[#333] text-[#ddd]' : 'hover:bg-[#e5e5e5] text-[#555]'}`}>
                      <Wrench size={16} /> Tools
                    </button>
                    {isToolsMenuOpen && (
                      <div className={`absolute bottom-12 left-0 w-56 rounded-2xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                        <div className="px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-wider">Tools</div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setInputText("Create an image of "); setIsToolsMenuOpen(false); }}>
                          <ImageIcon size={18} className="text-[#888]" />
                          <div className="font-medium">Create image</div>
                        </div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { 
                           setIsToolsMenuOpen(false);
                           if (!user) { setModals(prev => ({...prev, signIn: true})); return; }
                           if (user.role !== 'admin' && user.plan === 'free') {
                             setModals(prev => ({ ...prev, upgradePro: true }));
                             return;
                           }
                           setCanvasActiveProjectId(null); 
                           setView('ide'); 
                        }}>
                          <PenTool size={18} className="text-[#888]" />
                          <div className="font-medium">Live Sandbox IDE</div>
                        </div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setInputText("Generate a 30-second cinematic orchestral track."); setIsToolsMenuOpen(false); }}>
                          <Music size={18} className="text-[#888]" />
                          <div className="font-medium flex items-center gap-2">
                            Create music <span className="bg-blue-500/20 text-blue-500 text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold">New</span>
                          </div>
                        </div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setInputText("I want to learn something new. Please start a guided learning session, asking me questions one by one to test my knowledge on: "); setIsToolsMenuOpen(false); }}>
                          <BookOpen size={18} className="text-[#888]" />
                          <div className="font-medium">Guided Learning</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="relative flex items-center border-r border-[#ddd] dark:border-[#333] pr-2 mr-2">
                  <button onClick={() => setIsModelMenuOpen(!isModelMenuOpen)} className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-[#333] text-[#ddd]' : 'hover:bg-[#e5e5e5] text-[#555]'}`}>
                    {selectedModel === 'fast' ? 'Fast' : selectedModel === 'thinking' ? 'Thinking' : 'Pro'} <ChevronDown size={14} />
                  </button>
                  {isModelMenuOpen && (
                    <div className={`absolute bottom-12 left-0 w-72 rounded-2xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                      <div className="px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-wider">Xer0byte</div>
                      
                      <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setSelectedModel('fast'); setIsModelMenuOpen(false); }}>
                        <div>
                          <div className="font-medium">Fast</div>
                          <div className="text-xs text-[#888]">Answers quickly</div>
                        </div>
                        {selectedModel === 'fast' && <Check size={16} className="text-blue-500" />}
                      </div>
                      
                      <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { 
                        if (user?.plan === 'free' && user?.role !== 'admin') {
                          setModals(prev => ({ ...prev, upgradePro: true }));
                          setIsModelMenuOpen(false);
                          return;
                        }
                        setSelectedModel('thinking'); 
                        setIsModelMenuOpen(false); 
                      }}>
                        <div>
                          <div className="font-medium flex items-center gap-2">Thinking {user?.plan === 'free' && user?.role !== 'admin' && <Lock size={12} className="text-[#888]" />}</div>
                          <div className="text-xs text-[#888]">Solves complex problems</div>
                        </div>
                        {selectedModel === 'thinking' && <Check size={16} className="text-blue-500" />}
                      </div>
                      
                      <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { 
                        if (user?.plan === 'free' && user?.role !== 'admin') {
                          setModals(prev => ({ ...prev, upgradePro: true }));
                          setIsModelMenuOpen(false);
                          return;
                        }
                        setSelectedModel('pro'); 
                        setIsModelMenuOpen(false); 
                      }}>
                        <div>
                          <div className="font-medium flex items-center gap-2">Pro {user?.plan === 'free' && user?.role !== 'admin' && <Lock size={12} className="text-[#888]" />}</div>
                          <div className="text-xs text-[#888]">Advanced maths and code with 3.1 Pro</div>
                        </div>
                        {selectedModel === 'pro' && <Check size={16} className="text-blue-500" />}
                      </div>
                      
                      <div className="border-t border-[#ddd] dark:border-[#333] my-1"></div>
                      
                      <div className={`px-4 py-3 flex items-center justify-between`}>
                        <div>
                          <div className="font-medium flex items-center gap-2">Extended thinking {user?.plan === 'free' && user?.role !== 'admin' && <Lock size={12} className="text-[#888]" />}</div>
                          <div className="text-xs text-[#888]">Think longer for complex tasks</div>
                        </div>
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          if (user?.plan === 'free' && user?.role !== 'admin') {
                            setModals(prev => ({ ...prev, upgradePro: true }));
                            setIsModelMenuOpen(false);
                            return;
                          }
                          setExtendedThinking(!extendedThinking); 
                        }} className={`w-10 h-6 rounded-full transition-colors relative ${extendedThinking ? 'bg-blue-500' : (theme === 'dark' ? 'bg-[#444]' : 'bg-[#ccc]')}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${extendedThinking ? 'translate-x-4' : ''}`}></div>
                        </button>
                      </div>

                      <div className={`px-4 py-3 flex items-center justify-between`}>
                        <div>
                          <div className="font-medium">Web Search</div>
                          <div className="text-xs text-[#888]">Search the web for current info</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setUseWebSearch(!useWebSearch); }} className={`w-10 h-6 rounded-full transition-colors relative ${useWebSearch ? 'bg-blue-500' : (theme === 'dark' ? 'bg-[#444]' : 'bg-[#ccc]')}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${useWebSearch ? 'translate-x-4' : ''}`}></div>
                        </button>
                      </div>

                      <div className="border-t border-[#ddd] dark:border-[#333] my-1"></div>
                      <div className="px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-wider">Persona</div>
                      
                      <div className={`px-4 py-2 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setPersona('standard'); setIsModelMenuOpen(false); }}>
                        <div className="text-sm">Standard</div>
                        {persona === 'standard' && <Check size={14} className="text-blue-500" />}
                      </div>
                      <div className={`px-4 py-2 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setPersona('fun'); setIsModelMenuOpen(false); }}>
                        <div className="text-sm">Fun & Sarcastic</div>
                        {persona === 'fun' && <Check size={14} className="text-blue-500" />}
                      </div>
                      <div className={`px-4 py-2 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setPersona('concise'); setIsModelMenuOpen(false); }}>
                        <div className="text-sm">Concise</div>
                        {persona === 'concise' && <Check size={14} className="text-blue-500" />}
                      </div>
                    </div>
                  )}
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="*/*" multiple />
                <input 
                  type="text" 
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  onPaste={handlePaste}
                  placeholder={selectedFiles.length > 0 ? `${selectedFiles.length} file(s) attached. Add a message...` : "What's on your mind?"}
                  className={`flex-1 bg-transparent border-none outline-none text-[15px] md:text-[17px] px-2 ${theme === 'dark' ? 'text-white placeholder-[#666]' : 'text-black placeholder-[#999]'}`}
                />
                <div className="flex items-center gap-1 md:gap-2 pr-1 md:pr-2">
                  <div className="relative">
                    <button onClick={() => { if(isListening) { startListening(); } else { setIsMicMenuOpen(!isMicMenuOpen); } }} className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-[#ddd]'} ${isListening ? 'text-red-500 animate-pulse' : ''}`}>
                      <Mic size={20} />
                    </button>
                    {isMicMenuOpen && !isListening && (
                      <div className={`absolute bottom-12 right-0 w-48 rounded-2xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                        <div className="px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-wider">Voice Mode</div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setVoiceMode('chat'); setIsMicMenuOpen(false); startListening(); }}>
                          <div>
                            <div className="font-medium text-sm">Voice Chat</div>
                            <div className="text-[10px] text-[#888]">AI replies in chat</div>
                          </div>
                          {voiceMode === 'chat' && <Check size={14} className="text-blue-500" />}
                        </div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setVoiceMode('dictation'); setIsMicMenuOpen(false); startListening(); }}>
                          <div>
                            <div className="font-medium text-sm">Speech to Text</div>
                            <div className="text-[10px] text-[#888]">Dictate your message</div>
                          </div>
                          {voiceMode === 'dictation' && <Check size={14} className="text-blue-500" />}
                        </div>

                        <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setIsMicMenuOpen(false); setView('voice'); }}>
                          <div>
                            <div className="font-medium text-sm">Live Call</div>
                            <div className="text-[10px] text-[#888]">Real-time voice screen</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleSend()}
                    disabled={(!inputText.trim() && selectedFiles.length === 0) || isThinking}
                    className={`p-2 rounded-full flex items-center justify-center transition-colors ${(inputText.trim() || selectedFiles.length > 0) && !isThinking ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : (theme === 'dark' ? 'bg-[#333] text-[#666]' : 'bg-[#ddd] text-[#999]')}`}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>

            {!user && (
              <div className={`mx-auto rounded-2xl p-4 md:p-6 max-w-[680px] w-full flex flex-col sm:flex-row items-center gap-4 md:gap-5 transition-transform hover:scale-[1.02] border ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a]' : 'bg-[#f5f5f5] border-[#ddd]'}`}>
                <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-[#222]' : 'bg-[#e0e0e0]'}`}><UserPlus className="text-[#00ff9d]" size={24} /></div>
                <div className="text-center sm:text-left flex-1">
                  <div className="font-semibold text-lg">Create a Free Account</div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-[#aaa]' : 'text-[#666]'}`}>Sign up to save chat history, configure AI features, and more.</div>
                </div>
                <button onClick={() => setModals({ ...modals, signUp: true, signIn: false })} className={`px-4 py-2 rounded-full text-sm border transition-all ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}>Sign up</button>
              </div>
            )}
          </div>
        )}

        {view === 'notebook' && (
          <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
             <NotebookUI theme={theme} />
          </div>
        )}

        {view === 'chat' && (
          <div className="flex flex-col h-full w-full max-w-4xl mx-auto relative">
            {isPrivateChat && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-purple-500/20 text-purple-400 px-4 py-1.5 rounded-full text-xs font-medium border border-purple-500/30 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                Private Chat Mode
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 md:pt-24 pb-48 space-y-6 md:space-y-8">
              {messages.map((msg, i) => (
                <div key={i} className={`flex w-full mb-8 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] md:max-w-[85%] p-4 md:p-6 rounded-2xl md:rounded-3xl text-[15px] md:text-[16px] leading-relaxed relative group ${
                    msg.role === 'user' 
                      ? (theme === 'dark' ? 'bg-[#333] text-white shadow-xl' : 'bg-black text-white shadow-lg')
                      : (theme === 'dark' ? 'bg-[#18181A] border border-[#333] shadow-2xl text-[#eee]' : 'bg-white border border-[#eaeaea] shadow-xl text-[#111]')
                  }`}>
                    {msg.imageUrl && (
                      <div className="mb-3 rounded-xl md:rounded-2xl overflow-hidden border border-white/10">
                        <img src={msg.imageUrl} alt="Generated" loading="lazy" className="max-w-full h-auto object-contain blur-0 transition-all duration-300" referrerPolicy="no-referrer" />
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
                    {msg.role === 'ai' ? (
                      <div className={`prose ${theme === 'dark' ? 'prose-invert prose-headings:text-white prose-a:text-[#00ff9d] prose-strong:text-white prose-code:text-[#00ff9d]' : 'prose-zinc prose-a:text-[#006633] prose-strong:text-black'} max-w-none`}>
                        <MemoizedMarkdown content={msg.text} theme={theme} />
                        
                        {/* AI Message Actions */}
                        <div className="absolute -bottom-10 left-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
                          <button onClick={() => navigator.clipboard.writeText(msg.text)} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Copy">
                            <Copy size={14} />
                          </button>
                          <button onClick={() => {
                            if (navigator.share) {
                              navigator.share({ title: 'Xer0byte AI Response', text: msg.text }).catch(console.error);
                            } else {
                              navigator.clipboard.writeText(msg.text);
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
                          {i === messages.length - 1 && (
                            <button onClick={() => {
                              // Find last user message
                              const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                              if (lastUserMsg) {
                                setInputText(lastUserMsg.text);
                                // Optional: auto-send or just populate input
                              }
                            }} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Regenerate">
                              <RefreshCw size={14} />
                            </button>
                          )}
                          {msg.text.length > 200 && (
                            <button onClick={() => {
                              if (!user) { setModals(prev => ({...prev, signIn: true})); return; }
                              if (user.role !== 'admin' && user.plan === 'free') {
                                setModals(prev => ({ ...prev, upgradePro: true }));
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
                          {(msg.text.length > 200 || msg.text.includes('```')) && (
                            <button onClick={() => {
                              if (!user) { setModals(prev => ({...prev, signIn: true})); return; }
                              if (user.role !== 'admin' && user.plan === 'free') {
                                setModals(prev => ({ ...prev, upgradePro: true }));
                                return;
                              }
                              let content = msg.text;
                              const codeMatch = content.match(/```[\s\S]*?```/g);
                              if (codeMatch && codeMatch.length > 0) {
                                content = codeMatch.map(block => block.replace(/```[a-z]*\n/, '').replace(/```$/, '')).join('\n\n');
                              }
                              setCanvasContent(content);
                              setCanvasActiveProjectId(null);
                              setView('ide');
                            }} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Open in Sandbox">
                              <PenTool size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        {msg.text}
                        {/* User Message Actions */}
                        <div className="absolute -bottom-10 right-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
                          <button onClick={() => setInputText(msg.text)} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => navigator.clipboard.writeText(msg.text)} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-[#333] text-[#888] hover:text-white' : 'hover:bg-[#ddd] text-[#666] hover:text-black'}`} title="Copy">
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex w-full justify-start">
                  <div className={`max-w-[80%] p-4 rounded-3xl text-[16px] leading-relaxed flex items-center gap-2 ${theme === 'dark' ? 'bg-[#111] text-[#ddd]' : 'bg-[#f0f0f0] text-black'}`}>
                    <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className={`absolute bottom-0 left-0 right-0 p-4 md:p-6 pt-10 bg-gradient-to-t z-30 ${theme === 'dark' ? 'from-black via-black/90 to-transparent' : 'from-[#f0f0f0] via-[#f0f0f0]/90 to-transparent'}`}>
              <div className="w-full max-w-3xl mx-auto relative" ref={inputContainerRef}>
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className={`absolute bottom-full left-0 mb-2 w-full max-h-60 overflow-y-auto rounded-xl border shadow-2xl z-50 ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-[#ddd]'}`}>
                    {filteredSuggestions.map((suggestion, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`px-4 py-3 cursor-pointer text-left text-sm transition-colors ${theme === 'dark' ? 'hover:bg-[#2a2a2a] text-white' : 'hover:bg-[#f5f5f5] text-black'} ${idx !== filteredSuggestions.length - 1 ? (theme === 'dark' ? 'border-b border-[#333]' : 'border-b border-[#eee]') : ''}`}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
                {selectedFiles.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-2 w-full px-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${theme === 'dark' ? 'bg-[#222] border-[#444] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className={`flex items-center rounded-full p-1.5 h-14 md:h-16 border transition-all w-full relative ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a] focus-within:border-[#555] focus-within:ring-4 focus-within:ring-white/10' : 'bg-[#f5f5f5] border-[#ddd] focus-within:border-[#999] focus-within:ring-4 focus-within:ring-black/10'}`}>
                  <div className="relative flex items-center">
                    <div onClick={() => setFileMenuOpen(!fileMenuOpen)} className="pl-3 md:pl-4 pr-1 md:pr-2 text-[#666] cursor-pointer hover:text-white transition-colors">
                      <Plus size={20} />
                    </div>
                    {fileMenuOpen && (
                      <div className={`absolute bottom-12 left-0 w-48 rounded-xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
                        <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { fileInputRef.current?.click(); setFileMenuOpen(false); }}>
                          <span className="text-lg">💻</span> Upload from device
                        </div>
                        <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { setAlertModal({ isOpen: true, message: "Google Drive integration coming soon!" }); setFileMenuOpen(false); }}>
                          <span className="text-lg">☁️</span> Google Drive
                        </div>
                      </div>
                    )}
                    
                    <div className="relative">
                      <button onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-[#333] text-[#ddd]' : 'hover:bg-[#e5e5e5] text-[#555]'}`}>
                        <Wrench size={16} /> Tools
                      </button>
                      {isToolsMenuOpen && (
                        <div className={`absolute bottom-12 left-0 w-56 rounded-2xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                          <div className="px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-wider">Tools</div>
                          
                          <div className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setInputText("Create an image of "); setIsToolsMenuOpen(false); }}>
                            <ImageIcon size={18} className="text-[#888]" />
                            <div className="font-medium">Create image</div>
                          </div>
                          
                          <div className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { 
                             setIsToolsMenuOpen(false);
                             if (!user) { setModals(prev => ({...prev, signIn: true})); return; }
                             if (user.role !== 'admin' && user.plan === 'free') {
                               setModals(prev => ({ ...prev, upgradePro: true }));
                               return;
                             }
                             setCanvasActiveProjectId(null); 
                             setView('ide'); 
                          }}>
                            <PenTool size={18} className="text-[#888]" />
                            <div className="font-medium">Live Sandbox IDE</div>
                          </div>
                          
                          <div className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setInputText("Generate a 30-second cinematic orchestral track."); setIsToolsMenuOpen(false); }}>
                            <Music size={18} className="text-[#888]" />
                            <div className="font-medium flex items-center gap-2">
                              Create music <span className="bg-blue-500/20 text-blue-500 text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold">New</span>
                            </div>
                          </div>
                          
                          <div className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setInputText("I want to learn something new. Please start a guided learning session, asking me questions one by one to test my knowledge on: "); setIsToolsMenuOpen(false); }}>
                            <BookOpen size={18} className="text-[#888]" />
                            <div className="font-medium">Guided Learning</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="relative flex items-center border-r border-[#ddd] dark:border-[#333] pr-2 mr-2">
                    <button onClick={() => setIsModelMenuOpen(!isModelMenuOpen)} className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-[#333] text-[#ddd]' : 'hover:bg-[#e5e5e5] text-[#555]'}`}>
                      {selectedModel === 'fast' ? 'Fast' : selectedModel === 'thinking' ? 'Thinking' : 'Pro'} <ChevronDown size={14} />
                    </button>
                    {isModelMenuOpen && (
                      <div className={`absolute bottom-12 left-0 w-72 rounded-2xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                        <div className="px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-wider">Xer0byte</div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setSelectedModel('fast'); setIsModelMenuOpen(false); }}>
                          <div>
                            <div className="font-medium">Fast</div>
                            <div className="text-xs text-[#888]">Answers quickly</div>
                          </div>
                          {selectedModel === 'fast' && <Check size={16} className="text-blue-500" />}
                        </div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { 
                          if (user?.plan === 'free' && user?.role !== 'admin') {
                            setModals(prev => ({ ...prev, upgradePro: true }));
                            setIsModelMenuOpen(false);
                            return;
                          }
                          setSelectedModel('thinking'); 
                          setIsModelMenuOpen(false); 
                        }}>
                          <div>
                            <div className="font-medium flex items-center gap-2">Thinking {user?.plan === 'free' && user?.role !== 'admin' && <Lock size={12} className="text-[#888]" />}</div>
                            <div className="text-xs text-[#888]">Solves complex problems</div>
                          </div>
                          {selectedModel === 'thinking' && <Check size={16} className="text-blue-500" />}
                        </div>
                        
                        <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { 
                          if (user?.plan === 'free' && user?.role !== 'admin') {
                            setModals(prev => ({ ...prev, upgradePro: true }));
                            setIsModelMenuOpen(false);
                            return;
                          }
                          setSelectedModel('pro'); 
                          setIsModelMenuOpen(false); 
                        }}>
                          <div>
                            <div className="font-medium flex items-center gap-2">Pro {user?.plan === 'free' && user?.role !== 'admin' && <Lock size={12} className="text-[#888]" />}</div>
                            <div className="text-xs text-[#888]">Advanced maths and code with 3.1 Pro</div>
                          </div>
                          {selectedModel === 'pro' && <Check size={16} className="text-blue-500" />}
                        </div>
                        
                        <div className="border-t border-[#ddd] dark:border-[#333] my-1"></div>
                        
                        <div className={`px-4 py-3 flex items-center justify-between`}>
                          <div>
                            <div className="font-medium flex items-center gap-2">Extended thinking {user?.plan === 'free' && user?.role !== 'admin' && <Lock size={12} className="text-[#888]" />}</div>
                            <div className="text-xs text-[#888]">Think longer for complex tasks</div>
                          </div>
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            if (user?.plan === 'free' && user?.role !== 'admin') {
                              setModals(prev => ({ ...prev, upgradePro: true }));
                              setIsModelMenuOpen(false);
                              return;
                            }
                            setExtendedThinking(!extendedThinking); 
                          }} className={`w-10 h-6 rounded-full transition-colors relative ${extendedThinking ? 'bg-blue-500' : (theme === 'dark' ? 'bg-[#444]' : 'bg-[#ccc]')}`}>
                            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${extendedThinking ? 'translate-x-4' : ''}`}></div>
                          </button>
                        </div>

                        <div className={`px-4 py-3 flex items-center justify-between`}>
                          <div>
                            <div className="font-medium">Web Search</div>
                            <div className="text-xs text-[#888]">Search the web for current info</div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setUseWebSearch(!useWebSearch); }} className={`w-10 h-6 rounded-full transition-colors relative ${useWebSearch ? 'bg-blue-500' : (theme === 'dark' ? 'bg-[#444]' : 'bg-[#ccc]')}`}>
                            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${useWebSearch ? 'translate-x-4' : ''}`}></div>
                          </button>
                        </div>

                        <div className="border-t border-[#ddd] dark:border-[#333] my-1"></div>
                        <div className="px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-wider">Persona</div>
                        
                        <div className={`px-4 py-2 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setPersona('standard'); setIsModelMenuOpen(false); }}>
                          <div className="text-sm">Standard</div>
                          {persona === 'standard' && <Check size={14} className="text-blue-500" />}
                        </div>
                        <div className={`px-4 py-2 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setPersona('fun'); setIsModelMenuOpen(false); }}>
                          <div className="text-sm">Fun & Sarcastic</div>
                          {persona === 'fun' && <Check size={14} className="text-blue-500" />}
                        </div>
                        <div className={`px-4 py-2 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setPersona('concise'); setIsModelMenuOpen(false); }}>
                          <div className="text-sm">Concise</div>
                          {persona === 'concise' && <Check size={14} className="text-blue-500" />}
                        </div>
                      </div>
                    )}
                  </div>

                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="*/*" multiple />
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    onPaste={handlePaste}
                    placeholder={selectedFiles.length > 0 ? `${selectedFiles.length} file(s) attached. Add a message...` : "What's on your mind?"}
                    className={`flex-1 bg-transparent border-none outline-none text-[15px] md:text-[17px] px-2 ${theme === 'dark' ? 'text-white placeholder-[#666]' : 'text-black placeholder-[#999]'}`}
                  />
                  <div className="flex items-center gap-1 md:gap-2 pr-1 md:pr-2">
                    <div className="relative">
                      <button onClick={() => { if(isListening) { startListening(); } else { setIsMicMenuOpen(!isMicMenuOpen); } }} className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-[#ddd]'} ${isListening ? 'text-red-500 animate-pulse' : ''}`}>
                        <Mic size={20} />
                      </button>
                      {isMicMenuOpen && !isListening && (
                        <div className={`absolute bottom-12 right-0 w-48 rounded-2xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                          <div className="px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-wider">Voice Mode</div>
                          
                          <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setVoiceMode('chat'); setIsMicMenuOpen(false); startListening(); }}>
                            <div>
                              <div className="font-medium text-sm">Voice Chat</div>
                              <div className="text-[10px] text-[#888]">AI replies in chat</div>
                            </div>
                            {voiceMode === 'chat' && <Check size={14} className="text-blue-500" />}
                          </div>
                          
                          <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setVoiceMode('dictation'); setIsMicMenuOpen(false); startListening(); }}>
                            <div>
                              <div className="font-medium text-sm">Speech to Text</div>
                              <div className="text-[10px] text-[#888]">Dictate your message</div>
                            </div>
                            {voiceMode === 'dictation' && <Check size={14} className="text-blue-500" />}
                          </div>

                          <div className={`px-4 py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setIsMicMenuOpen(false); setView('voice'); }}>
                            <div>
                              <div className="font-medium text-sm">Live Call</div>
                              <div className="text-[10px] text-[#888]">Real-time voice screen</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => handleSend()}
                      disabled={(!inputText.trim() && selectedFiles.length === 0) || isThinking}
                      className={`p-2 rounded-full flex items-center justify-center transition-colors ${(inputText.trim() || selectedFiles.length > 0) && !isThinking ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : (theme === 'dark' ? 'bg-[#333] text-[#666]' : 'bg-[#ddd] text-[#999]')}`}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="w-full max-w-4xl mx-auto p-4 md:p-8 pt-20 md:pt-24 h-full overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold">History</h2>
              <div className="flex items-center gap-2">
                <div className={`flex items-center px-3 py-2 rounded-xl border ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
                  <Search size={16} className="opacity-50 mr-2" />
                  <input
                    type="text"
                    placeholder="Search by name or date..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full md:w-64"
                  />
                </div>
                <button 
                  onClick={handleDeleteAll}
                  className="p-2 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Clear All History"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            {(() => {
              const filteredConvs = conversations.filter(c => {
                const searchLower = searchQuery.toLowerCase();
                const titleMatch = c.title.toLowerCase().includes(searchLower);
                const dateMatch = new Date(c.created_at || c.updated_at).toLocaleDateString().includes(searchLower);
                return titleMatch || dateMatch;
              });

              if (filteredConvs.length === 0) {
                return <div className="text-center opacity-50 mt-20">No past conversations found.</div>;
              }

              const grouped = groupConversationsByDate(filteredConvs);

              return (
                <div className="space-y-8">
                  {Object.entries(grouped).map(([groupName, groupConvs]) => {
                    if (groupConvs.length === 0) return null;
                    return (
                      <div key={groupName}>
                        <h3 className="text-sm font-bold opacity-50 uppercase tracking-wider mb-3">{groupName}</h3>
                        <div className="space-y-3 md:space-y-4">
                          {groupConvs.map(conv => (
                            <div 
                              key={conv.id} 
                              className={`p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all relative group ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a] hover:border-[#555]' : 'bg-white border-[#ddd] hover:border-[#999]'}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div 
                                  className="flex-1 cursor-pointer"
                                  onClick={() => { setCurrentConversationId(conv.id); setIsPrivateChat(false); setView('chat'); }}
                                >
                                  {editingConvId === conv.id ? (
                                    <input 
                                      type="text" 
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRenameConv(conv.id, editingTitle);
                                        if (e.key === 'Escape') setEditingConvId(null);
                                      }}
                                      onBlur={() => handleRenameConv(conv.id, editingTitle)}
                                      autoFocus
                                      className={`w-full bg-transparent border-b outline-none text-base md:text-lg mb-1 ${theme === 'dark' ? 'border-white/20 text-white' : 'border-black/20 text-black'}`}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <div className="font-medium text-base md:text-lg mb-1 flex items-center gap-2">
                                      {conv.isPinned && <Pin size={14} className="text-[#00ff9d] fill-current" />}
                                      {conv.title}
                                    </div>
                                  )}
                                  <div className="text-xs opacity-50">{new Date(conv.created_at || conv.updated_at).toLocaleString()}</div>
                                </div>
                                
                                <div className="relative">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setActiveConvMenu(activeConvMenu === conv.id ? null : conv.id); }}
                                    className={`p-1.5 rounded-lg opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-[#eee]'}`}
                                  >
                                    <MoreVertical size={18} />
                                  </button>
                                  
                                  {activeConvMenu === conv.id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setActiveConvMenu(null); setDeleteConfirmId(null); }}></div>
                                      <div className={`absolute right-0 top-8 w-48 rounded-xl border shadow-2xl py-1 z-20 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
                                        {deleteConfirmId === conv.id ? (
                                          <div className="px-3 py-2">
                                            <div className="text-sm mb-2 text-center">Are you sure?</div>
                                            <div className="flex gap-2">
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                                className="flex-1 py-1 rounded text-xs bg-gray-500/20 hover:bg-gray-500/30 transition-colors"
                                              >Cancel</button>
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id); }}
                                                className="flex-1 py-1 rounded text-xs bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                                              >Delete</button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div 
                                              className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                                              onClick={(e) => { e.stopPropagation(); setEditingConvId(conv.id); setEditingTitle(conv.title); setActiveConvMenu(null); }}
                                            >
                                              <Edit2 size={14} /> Rename
                                            </div>
                                            <div 
                                              className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                                              onClick={(e) => { e.stopPropagation(); handlePinConv(conv.id, !!conv.isPinned); setActiveConvMenu(null); }}
                                            >
                                              <Pin size={14} /> {conv.isPinned ? 'Unpin' : 'Pin'}
                                            </div>
                                            <div 
                                              className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm text-red-500 ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(conv.id); }}
                                            >
                                              <Trash2 size={14} /> Delete
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {view === 'imagine' && (
          <div className="w-full max-w-4xl mx-auto p-4 md:p-8 pt-20 md:pt-24 h-full flex flex-col items-center justify-center relative">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4">Imagine</h2>
            <p className="text-base md:text-lg opacity-70 mb-8 md:mb-12 text-center max-w-2xl">Describe an image you want to generate, and Xer0byte will bring it to life.</p>
            
            {generatedImage ? (
              <div className="mb-8 md:mb-12 relative group rounded-xl md:rounded-2xl overflow-hidden shadow-2xl border border-white/10 w-full max-w-2xl">
                <img src={generatedImage} alt="Generated" className="w-full max-h-[40vh] md:max-h-[50vh] object-contain" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button onClick={() => {
                    const a = document.createElement('a');
                    a.href = generatedImage;
                    a.download = 'xer0byte-imagine.png';
                    a.click();
                  }} className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-gray-200">Download</button>
                </div>
              </div>
            ) : isGeneratingImage ? (
              <div className="mb-8 md:mb-12 flex flex-col items-center">
                <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-[#00ff9d] border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-base md:text-lg opacity-80 animate-pulse">Generating your masterpiece...</div>
              </div>
            ) : null}

            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-8 w-full max-w-3xl">
              <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all ${
                      aspectRatio === ratio
                        ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white')
                        : (theme === 'dark' ? 'bg-[#1a1a1a] text-[#666] hover:text-white' : 'bg-[#eee] text-[#999] hover:text-black')
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
              <div className="hidden md:block h-6 w-[1px] bg-white/10"></div>
              <button 
                onClick={() => setUseXer0byteStyle(!useXer0byteStyle)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all ${
                  useXer0byteStyle 
                    ? 'bg-[#00ff9d]/20 text-[#00ff9d] border border-[#00ff9d]/30' 
                    : (theme === 'dark' ? 'bg-[#1a1a1a] text-[#666]' : 'bg-[#eee] text-[#999]')
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${useXer0byteStyle ? 'bg-[#00ff9d] animate-pulse' : 'bg-gray-500'}`}></div>
                Xer0byte Style
              </button>
            </div>

            <div className={`flex items-center rounded-full p-1.5 h-14 md:h-16 border transition-all w-full max-w-3xl ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a] focus-within:border-[#555] focus-within:ring-4 focus-within:ring-white/10' : 'bg-[#f5f5f5] border-[#ddd] focus-within:border-[#999] focus-within:ring-4 focus-within:ring-black/10'}`}>
              <div className="pl-3 md:pl-4 pr-1 md:pr-2 text-[#666]">
                <ImageIcon size={20} />
              </div>
              <input 
                type="text" 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerateImage()}
                placeholder="A futuristic city with flying cars..."
                className={`flex-1 bg-transparent border-none outline-none text-[15px] md:text-[17px] px-2 ${theme === 'dark' ? 'text-white placeholder-[#666]' : 'text-black placeholder-[#999]'}`}
              />
              <div className="flex items-center pr-2">
                <button 
                  onClick={handleGenerateImage}
                  disabled={!inputText.trim() || isGeneratingImage}
                  className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-medium transition-colors ${inputText.trim() && !isGeneratingImage ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : (theme === 'dark' ? 'bg-[#333] text-[#666]' : 'bg-[#ddd] text-[#999]')}`}
                >
                  Generate
                </button>
              </div>
            </div>

            {recentGenerations.length > 0 && (
              <div className="mt-8 md:mt-12 w-full max-w-3xl">
                <h3 className="text-lg md:text-xl font-semibold mb-4 opacity-80">Recent Generations</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-4">
                  {recentGenerations.map((img, i) => (
                    <div 
                      key={i} 
                      onClick={() => setGeneratedImage(img)}
                      className="aspect-square rounded-lg md:rounded-xl overflow-hidden border border-white/5 cursor-pointer hover:scale-105 transition-transform"
                    >
                      <img src={img} alt={`Recent ${i}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'voice' && (
          <VoiceAI theme={theme} onClose={() => setView(messages.length > 0 ? 'chat' : 'home')} token={token} isPrivate={isPrivateChat} onError={(msg) => setAlertModal({ isOpen: true, message: msg })} />
        )}

        {view === 'projects' && (
          <div className="w-full max-w-4xl mx-auto p-4 md:p-8 pt-20 md:pt-24 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Projects</h2>
              <button 
                onClick={() => setModals({...modals, createProject: true})}
                className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
              >
                <Plus size={18} />
                New Project
              </button>
            </div>
            
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                <Folder size={64} className="mb-6" />
                <p className="text-lg text-center max-w-md">Your saved code snippets, documents, and artifacts will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map(project => (
                  <div 
                    key={project.id}
                    className={`p-6 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a] hover:border-[#555]' : 'bg-white border-[#ddd] hover:border-[#999]'}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Folder size={20} className="text-[#00ff9d]" />
                      <h3 className="font-bold text-lg">{project.name}</h3>
                    </div>
                    <p className={`text-sm mb-4 line-clamp-2 ${theme === 'dark' ? 'text-[#aaa]' : 'text-[#666]'}`}>{project.description}</p>
                      <div className="flex justify-between items-center">
                        <button 
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              message: "Are you sure you want to delete this project?",
                              onConfirm: async () => {
                                try {
                                  if (!user) return;
                                  const projectId = project._id || project.id;
                                  if (projectId) {
                                    await firestoreService.deleteProject(user.id, projectId);
                                    setProjects(prev => prev.filter(p => (p._id || p.id) !== projectId));
                                  }
                                } catch (e) {
                                  console.error("Delete failed", e);
                                }
                              }
                            });
                          }}
                          className="text-xs opacity-50 hover:text-red-500 transition-colors"
                        >Delete</button>
                        <button 
                          onClick={() => {
                            if (project.content) {
                              setCanvasContent(project.content);
                              setCanvasActiveProjectId(project._id || project.id);
                              setView('ide');
                            } else {
                              setAlertModal({ isOpen: true, message: "This project is empty." });
                            }
                          }}
                          className={`text-sm font-medium hover:underline ${theme === 'dark' ? 'text-[#00ff9d]' : 'text-[#006633]'}`}
                        >View Details</button>
                      </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'xer0bytepedia' && (
          <div className="w-full max-w-4xl mx-auto p-4 md:p-8 pt-20 md:pt-24 h-full flex flex-col items-center justify-center">
            <Book size={64} className="mb-6 opacity-50" />
            <h2 className="text-3xl font-bold mb-4">Xer0bytepedia</h2>
            <p className="text-lg opacity-70 text-center max-w-md mb-8">The ultimate source of knowledge, curated by Xer0byte.</p>
            <div className={`flex items-center rounded-full p-1.5 h-16 border transition-all w-full max-w-2xl ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a] focus-within:border-[#555] focus-within:ring-4 focus-within:ring-white/10' : 'bg-[#f5f5f5] border-[#ddd] focus-within:border-[#999] focus-within:ring-4 focus-within:ring-black/10'}`}>
              <div className="pl-4 pr-2 text-[#666]">
                <Search size={20} />
              </div>
              <input 
                type="text" 
                placeholder="Search Xer0bytepedia..."
                onKeyDown={e => e.key === 'Enter' && handleSend((e.target as HTMLInputElement).value)}
                className={`flex-1 bg-transparent border-none outline-none text-[17px] px-2 ${theme === 'dark' ? 'text-white placeholder-[#666]' : 'text-black placeholder-[#999]'}`}
              />
            </div>
          </div>
        )}

        {view === 'ide' && (
          <div className={`w-full flex flex-col pt-[60px] md:pt-0 pb-0 absolute inset-0 bg-black ${isFullscreen ? 'z-[100] fixed h-screen w-screen' : 'z-40 h-full'}`}>
            <div className={`flex flex-wrap justify-between items-center p-3 sm:p-4 border-b gap-2 z-10 ${theme === 'dark' ? 'border-[#333] bg-[#0a0a0a]' : 'border-[#ddd] bg-white'}`}>
              <div className="flex items-center gap-2">
                <button onClick={() => setView('home')} className="md:hidden mr-2 p-1 hover:opacity-70"><X size={20}/></button>
                <PenTool size={20} className="text-[#00ff9d]" /> 
                <h2 className="text-lg sm:text-xl font-bold hidden sm:block">Xer0byte Live Sandbox IDE</h2>
                <div className={`ml-2 px-3 py-1.5 rounded-full border flex items-center gap-2 max-w-[200px] sm:max-w-none transition-all ${theme === 'dark' ? 'bg-[#111] border-[#333] hover:border-[#555]' : 'bg-[#f5f5f5] border-[#ddd] hover:border-[#999]'}`}>
                  <span className="text-xs font-semibold opacity-60 hidden sm:inline">Lang:</span>
                  <div className="relative flex items-center">
                    <select 
                      value={canvasLanguage} 
                      onChange={e => setCanvasLanguage(e.target.value)} 
                      className="bg-transparent text-sm outline-none font-mono focus:text-[#00ff9d] w-full appearance-none cursor-pointer pr-5"
                    >
                      <optgroup label="Application & Web">
                        <option value="html">HTML/JS/CSS (Web)</option>
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="csharp">C#</option>
                        <option value="php">PHP</option>
                        <option value="ruby">Ruby</option>
                        <option value="go">Go</option>
                        <option value="swift">Swift</option>
                        <option value="kotlin">Kotlin</option>
                        <option value="dart">Dart</option>
                        <option value="elixir">Elixir</option>
                        <option value="erlang">Erlang</option>
                      </optgroup>
                      <optgroup label="Systems & Low-Level">
                        <option value="c">C</option>
                        <option value="cpp">C++</option>
                        <option value="rust">Rust</option>
                        <option value="zig">Zig</option>
                        <option value="nim">Nim</option>
                        <option value="d">D</option>
                        <option value="ada">Ada</option>
                        <option value="assembly">Assembly</option>
                      </optgroup>
                      <optgroup label="Data & Logical">
                        <option value="r">R</option>
                        <option value="julia">Julia</option>
                        <option value="sql">SQL / SQLite</option>
                        <option value="prolog">Prolog</option>
                        <option value="lisp">Lisp</option>
                        <option value="haskell">Haskell</option>
                        <option value="clojure">Clojure</option>
                        <option value="scala">Scala</option>
                        <option value="ocaml">OCaml</option>
                        <option value="fsharp">F#</option>
                      </optgroup>
                      <optgroup label="Other A-Z">
                        <option value="bash">Bash</option>
                        <option value="basic">BASIC</option>
                        <option value="cobol">COBOL</option>
                        <option value="crystal">Crystal</option>
                        <option value="fortran">Fortran</option>
                        <option value="groovy">Groovy</option>
                        <option value="lua">Lua</option>
                        <option value="pascal">Pascal</option>
                        <option value="perl">Perl</option>
                      </optgroup>
                      <optgroup label="Esoteric">
                        <option value="brainfuck">Brainfuck</option>
                      </optgroup>
                    </select>
                    <ChevronDown size={14} className="absolute right-0 pointer-events-none opacity-50" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleRunCode}
                  disabled={isCanvasRunning || isThinkingIde}
                  className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-full font-medium text-xs md:text-sm border transition-all ${(isCanvasRunning || isThinkingIde) ? 'opacity-50 cursor-not-allowed' : ''} ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#00ff9d] hover:text-[#00ff9d] bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#006633] hover:text-[#006633] bg-transparent'}`}
                >
                  <Play size={14} fill="currentColor" /> {isCanvasRunning ? 'Running...' : 'Run Code'}
                </button>
                <button onClick={() => setCanvasMode(canvasMode === 'edit' ? 'split' : 'edit')} className={`px-3 md:px-4 py-1.5 rounded-full font-medium text-xs md:text-sm border transition-all ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}>
                  {canvasMode === 'edit' ? 'Show Output' : 'Hide Output'}
                </button>
                <button onClick={() => setIsFullscreen(!isFullscreen)} className={`px-3 md:px-4 py-1.5 rounded-full font-medium text-xs md:text-sm border transition-all hidden md:flex items-center gap-1.5 ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}>
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
                <button onClick={() => { 
                    if(canvasContent.trim()) {
                      setInputText(`Here is the code I have in my IDE:\n\n\`\`\`${canvasLanguage}\n${canvasContent}\n\`\`\`\n\nPlease `);
                      setView('chat');
                    } else {
                      setView('home');
                    }
                  }} className={`px-3 md:px-4 py-1.5 rounded-full font-medium text-xs md:text-sm border transition-all hidden sm:flex items-center gap-1.5 ml-1 ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}>
                  <MessageSquare size={14}/> Send to Chat
                </button>
              </div>
            </div>
            
            <div className={`flex-1 relative overflow-hidden flex flex-col md:flex-row pb-[60px] ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
              <div className={`flex-1 flex flex-col relative ${canvasMode === 'split' ? 'border-b md:border-b-0 md:border-r border-[#333]' : 'w-full max-w-4xl mx-auto'}`}>
                <div className="px-4 py-1.5 bg-black/20 text-xs font-mono font-bold opacity-50 uppercase tracking-wider text-black dark:text-white">Source Code ({canvasLanguage})</div>
                {isThinkingIde && (
                  <div className="absolute inset-0 bg-black/20 z-10 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="bg-[#111] text-[#00ff9d] border border-[#333] shadow-2xl px-4 py-2 rounded-xl font-mono text-sm animate-pulse flex items-center gap-2">
                      <PenTool size={16} className="animate-bounce" /> Writing code...
                    </div>
                  </div>
                )}
                <textarea 
                  value={canvasContent}
                  onChange={(e) => setCanvasContent(e.target.value)}
                  placeholder="Write, paste code, or ask AI below to generate code here..."
                  className={`flex-1 w-full p-4 resize-none outline-none font-mono text-[13px] md:text-sm leading-relaxed ${theme === 'dark' ? 'bg-transparent text-[#ddd] placeholder-[#444]' : 'bg-[#fafafa] text-[#333] placeholder-[#aaa]'}`}
                  spellCheck={false}
                />
              </div>

              {canvasMode === 'split' && (
                <div className={`flex-1 flex flex-col h-[50vh] md:h-full bg-black z-10`}>
                  <div className="px-4 py-1.5 bg-[#111] border-b border-[#333] text-xs font-mono font-bold text-[#00ff9d] uppercase tracking-wider flex justify-between items-center">
                    <span>{canvasLiveWeb ? 'Live Web Preview' : 'Console Output'}</span>
                    {isCanvasRunning && <span className="animate-pulse w-2 h-2 rounded-full bg-[#00ff9d]"></span>}
                  </div>
                  <div className="flex-1 overflow-auto bg-[#0a0a0a]">
                    {canvasLiveWeb ? (
                      <iframe 
                        title="Live Preview"
                        srcDoc={canvasContent}
                        className="w-full h-full border-none bg-white"
                        sandbox="allow-scripts allow-popups opacity-100"
                      />
                    ) : (
                      <pre className="p-4 font-mono text-[13px] text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {canvasOutput || (
                          <span className="opacity-40 italic">Output will appear here after running...</span>
                        )}
                      </pre>
                    )}
                  </div>
                </div>
              )}
              
              {/* AI Prompt Input Bar attached to bottom of IDE */}
              <div className={`absolute bottom-0 left-0 right-0 p-3 flex justify-center z-20 border-t backdrop-blur-xl ${theme === 'dark' ? 'bg-[#111]/80 border-[#333]' : 'bg-white/80 border-[#ddd]'}`}>
                 <div className="w-full max-w-4xl mx-auto flex flex-col">
                   {ideSelectedFiles.length > 0 && (
                     <div className="flex gap-2 overflow-x-auto pb-2 px-4">
                       {ideSelectedFiles.map((file, idx) => (
                         <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#eee] border-[#ddd]'}`}>
                           <Paperclip size={12} className="opacity-50" />
                           <span className="max-w-[150px] truncate">{file.name}</span>
                           <button onClick={() => setIdeSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-500 opacity-70 hover:opacity-100 ml-1"><X size={12} /></button>
                         </div>
                       ))}
                     </div>
                   )}
                   <div className={`flex items-center rounded-full px-2 py-1.5 border transition-all shadow-sm ${theme === 'dark' ? 'bg-[#0a0a0a] border-[#444] focus-within:border-[#00ff9d] focus-within:ring-2 focus-within:ring-[#00ff9d]/20' : 'bg-[#f5f5f5] border-[#ccc] focus-within:border-[#006633] focus-within:ring-2 focus-within:ring-[#006633]/20'}`}>
                      <div className="flex items-center gap-1 md:gap-2 px-1">
                        <input type="file" ref={ideFileInputRef} onChange={handleIdeFileSelect} className="hidden" accept="*/*" multiple />
                        <button onClick={() => ideFileInputRef.current?.click()} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-[#ddd]'}`}>
                          <Plus size={20} />
                        </button>
                      </div>

                      <div className="border-r h-6 mx-1 opacity-20 dark:border-white border-black"></div>

                      <span className={`mx-2 hidden sm:block ${theme === 'dark' ? 'text-[#00ff9d]' : 'text-[#006633]'}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg></span>
                      <input 
                        type="text"
                        value={idePrompt}
                        onChange={e => setIdePrompt(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter') handleIdeSubmit() }}
                        disabled={isThinkingIde}
                        placeholder={ideSelectedFiles.length > 0 ? "Tell AI what to do with these files & code..." : "Prompt AI to edit your code (e.g., 'Change this to loop 10 times')"}
                        className={`w-full bg-transparent border-none text-[15px] outline-none py-1 mr-2 ${theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-black placeholder-gray-400'}`}
                      />

                      <div className="flex items-center gap-1 pr-1">
                        <button onClick={startListeningIde} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-[#ddd]'} ${isListeningIde ? 'text-red-500 animate-pulse' : ''}`}>
                          <Mic size={20} />
                        </button>
                        <button 
                         onClick={handleIdeSubmit}
                         disabled={(!idePrompt.trim() && ideSelectedFiles.length === 0) || isThinkingIde}
                         className={`p-2.5 rounded-full transition-all flex items-center justify-center ${(idePrompt.trim() || ideSelectedFiles.length > 0) ? (theme === 'dark' ? 'bg-[#00ff9d] text-black hover:bg-white hover:scale-105' : 'bg-black text-white hover:bg-gray-800 hover:scale-105') : (theme === 'dark' ? 'bg-[#333] text-gray-500 cursor-not-allowed' : 'bg-[#ddd] text-gray-500 cursor-not-allowed')}`}
                        >
                          <Send size={18} />
                        </button>
                      </div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {view === 'admin' && (
          <AdminPanel token={token} theme={theme} />
        )}
      </main>
      
      {/* Modals */}
      
      {/* Tasks Modal */}
      {modals.tasks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setModals({...modals, tasks: false}) }}>
          <div className={`w-full max-w-[500px] max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
            <div className={`flex justify-between items-center p-4 px-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
              <h2 className="text-xl font-semibold">Tasks</h2>
              <button onClick={() => setModals({...modals, tasks: false})} className="hover:opacity-70 p-1"><X size={24} /></button>
            </div>
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <form onSubmit={handleCreateTask} className="mb-6 flex gap-2">
                <input 
                  type="text" 
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className={`flex-1 px-4 py-2 rounded-xl border outline-none transition-all text-sm md:text-base ${theme === 'dark' ? 'bg-[#161616] border-[#333] focus:border-[#00ff9d]' : 'bg-white border-[#ddd] focus:border-black'}`}
                />
                <button type="submit" className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-[#00ff9d] text-black' : 'bg-black text-white'}`}>
                  <Plus size={20} />
                </button>
              </form>
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-center opacity-50 py-10">No tasks yet.</div>
                ) : (
                  tasks.map(task => (
                    <div key={task._id || task.id} className={`flex items-center gap-3 p-3 rounded-xl border ${theme === 'dark' ? 'bg-[#161616] border-[#222]' : 'bg-white border-[#eee]'}`}>
                      <input 
                        type="checkbox" 
                        checked={task.completed} 
                        onChange={() => handleToggleTask(task._id || task.id, task.completed)}
                        className="w-5 h-5 accent-[#00ff9d] cursor-pointer"
                      />
                      <span className={`flex-1 text-sm md:text-base ${task.completed ? 'line-through opacity-50' : ''}`}>{task.title}</span>
                      <button 
                        onClick={async () => {
                          const taskId = task._id || task.id;
                          if (!user || !taskId) return;
                          try {
                            await firestoreService.deleteTask(user.id, taskId);
                            setTasks(prev => prev.filter(t => (t._id || t.id) !== taskId));
                          } catch (e) {
                            console.error('Delete task failed', e);
                          }
                        }}
                        className="opacity-50 hover:opacity-100 hover:text-red-500 transition-colors p-1"
                      >
                         <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {modals.createProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setModals({...modals, createProject: false}) }}>
          <div className={`w-[90%] max-w-[600px] rounded-2xl border shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
            <div className={`flex justify-between items-center p-4 px-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
              <h2 className="text-xl font-semibold">New Project</h2>
              <button onClick={() => setModals({...modals, createProject: false})} className="hover:opacity-70"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 opacity-70">Project Name</label>
                <input 
                  required
                  type="text" 
                  value={projectForm.name}
                  onChange={e => setProjectForm({...projectForm, name: e.target.value})}
                  className={`w-full px-4 py-2 rounded-xl border outline-none transition-all ${theme === 'dark' ? 'bg-[#161616] border-[#333] focus:border-[#00ff9d]' : 'bg-white border-[#ddd] focus:border-black'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 opacity-70">Description</label>
                <input 
                  type="text" 
                  value={projectForm.description}
                  onChange={e => setProjectForm({...projectForm, description: e.target.value})}
                  className={`w-full px-4 py-2 rounded-xl border outline-none transition-all ${theme === 'dark' ? 'bg-[#161616] border-[#333] focus:border-[#00ff9d]' : 'bg-white border-[#ddd] focus:border-black'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 opacity-70">Content / Code</label>
                <textarea 
                  rows={6}
                  value={projectForm.content}
                  onChange={e => setProjectForm({...projectForm, content: e.target.value})}
                  className={`w-full px-4 py-2 rounded-xl border outline-none transition-all font-mono text-sm ${theme === 'dark' ? 'bg-[#161616] border-[#333] focus:border-[#00ff9d]' : 'bg-white border-[#ddd] focus:border-black'}`}
                />
              </div>
              <button type="submit" className={`w-full py-3 rounded-xl font-bold transition-all ${theme === 'dark' ? 'bg-[#00ff9d] text-black hover:bg-[#00cc7e]' : 'bg-black text-white hover:bg-gray-800'}`}>
                Create Project
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {modals.settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setModals({...modals, settings: false}) }}>
          <div className={`w-full max-w-[720px] max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
            <div className={`flex justify-between items-center p-4 px-6 border-b sticky top-0 z-10 ${theme === 'dark' ? 'border-[#333] bg-[#111]' : 'border-[#ddd] bg-[#f5f5f5]'}`}>
              <h2 className="text-xl font-semibold">Settings</h2>
              <button onClick={() => setModals({...modals, settings: false})} className="hover:opacity-70 p-1"><X size={24} /></button>
            </div>
            
            <div className="p-4 md:p-6 space-y-8">
              {/* Account Section */}
              <section>
                <h3 className={`text-base font-semibold mb-3 ${theme === 'dark' ? 'text-[#00ff9d]' : 'text-[#006633]'}`}>Account</h3>
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 gap-4 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#ddd]'}`}>
                  <div className="flex items-center gap-4">
                    {user?.profilePhoto ? (
                      <img src={user.profilePhoto} alt={user.name} className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0" style={{ background: user ? user.avatarColor : '#555' }}>
                        {user ? user.name.charAt(0) : 'U'}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-sm md:text-base">{user ? user.name : 'Not logged in'}</div>
                      <div className="text-xs md:text-sm opacity-60 truncate max-w-[180px] md:max-w-none">{user ? user.email : ''}</div>
                    </div>
                  </div>
                  <button onClick={() => setModals({...modals, settings: false, manageAccount: true})} className={`w-full sm:w-auto px-4 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-[#222] border-[#444] hover:bg-[#333]' : 'bg-[#e0e0e0] border-[#ccc] hover:bg-[#d0d0d0]'}`}>Manage</button>
                </div>
              </section>
              
              {/* Appearance Section */}
              <section>
                <h3 className={`text-base font-semibold mb-3 ${theme === 'dark' ? 'text-[#00ff9d]' : 'text-[#006633]'}`}>Appearance</h3>
                <div className={`flex justify-between items-center py-3 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#ddd]'}`}>
                  <span className="text-sm md:text-base">Theme</span>
                  <div className="flex gap-2">
                    <button onClick={() => setTheme('light')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm ${theme === 'light' ? 'bg-[#00ff9d] text-black border-transparent' : 'bg-[#222] border border-[#444]'}`}>Light</button>
                    <button onClick={() => setTheme('dark')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm ${theme === 'dark' ? 'bg-[#00ff9d] text-black border-transparent' : 'bg-[#e0e0e0] border border-[#ccc]'}`}>Dark</button>
                  </div>
                </div>
                <div className={`flex justify-between items-center py-3 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#ddd]'}`}>
                  <span className="text-sm md:text-base pr-4">Wrap long lines for code blocks</span>
                  <div onClick={() => toggleSetting('wrapCode')} className={`w-11 h-6 shrink-0 rounded-full relative cursor-pointer transition-colors ${settings.wrapCode ? 'bg-[#00ff9d]' : (theme === 'dark' ? 'bg-[#333]' : 'bg-[#ccc]')}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings.wrapCode ? 'left-[22px]' : 'left-0.5'}`}></div>
                  </div>
                </div>
              </section>

              {/* Behavior Section */}
              <section>
                <h3 className={`text-base font-semibold mb-3 ${theme === 'dark' ? 'text-[#00ff9d]' : 'text-[#006633]'}`}>Behavior</h3>
                <div className={`flex justify-between items-center py-3 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#ddd]'}`}>
                  <span className="text-sm md:text-base">Enable Auto Scroll</span>
                  <div onClick={() => toggleSetting('autoScroll')} className={`w-11 h-6 shrink-0 rounded-full relative cursor-pointer transition-colors ${settings.autoScroll ? 'bg-[#00ff9d]' : (theme === 'dark' ? 'bg-[#333]' : 'bg-[#ccc]')}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings.autoScroll ? 'left-[22px]' : 'left-0.5'}`}></div>
                  </div>
                </div>
                <div className={`flex justify-between items-center py-3 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#ddd]'}`}>
                  <span className="text-sm md:text-base pr-4">Enable Sidebar Editor</span>
                  <div onClick={() => toggleSetting('sidebarEditor')} className={`w-11 h-6 shrink-0 rounded-full relative cursor-pointer transition-colors ${settings.sidebarEditor ? 'bg-[#00ff9d]' : (theme === 'dark' ? 'bg-[#333]' : 'bg-[#ccc]')}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings.sidebarEditor ? 'left-[22px]' : 'left-0.5'}`}></div>
                  </div>
                </div>
              </section>

              {/* Data Controls Section */}
              <section>
                <h3 className={`text-base font-semibold mb-3 ${theme === 'dark' ? 'text-[#00ff9d]' : 'text-[#006633]'}`}>Data Controls</h3>
                <div className={`flex justify-between items-center py-3 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#ddd]'}`}>
                  <span className="text-sm md:text-base">Delete All Conversations</span>
                  <button onClick={handleDeleteAll} className="px-4 py-2 rounded-lg bg-[#ff4444] text-white hover:bg-[#ff3333] border-none font-medium text-sm md:text-base">Delete</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Pro Modal */}
      {modals.upgradePro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-5xl py-10 flex flex-col items-center relative">
            
            <button onClick={() => { setModals({...modals, upgradePro: false}); setUpgradeStep('plans'); }} className="absolute top-0 right-0 md:top-6 md:right-6 text-white/50 hover:text-white transition-colors p-2">
              <X size={32} />
            </button>

            {upgradeStep === 'plans' ? (
              <div className="w-full">
                <div className="text-center mb-10">
                  <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3">
                    <span className="text-[#00ff9d]">⊘</span> SuperXer0byte
                  </h2>
                  <p className="text-lg md:text-xl text-white/80">Unlock the full power of Chat with Xer0byte 4.2</p>
                </div>

                <div className="flex bg-[#222] rounded-full p-1 mb-10 max-w-xs mx-auto">
                  <button onClick={() => setPlanTab('individual')} className={`flex-1 px-4 md:px-6 py-2 rounded-full text-sm font-medium transition-colors ${planTab === 'individual' ? 'bg-[#444] text-white' : 'text-white/60 hover:text-white'}`}>Individual</button>
                  <button onClick={() => setPlanTab('business')} className={`flex-1 px-4 md:px-6 py-2 rounded-full text-sm font-medium transition-colors ${planTab === 'business' ? 'bg-[#444] text-white' : 'text-white/60 hover:text-white'}`}>Business</button>
                </div>

                <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
                  
                  {/* Lite Plan */}
                  <div className="bg-[#1a1a1a] border border-[#333] rounded-3xl p-6 md:p-8 flex flex-col">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2">SuperXer0byte Lite {planTab === 'business' && '(Yearly)'}</h3>
                    <div className="flex items-baseline gap-2 mb-6">
                      <span className="text-3xl md:text-4xl font-bold text-white">
                        {currency === 'USD' ? '$' : 'Rs '}{planTab === 'individual' ? prices.lite[currency] : prices.business_lite[currency]}
                      </span>
                      <span className="text-white/50 text-sm">{currency}/{planTab === 'individual' ? 'month' : 'year'}</span>
                    </div>
                    <p className="text-white/80 mb-8 font-medium text-sm md:text-base">Keep chatting with basic access</p>
                    
                    <button onClick={() => handleUpgradePro(planTab === 'individual' ? 'lite' : 'business_lite')} className="w-full py-3 md:py-4 rounded-xl bg-[#333] text-white font-bold text-base md:text-lg hover:bg-[#444] transition-colors mb-8">
                      Upgrade to Lite
                    </button>

                    <ul className="space-y-4 md:space-y-5 text-white/80 font-medium flex-1 text-sm md:text-base">
                      {planTab === 'individual' ? (
                        <>
                          <li className="flex items-center gap-4"><span className="text-white">🚀</span> Access to Gemini 1.5 Pro</li>
                          <li className="flex items-center gap-4"><span className="text-white">🎤</span> Live AI Voice Mode Access</li>
                          <li className="flex items-center gap-4"><span className="text-white">💻</span> Live Coding Sandbox (IDE)</li>
                          <li className="flex items-center gap-4"><span className="text-white">📁</span> 5 GB Secure Storage</li>
                          <li className="flex items-center gap-4"><span className="text-white">⚡</span> Increased message limits</li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-center gap-4"><span className="text-white">🚀</span> Gemini 1.5 Pro for Teams</li>
                          <li className="flex items-center gap-4"><span className="text-white">🎤</span> Unlimited Voice Mode for all members</li>
                          <li className="flex items-center gap-4"><span className="text-white">💻</span> Shared Live Coding IDEs</li>
                          <li className="flex items-center gap-4"><span className="text-white">📁</span> 100 GB Secure Storage</li>
                          <li className="flex items-center gap-4"><span className="text-white">🎧</span> Priority Customer Support</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Pro Plan */}
                  <div className="bg-gradient-to-b from-[#2a1a1a] to-[#1a1a1a] border border-[#553333] rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff6b00] opacity-10 blur-[100px] rounded-full"></div>
                    
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2 relative z-10">SuperXer0byte {planTab === 'business' && '(Yearly)'}</h3>
                    <div className="flex items-baseline gap-2 mb-6 relative z-10">
                      <span className="text-3xl md:text-4xl font-bold text-white">
                        {currency === 'USD' ? '$' : 'Rs '}{planTab === 'individual' ? prices.pro[currency] : prices.business_pro[currency]}
                      </span>
                      <span className="text-white/50 text-sm">{currency}/{planTab === 'individual' ? 'month' : 'year'}</span>
                    </div>
                    <p className="text-white/80 mb-8 font-medium text-sm md:text-base relative z-10">Get better answers, faster</p>
                    
                    <button onClick={() => handleUpgradePro(planTab === 'individual' ? 'pro' : 'business_pro')} className="w-full py-3 md:py-4 rounded-xl bg-white text-black font-bold text-base md:text-lg hover:bg-gray-200 transition-colors mb-8 relative z-10">
                      Upgrade to SuperXer0byte
                    </button>

                    <ul className="space-y-4 md:space-y-5 text-white/80 font-medium flex-1 relative z-10 text-sm md:text-base">
                      {planTab === 'individual' ? (
                        <>
                          <li className="flex items-center gap-4"><span className="text-white">🚀</span> Advanced Gemini 1.5 Pro & Thinking Models</li>
                          <li className="flex items-start gap-4">
                            <span className="text-white mt-1">📚</span> 
                            <div>
                              <div className="text-white">Full Access to Xer0byteLM</div>
                              <div className="text-xs md:text-sm text-white/50 font-normal">Deep research AI with Audio overviews</div>
                            </div>
                          </li>
                          <li className="flex items-start gap-4">
                            <span className="text-white mt-1">🎤</span> 
                            <div>
                              <div className="text-white">Unlimited Live AI Voice Mode</div>
                              <div className="text-xs md:text-sm text-white/50 font-normal">Speak natively to your AI assistant</div>
                            </div>
                          </li>
                          <li className="flex items-center gap-4"><span className="text-white">💻</span> Unlimited Live Sandbox IDE Usage</li>
                          <li className="flex items-center gap-4"><span className="text-white">📁</span> 20 GB Secure Cloud Storage</li>
                          <li className="flex items-center gap-4"><span className="text-white">⚡</span> Zero limits on conversation length</li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-center gap-4"><span className="text-white">🚀</span> Unlimited access across your entire team</li>
                          <li className="flex items-start gap-4">
                            <span className="text-white mt-1">📚</span> 
                            <div>
                              <div className="text-white">Xer0byteLM Enterprise Mode</div>
                              <div className="text-xs md:text-sm text-white/50 font-normal">Ground AI entirely on your company data</div>
                            </div>
                          </li>
                          <li className="flex items-start gap-4">
                            <span className="text-white mt-1">📁</span> 
                            <div>
                              <div className="text-white">500 GB Secure Cloud Storage</div>
                              <div className="text-xs md:text-sm text-white/50 font-normal">Massive capacity for large enterprise logic</div>
                            </div>
                          </li>
                          <li className="flex items-center gap-4"><span className="text-white">🛡️</span> Enterprise Security & Priority SSO</li>
                          <li className="flex items-center gap-4"><span className="text-white">👨‍💼</span> Dedicated Account Manager</li>
                        </>
                      )}
                    </ul>
                  </div>

                </div>
              </div>
            ) : (
              <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-3xl p-6 md:p-8 flex flex-col">
                <button onClick={() => setUpgradeStep('plans')} className="text-white/50 hover:text-white mb-6 self-start flex items-center gap-2 text-sm">
                  <span>←</span> Back to plans
                </button>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Complete Payment</h3>
                <p className="text-white/70 mb-6 text-sm md:text-base">
                  Please send <strong>{currency === 'USD' ? '$' : 'Rs '}{prices[selectedPlanToUpgrade][currency]}</strong> to the following account to activate your {selectedPlanToUpgrade.replace('_', ' ').toUpperCase()} plan.
                </p>

                <div className="bg-[#222] p-4 md:p-6 rounded-xl mb-6 border border-[#444] text-center space-y-4">
                  <div>
                    <div className="text-sm text-white/50 mb-1">Easypaisa / Jazzcash</div>
                    <div className="text-xl md:text-2xl font-mono text-[#00ff9d] font-bold tracking-wider">03294733140</div>
                  </div>
                  <div className="border-t border-[#444] pt-4">
                    <div className="text-sm text-white/50 mb-1">Meezan Bank</div>
                    <div className="text-base md:text-xl font-mono text-[#00ff9d] font-bold tracking-wider mb-1">11320113622881</div>
                    <div className="text-xs md:text-sm font-mono text-[#00b8ff] break-all">IBAN: PK46 MEZN 0011320113622881</div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Payment Method Used</label>
                    <select 
                      value={paymentFormState.method}
                      onChange={e => setPaymentFormState({...paymentFormState, method: e.target.value})}
                      className="w-full bg-[#222] border border-[#444] rounded-xl p-3 text-white outline-none focus:border-[#00ff9d] text-sm md:text-base"
                    >
                      <option value="easypaisa">Easypaisa</option>
                      <option value="jazzcash">Jazzcash</option>
                      <option value="meezan">Meezan Bank</option>
                      <option value="bank">Other Bank Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Your Account / Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 03001234567"
                      value={paymentFormState.phone}
                      onChange={e => setPaymentFormState({...paymentFormState, phone: e.target.value})}
                      className="w-full bg-[#222] border border-[#444] rounded-xl p-3 text-white outline-none focus:border-[#00ff9d] text-sm md:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Upload Payment Screenshot</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handlePaymentProofUpload}
                      className="w-full bg-[#222] border border-[#444] rounded-xl p-2 text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs md:file:text-sm file:font-semibold file:bg-[#333] file:text-white hover:file:bg-[#444]"
                    />
                    {paymentFormState.proof && (
                      <div className="mt-3 text-sm text-[#00ff9d] flex items-center gap-2">
                        <span>✓</span> Screenshot attached
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={handlePaymentSubmit} disabled={isSubmittingPayment} className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00ff9d] to-[#00b8ff] text-black font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50">
                  {isSubmittingPayment ? 'Submitting...' : 'Submit Payment Proof'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {(modals.signIn || modals.signUp) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setModals({...modals, signIn: false, signUp: false}) }}>
          <div className={`w-full max-w-[480px] rounded-2xl border shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
            <div className={`flex justify-between items-center p-4 px-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
              <h2 className="text-xl font-semibold">{modals.signIn ? 'Sign in' : 'Sign up'}</h2>
              <button onClick={() => {
                setModals({...modals, signIn: false, signUp: false});
                setAuthError('');
                setAuthForm({ name: '', email: '', password: '' });
              }} className="hover:opacity-70 p-1"><X size={24} /></button>
            </div>
            <div className="p-4 md:p-6">
              {window.location.hostname.includes('run.app') && (
                <div className={`mb-4 p-3 rounded-lg text-xs flex items-center justify-between ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <span>Having trouble signing in? Try opening in a new tab.</span>
                  <a href={window.location.href} target="_blank" rel="noreferrer" className="underline font-bold ml-2 shrink-0">Open Tab</a>
                </div>
              )}
              {authError && <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-500 text-sm whitespace-pre-wrap">
                {authError}
                <div className="mt-2 text-xs opacity-80">
                  <span className="block mb-1">If your Firebase setup is pending, you can use:</span>
                  <button 
                    type="button"
                    onClick={() => {
                      const mockUser = {
                        id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
                        name: 'Demo User',
                        email: 'demo@xer0byte.ai',
                        avatarColor: '#00ff9d',
                        role: 'user',
                        plan: 'free',
                        messageCount: 0,
                        subscriptionStatus: 'none'
                      };
                      setUser(mockUser as any);
                      setToken("demo-session");
                      localStorage.setItem('xer0byteUser', JSON.stringify(mockUser));
                      setModals(prev => ({ ...prev, signIn: false, signUp: false }));
                      setAuthError(null);
                    }}
                    className="underline font-bold hover:text-white"
                  >
                    Guest/Demo Access »
                  </button>
                </div>
              </div>}
              
              <form onSubmit={modals.signIn ? handleLogin : handleSignUp} className="space-y-4">
                {modals.signUp && (
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-80">Name</label>
                    <input 
                      type="text" 
                      required
                      value={authForm.name}
                      onChange={e => setAuthForm({...authForm, name: e.target.value})}
                      className={`w-full p-3 rounded-xl border outline-none transition-all text-sm md:text-base ${theme === 'dark' ? 'bg-[#222] border-[#444] focus:border-[#00ff9d]' : 'bg-white border-[#ccc] focus:border-[#006633]'}`}
                      placeholder="Your name"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-80">Email</label>
                  <input 
                    type="email" 
                    required
                    value={authForm.email}
                    onChange={e => setAuthForm({...authForm, email: e.target.value})}
                    className={`w-full p-3 rounded-xl border outline-none transition-all text-sm md:text-base ${theme === 'dark' ? 'bg-[#222] border-[#444] focus:border-[#00ff9d]' : 'bg-white border-[#ccc] focus:border-[#006633]'}`}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-80">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      value={authForm.password}
                      onChange={e => setAuthForm({...authForm, password: e.target.value})}
                      className={`w-full p-3 rounded-xl border outline-none transition-all text-sm md:text-base ${theme === 'dark' ? 'bg-[#222] border-[#444] focus:border-[#00ff9d]' : 'bg-white border-[#ccc] focus:border-[#006633]'}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <button type="submit" className={`w-full py-3 rounded-xl font-medium mt-2 transition-all text-sm md:text-base ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>
                  {modals.signIn ? 'Sign In' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6 flex items-center gap-4">
                <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-[#333]' : 'bg-[#ddd]'}`}></div>
                <div className="text-xs md:text-sm opacity-50">or continue with</div>
                <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-[#333]' : 'bg-[#ddd]'}`}></div>
              </div>

              <div className="flex gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => handleGoogleSuccess()} 
                  disabled={isGoogleLoading}
                  className={`relative w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-colors font-medium text-sm md:text-base ${isGoogleLoading ? 'opacity-50 cursor-wait' : ''} ${theme === 'dark' ? 'border-[#444] hover:bg-[#222]' : 'border-[#ccc] hover:bg-[#e0e0e0]'}`}
                >
                  {isGoogleLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Connecting...</span>
                    </div>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Continue with Google
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-6 text-center text-sm opacity-70">
                {modals.signIn ? (
                  <>Don't have an account? <button type="button" onClick={() => { setModals({...modals, signIn: false, signUp: true}); setAuthError(''); }} className="underline hover:text-[#00ff9d]">Sign up</button></>
                ) : (
                  <>Already have an account? <button type="button" onClick={() => { setModals({...modals, signUp: false, signIn: true}); setAuthError(''); }} className="underline hover:text-[#00ff9d]">Sign in</button></>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Account Modal */}
      {modals.manageAccount && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={(e) => { if(e.target === e.currentTarget) setModals({...modals, manageAccount: false}) }}>
          <div className={`w-full max-w-[520px] rounded-2xl border shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f8f8f8] border-[#ccc] text-black'}`}>
            <div className={`flex justify-between items-center p-4 px-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
              <h2 className="text-xl font-semibold">Manage Account</h2>
              <button onClick={() => setModals({...modals, manageAccount: false})} className="hover:opacity-70 p-1"><X size={24} /></button>
            </div>
            <div className="p-4 md:p-6">
              <div className="flex items-center gap-5 mb-8">
                {user?.profilePhoto ? (
                  <img src={user.profilePhoto} alt={user?.name || 'User'} className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover shrink-0 border border-white/10" />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold text-white shrink-0" style={{ background: user ? user.avatarColor : '#555' }}>
                    {user ? user.name.charAt(0) : 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xl md:text-2xl font-semibold truncate">{user ? user.name : 'Not logged in'}</div>
                  <div className={`text-sm md:text-[15px] truncate ${theme === 'dark' ? 'text-[#aaa]' : 'text-[#555]'}`}>{user ? user.email : ''}</div>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className={`flex justify-between items-center py-3.5 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#eee]'}`}>
                  <span className="text-sm md:text-base">Change Profile Picture</span>
                  <input type="file" accept="image/*" ref={profilePhotoInputRef} className="hidden" onChange={handleProfilePhotoUpload} />
                  <button onClick={() => profilePhotoInputRef.current?.click()} className={`px-3 md:px-4 py-1.5 rounded-lg border text-xs md:text-sm ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#e0e0e0] border-[#ccc]'}`}>Upload</button>
                </div>
                <div className={`flex justify-between items-center py-3.5 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#eee]'}`}>
                  <span className="text-sm md:text-base">Update Name</span>
                  <button onClick={handleUpdateName} className={`px-3 md:px-4 py-1.5 rounded-lg border text-xs md:text-sm ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#e0e0e0] border-[#ccc]'}`}>Edit</button>
                </div>
                <div className={`flex justify-between items-center py-3.5 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#eee]'}`}>
                  <span className="text-sm md:text-base">Update Email</span>
                  <button onClick={() => setAlertModal({isOpen: true, message: "For security, please contact support to change your email."})} className={`px-3 md:px-4 py-1.5 rounded-lg border text-xs md:text-sm ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#e0e0e0] border-[#ccc]'}`}>Edit</button>
                </div>
                <div className={`flex justify-between items-center py-3.5 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#eee]'}`}>
                  <span className="text-sm md:text-base">Change Password</span>
                  <button onClick={handleResetPassword} className={`px-3 md:px-4 py-1.5 rounded-lg border text-xs md:text-sm ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#e0e0e0] border-[#ccc]'}`}>Reset</button>
                </div>
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 mt-4 gap-3 border-t ${theme === 'dark' ? 'border-[#444]' : 'border-[#ddd]'}`}>
                  <span className="text-sm md:text-base">Sign out from all devices</span>
                  <button onClick={handleLogout} className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#ff4444]/20 text-[#ff4444] hover:bg-[#ff4444]/30 text-sm font-medium">Sign out everywhere</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
      
      {/* Cookie Consent Banner Ribbon */}
      {!hasAcceptedCookies && (
        <div className={`relative flex flex-col items-center justify-between gap-4 p-4 border-t z-[40] shrink-0 w-full transition-all md:flex-row ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
          <div className={`text-sm text-center md:text-left ${theme === 'dark' ? 'text-[#ddd]' : 'text-[#555]'}`}>
            We use cookies to improve your experience and save your preferences. By continuing to use this site, you consent to our use of cookies.
          </div>
          <div className="flex justify-center md:justify-end gap-3 w-full md:w-auto">
            <button onClick={() => { localStorage.setItem('xer0byteCookies', 'declined'); setHasAcceptedCookies(true); }} className={`p-2 rounded-full border transition-all flex items-center justify-center ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}>
              <X size={16} />
            </button>
            <button onClick={handleAcceptCookies} className={`px-4 py-1.5 rounded-full text-sm border transition-all ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}>
              Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}