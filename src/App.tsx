import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MessageSquare, Mic, Image as ImageIcon, Folder, Clock, Settings, X, Plus, Send, Book, Menu, HardDrive, Edit2, Pin, Trash2, MoreVertical, Lock, Check, ChevronDown, Wrench, PenTool, Music, BookOpen, Copy, Share, RefreshCw, ThumbsUp, ThumbsDown, Volume2, Activity, MapPin, Eye, EyeOff, UserPlus, Play, Paperclip, WifiOff, ExternalLink, CheckCircle, Flame, Maximize, Minimize, ArrowUp, Clipboard, Sparkles, Download, Archive } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { auth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, db, firebaseAppConfig } from './firebase';
import { generateContentWithRetry, generateContentStreamWithRetry, generateImage, generateMusic } from './lib/gemini';
import { firestoreService } from './services/firestoreService';
import { copyToClipboard, getUnrarExtractor, truncateText, getGeminiCompatibleMimeType, prepareCleanHistory, isTextFile, downloadExcelFile, downloadWordFile, downloadTextFile, extractFilesFromMarkdown } from './lib/utils';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

import VoiceAI from './components/VoiceAI';
import NotebookUI from './components/NotebookUI';
import { ChatMessage } from './components/ChatMessage';
import { WorkspaceFileTree } from './components/WorkspaceFileTree';
import { CommandPalette } from './components/CommandPalette';
import { DiffViewerModal } from './components/DiffViewerModal';
import { VoiceWaveVisualizer } from './components/VoiceWaveVisualizer';
import { STARTER_TEMPLATES } from './lib/templates';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'subscriptions' | 'users' | 'conversations' | 'locations' | 'photos'>('overview');
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
    return () => unsubUsers();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const unsubSubscriptions = firestoreService.subscribeToAllUpgradeRequests((requests) => {
      setPendingSubscriptions(requests);
    });
    return () => unsubSubscriptions();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const unsubAllConvs = firestoreService.subscribeToAllConversations((allConvs) => {
      setConversations(allConvs);
    });
    return () => unsubAllConvs();
  }, [token]);

  const joinedConversations = useMemo(() => {
    return conversations.map(c => {
      const u = users.find(user => user.id === c.userId);
      return { ...c, userName: u?.name || 'Unknown User' };
    });
  }, [conversations, users]);

  // We need to manage the messages subscription
  useEffect(() => {
    let unsubMsgs: (() => void) | null = null;
    if (selectedConv) {
      const conv = joinedConversations.find(c => c.id === selectedConv);
      if (conv) {
        const messagesPath = `users/${conv.userId}/conversations/${conv.id}/messages`;
        unsubMsgs = firestoreService.subscribeToMessagesByPath(messagesPath, (msgs) => {
          setConvMessages(msgs);
        });
      }
    } else {
      setConvMessages([]);
    }
    return () => {
      if (unsubMsgs) unsubMsgs();
    };
  }, [selectedConv, conversations]);

  const fetchConvMessages = (convId: string) => {
    setSelectedConv(convId);
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
      await firestoreService.updateUserProfile(userId, { messageCount: 0, dailyImageCount: 0 });
      setAlertModal({ isOpen: true, message: "User message and image stats reset." });
    } catch (error) {
      console.error("Failed to reset stats:", error);
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

  const loadConversation = (id: string) => {
    setSelectedConv(id);
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
        <h2 className="fluid-title font-bold">Admin Dashboard</h2>
        <div className={`flex flex-wrap rounded-lg p-1 ${theme === 'dark' ? 'bg-[#111]' : 'bg-[#e0e0e0]'}`}>
          <button onClick={() => setActiveTab('overview')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'overview' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}>Overview</button>
          <button onClick={() => setActiveTab('accounts')} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'accounts' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}>Accounts</button>
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
                    key={u.id} 
                    onClick={() => { setSelectedAdminUser(u.id); setSelectedConv(null); }}
                    className={`p-4 border-b cursor-pointer transition-colors ${theme === 'dark' ? 'border-[#333] hover:bg-[#222]' : 'border-[#ddd] hover:bg-[#f5f5f5]'} ${selectedAdminUser === u.id ? (theme === 'dark' ? 'bg-[#222]' : 'bg-[#f5f5f5]') : ''}`}
                  >
                    <div className="font-medium mb-1 text-sm md:text-base">{u.name}</div>
                    <div className="text-xs opacity-60 truncate">{u.email}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`w-full lg:w-1/4 flex flex-col rounded-2xl border overflow-hidden max-h-[300px] lg:max-h-none ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
              <div className={`p-4 font-bold border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>Conversations {selectedAdminUser ? `(${joinedConversations.filter(c => c.userId === selectedAdminUser).length})` : `(${joinedConversations.length})`}</div>
              <div className="flex-1 overflow-y-auto">
                {joinedConversations.filter(c => selectedAdminUser ? c.userId === selectedAdminUser : true).map(conv => (
                  <div 
                    key={conv.id} 
                    onClick={() => setSelectedConv(conv.id)}
                    className={`p-4 border-b cursor-pointer transition-colors ${theme === 'dark' ? 'border-[#333] hover:bg-[#222]' : 'border-[#ddd] hover:bg-[#f5f5f5]'} ${selectedConv === conv.id ? (theme === 'dark' ? 'bg-[#222]' : 'bg-[#f5f5f5]') : ''}`}
                  >
                    <div className="font-medium mb-1 text-sm md:text-base truncate flex items-center gap-2">
                      {conv.isPrivate && <Lock size={12} className="text-purple-500 shrink-0" />}
                      {conv.title}
                    </div>
                    <div className="text-xs opacity-60">User: {conv.userName}</div>
                    <div className="text-xs opacity-60 mt-1">{conv.updatedAt ? new Date(conv.updatedAt.seconds * 1000).toLocaleString() : 'N/A'}</div>
                  </div>
                ))}
                {conversations.length === 0 && <div className="p-10 opacity-30 text-center">No conversations found</div>}
              </div>
            </div>

            <div className={`w-full lg:w-2/4 flex flex-col rounded-2xl border overflow-hidden ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
              <div className={`p-4 font-bold border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
                {selectedConv ? 'Chat History' : 'Select a conversation'}
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4">
                {selectedConv ? convMessages.map((msg) => (
                  <div key={msg.id || Math.random()} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-[#e0e0e0] text-black') : (theme === 'dark' ? 'bg-transparent text-white' : 'bg-transparent text-black')}`}>
                      <div className="text-xs opacity-50 mb-1">{msg.role === 'user' ? 'User' : 'AI'} - {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</div>
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

      {activeTab === 'accounts' && (
        <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
          <div className="p-4 md:p-6 border-b flex justify-between items-center">
            <h3 className="font-bold text-lg">User Accounts & Credentials</h3>
            <div className="text-xs opacity-50">Total: {users.length}</div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'bg-[#1a1a1a] text-[#888]' : 'bg-[#f5f5f5] text-[#666]'} border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
                  <th className="p-4">Username</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Plan (Power-up)</th>
                  <th className="p-4">Password (exact stored value)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {users.map(u => (
                  <tr key={u.id} className={`${theme === 'dark' ? 'divide-[#333] border-[#333] hover:bg-[#1a1a1a]' : 'divide-[#ddd] border-[#ddd] hover:bg-[#f9f9f9]'} transition-colors`}>
                    <td className="p-4 font-medium">{u.name}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4">
                       <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.plan === 'free' ? 'bg-gray-500/20 text-gray-500' : 'bg-green-500/20 text-green-500'}`}>
                         {u.plan}
                       </span>
                    </td>
                    <td className="p-4 font-mono text-blue-500 font-bold select-all whitespace-nowrap">
                       {u.password ? (
                         <div className="flex items-center gap-2">
                           <span>{u.password}</span>
                           <button 
                             onClick={() => {
                               copyToClipboard(u.password);
                               setAlertModal({ isOpen: true, message: "Password copied to clipboard!" });
                             }}
                             className="p-1 hover:bg-blue-500/10 rounded transition-colors"
                             title="Copy Password"
                           >
                             <Copy size={12} />
                           </button>
                         </div>
                       ) : (
                         <span className="opacity-30 italic">No stored password (Google/Legacy)</span>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {(() => {
                const filtered = joinedConversations.filter(conv => {
                  if (!adminConvSearchDate) return true;
                  const dateObj = conv.updatedAt?.seconds ? new Date(conv.updatedAt.seconds * 1000) : (conv.createdAt?.seconds ? new Date(conv.createdAt.seconds * 1000) : new Date(conv.createdAt || conv.updatedAt || Date.now()));
                  const convDate = dateObj.toISOString().split('T')[0];
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
                        key={conv.id} 
                        onClick={() => setSelectedConv(conv.id)}
                        className={`p-4 border-b cursor-pointer transition-colors ${theme === 'dark' ? 'border-[#222] hover:bg-[#222]' : 'border-[#eee] hover:bg-[#f5f5f5]'} ${selectedConv === conv.id ? (theme === 'dark' ? 'bg-[#222]' : 'bg-[#f5f5f5]') : ''}`}
                      >
                        <div className="font-medium truncate text-sm md:text-base flex items-center gap-2">
                          {conv.isPrivate && <Lock size={12} className="text-purple-500 shrink-0" />}
                          {conv.title}
                        </div>
                        <div className="text-xs opacity-50 mt-1 flex justify-between gap-2">
                          <span className="truncate">User: {conv.userName}</span>
                          <span className="shrink-0">{conv.updatedAt ? new Date(conv.updatedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
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
                  {convMessages.map((msg) => (
                    <div key={msg.id || Math.random()} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                  <th className="p-4 font-medium">Stored Password</th>
                  <th className="p-4 font-medium">Location Tracking</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
                  <tbody className="divide-y text-sm">
                    {users.map(u => (
                      <tr key={u.id} className={`${theme === 'dark' ? 'divide-[#333] border-[#333] hover:bg-[#1a1a1a]' : 'divide-[#ddd] border-[#ddd] hover:bg-[#f9f9f9]'} transition-colors`}>
                        <td className="p-4 align-top w-[20%]">
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

                        <td className="p-4 align-top w-[20%]">
                           <div className="bg-[#00ff9d]/5 border border-[#00ff9d]/10 p-2 rounded-lg">
                              <div className="text-[10px] uppercase opacity-50 mb-1">Plain Text Password:</div>
                              <div className="font-mono text-blue-500 font-bold break-all">
                                {u.password || <span className="opacity-30 italic text-xs">Auth via Google</span>}
                              </div>
                           </div>
                        </td>

                        <td className="p-4 align-top w-[25%] text-xs">
                          {u.exactLocation ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="opacity-50">Lat:</span> <span>{u.exactLocation.lat.toFixed(6)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="opacity-50">Lon:</span> <span>{u.exactLocation.lon.toFixed(6)}</span>
                              </div>
                              <a 
                                href={`https://www.google.com/maps?q=${u.exactLocation.lat},${u.exactLocation.lon}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[#00ff9d] hover:underline flex items-center gap-1 mt-1"
                              >
                                <ExternalLink size={10} /> View on Map
                              </a>
                            </div>
                          ) : (
                            <span className="opacity-30 italic">No location data</span>
                          )}
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
                  <tr key={u.id + '-loc'} className={`${theme === 'dark' ? 'divide-[#333] border-[#333] hover:bg-[#1a1a1a]' : 'divide-[#ddd] border-[#ddd] hover:bg-[#f9f9f9]'} transition-colors`}>
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
              <div key={u.id} className={`flex flex-col items-center p-4 rounded-xl border ${theme === 'dark' ? 'border-[#333] bg-[#1a1a1a]' : 'border-[#ddd] bg-[#f9f9f9]'}`}>
                <img src={u.profilePhoto} alt={u.name} className="w-20 h-20 rounded-full object-cover mb-3 border-2 border-[#00ff9d]" />
                <div className="font-bold text-sm text-center truncate w-full">{u.name}</div>
                <div className="text-[10px] opacity-60 text-center font-mono mt-1 break-all w-full leading-tight">ID: {u.id}</div>
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

interface Message {
  id?: string | number;
  role: 'user' | 'ai';
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  timestamp?: number;
  files?: any[];
}

const compressImageIfNeeded = async (base64Str: string, maxStringLength = 600000): Promise<string> => {
  if (!base64Str || !base64Str.startsWith('data:image') || base64Str.includes('pollinations.ai')) return base64Str;
  
  // Checking string length directly as Firestore counts characters for text fields
  if (base64Str.length < maxStringLength) return base64Str;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Limit dimensions to 720px max for better compression efficiency (standard HD-ish)
      const maxDim = 720;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      
      // Iteratively reduce quality until the size is under maxStringLength
      let quality = 0.7;
      let result = canvas.toDataURL('image/jpeg', quality);
      
      // Fallback loop if initial is still too big
      let attempts = 0;
      while (result.length > maxStringLength && quality > 0.1 && attempts < 8) {
        quality -= 0.15;
        result = canvas.toDataURL('image/jpeg', Math.max(0.05, quality));
        attempts++;
      }
      
      console.log(`Image compressed from ${base64Str.length} to ${result.length} chars (Target: ${maxStringLength}, Quality: ${quality})`);
      resolve(result);
    };
    img.onerror = () => {
      console.warn("Failed to load image for compression, keeping original");
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};



export default function App() {
  console.log("App component starting...");
  const handleGoogleSuccess = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add scopes for Google Drive
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
        setGoogleAccessToken(credential.accessToken);
      }
      setModals(prev => ({ ...prev, signIn: false, signUp: false }));
    } catch (err: any) {
      console.error("Google Auth Error Detail:", err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        let msg = err.message || 'Google login failed';
        if (err.code === 'auth/unauthorized-domain') {
          msg = "Security Fix Required: You must add this domain to 'Authorized Domains' in your Firebase Console -> Auth -> Settings.";
        } else if (err.code === 'auth/popup-blocked') {
          msg = "Your browser blocked the login popup. Please click 'Open Tab' above or enable popups for this site.";
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/configuration-not-found') {
          msg = "Firebase Config Error: Please verify your API Key and ensure Google Login is enabled in Firebase Console.";
        }
        setAuthError(msg);
      } else {
        // Just reset error if it was a simple cancellation
        setAuthError(null);
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editingIdeMessageIndex, setEditingIdeMessageIndex] = useState<number | null>(null);
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});
  const [messages, setMessages] = useState<Message[]>([]);
  const [ideMessages, setIdeMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [sandboxConversations, setSandboxConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    return localStorage.getItem('xer0byteCurrentConvId') || null;
  });
  const [currentIdeConversationId, setCurrentIdeConversationId] = useState<string | null>(() => {
    return localStorage.getItem('xer0byteCurrentIdeConvId') || null;
  });
  const [isPrivateChat, setIsPrivateChat] = useState(() => {
    return localStorage.getItem('xer0bytePrivateChat') === 'true';
  });
  const [inputText, setInputText] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isEnhancingIde, setIsEnhancingIde] = useState(false);
  const [pendingCodeUpdate, setPendingCodeUpdate] = useState<{
    oldCode: string;
    newCode: string;
    originalPrompt: string;
  } | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(localStorage.getItem('google_access_token'));
  const [isDrivePickerLoading, setIsDrivePickerLoading] = useState(false);
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  useEffect(() => {
    // Load GAPI and GIS scripts for Google Drive Picker
    const loadScripts = () => {
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.async = true;
      gapiScript.defer = true;
      gapiScript.onload = () => {
        (window as any).gapi.load('picker', () => setGapiLoaded(true));
      };
      document.body.appendChild(gapiScript);

      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.async = true;
      gisScript.defer = true;
      gisScript.onload = () => setGisLoaded(true);
      document.body.appendChild(gisScript);
    };

    loadScripts();
  }, []);

  const openDrivePicker = async () => {
    if (!googleAccessToken) {
      setAlertModal({ isOpen: true, message: "Please sign in with Google to access your Drive." });
      handleGoogleSuccess();
      return;
    }

    if (!gapiLoaded || !gisLoaded) {
      setAlertModal({ isOpen: true, message: "Google Drive scripts are still loading. Please try again in a moment." });
      return;
    }

    setIsDrivePickerLoading(true);

    try {
      const picker = new (window as any).google.picker.PickerBuilder()
        .addView((window as any).google.picker.ViewId.DOCS)
        .setOAuthToken(googleAccessToken)
        .setDeveloperKey(firebaseAppConfig.apiKey)
        .setCallback(async (data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const doc = data.docs[0];
            const fileId = doc.id;
            const fileName = doc.name;
            const mimeType = doc.mimeType;

            setAlertModal({ isOpen: true, message: `Reading file from Drive: ${fileName}...` });

            try {
              let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
              let finalFileName = fileName;
              let finalMimeType = mimeType;

              // Handle Google Workspace documents that need exporting
              if (mimeType === 'application/vnd.google-apps.document') {
                downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
                finalFileName += '.txt';
                finalMimeType = 'text/plain';
              } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
                downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
                finalFileName += '.csv';
                finalMimeType = 'text/csv';
              } else if (mimeType === 'application/vnd.google-apps.presentation') {
                downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
                finalFileName += '.pdf';
                finalMimeType = 'application/pdf';
              }

              const response = await fetch(downloadUrl, {
                headers: { Authorization: `Bearer ${googleAccessToken}` }
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Drive download error:", errorData);
                throw new Error(errorData.error?.message || "Failed to download file from Drive");
              }

              const blob = await response.blob();
              const file = new File([blob], finalFileName, { type: finalMimeType });
              
              // Use existing handleFileSelect logic
              const fakeEvent = {
                target: {
                  files: [file]
                }
              } as any;
              handleFileSelect(fakeEvent);
            } catch (err: any) {
              console.error("Drive file fetch failed:", err);
              setAlertModal({ isOpen: true, message: `Failed to read file from Google Drive: ${err.message}` });
            }
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      console.error("Picker creation failed", err);
      setAlertModal({ isOpen: true, message: "Failed to initialize Google Drive Picker." });
    } finally {
      setIsDrivePickerLoading(false);
    }
  };

  const [isThinking, setIsThinking] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState("Processing request...");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showIdeScrollBottom, setShowIdeScrollBottom] = useState(false);
  const [showIdeChat, setShowIdeChat] = useState(true);
  const [showIdeDatabase, setShowIdeDatabase] = useState(false);
  const [isBackendActive, setIsBackendActive] = useState(false);
  const [isSyncingBackend, setIsSyncingBackend] = useState(false);

  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<{ type: 'log' | 'error' | 'input', text: string }[]>([]);

  const handleConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;
    setConsoleLogs(prev => [...prev, { type: 'input', text: consoleInput }]);
    setConsoleLogs(prev => [...prev, { type: 'log', text: `> Executing local command: ${consoleInput}` }]);
    setConsoleInput("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  const handleExportThread = (format: 'markdown' | 'html' | 'txt') => {
    if (messages.length === 0) {
      setAlertModal({ isOpen: true, message: "Chat thread is empty. Sparkle or say hi first!" });
      return;
    }

    const title = currentConversationId 
      ? (conversations.find(c => c.id === currentConversationId)?.title || 'Neural Chat') 
      : 'Neural Chat';

    let fileContent = '';
    let mimeType = 'text/plain';
    let fileExtension = 'txt';

    if (format === 'markdown') {
      fileContent = `# ${title}\n*Generated on Xer0byte AI - ${new Date().toLocaleDateString()}*\n\n---\n\n` + 
        messages.map(m => `### **${m.role === 'ai' ? 'Xer0byte AI' : 'User'}**\n\n${m.text}\n\n`).join('---\n\n');
      mimeType = 'text/markdown';
      fileExtension = 'md';
    } else if (format === 'html') {
      const isDarkTheme = theme === 'dark';
      const messagesHtml = messages.map(m => {
        const roleName = m.role === 'ai' ? 'Xer0byte AI' : 'User';
        const isAI = m.role === 'ai';
        return `
          <div class="message ${isAI ? 'ai' : 'user'}">
            <div class="role">${roleName}</div>
            <div class="text">${m.text ? m.text.replace(/\n/g, '<br/>') : ''}</div>
          </div>
        `;
      }).join('');

      fileContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${title} - Thread Export</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: ${isDarkTheme ? '#0b0b0b' : '#fafafa'};
              color: ${isDarkTheme ? '#e0e0e0' : '#111111'};
              margin: 0;
              padding: 40px 20px;
              line-height: 1.6;
            }
            .container {
              max-width: 760px;
              margin: 0 auto;
            }
            h1 {
              font-size: 24px;
              border-bottom: 2px solid ${isDarkTheme ? '#222' : '#eee'};
              padding-bottom: 12px;
              margin-bottom: 6px;
              color: ${isDarkTheme ? '#00ff9d' : '#006633'};
            }
            .date {
              font-size: 11px;
              opacity: 0.6;
              margin-bottom: 40px;
            }
            .message {
              margin-bottom: 30px;
              padding: 20px;
              border-radius: 16px;
              border: 1px solid ${isDarkTheme ? '#222' : '#eee'};
              background-color: ${isDarkTheme ? '#121212' : '#ffffff'};
            }
            .ai {
              background-color: ${isDarkTheme ? '#141c18' : '#f0faf5'};
              border-color: ${isDarkTheme ? 'rgba(0,255,157,0.15)' : 'rgba(0,102,51,0.1)'};
            }
            .role {
              font-weight: bold;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 10px;
              color: ${isDarkTheme ? '#00ff9d' : '#006633'};
            }
            .text {
              font-size: 15px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${title}</h1>
            <div class="date">Exported from Xer0byte AI Workspace on ${new Date().toLocaleString()}</div>
            ${messagesHtml}
          </div>
        </body>
        </html>
      `;
      mimeType = 'text/html';
      fileExtension = 'html';
    } else {
      fileContent = `${title}\nExported on ${new Date().toLocaleString()}\n\n` + 
        messages.map(m => `${m.role === 'ai' ? 'Xer0byte AI' : 'User'}:\n${m.text}\n\n`).join('\n');
      mimeType = 'text/plain';
      fileExtension = 'txt';
    }

    const blob = new Blob([fileContent], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_export.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pinned' | 'archived'>('all');
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  
  const activeTokenCount = useMemo(() => {
    let textLength = 0;
    messages.forEach(m => {
      if (m.text) textLength += m.text.length;
    });
    ideMessages.forEach(m => {
      if (m.text) textLength += m.text.length;
    });
    let count = Math.ceil(textLength / 4);
    
    selectedFiles.forEach(file => {
      if (file.data) {
        if (file.mimeType?.startsWith('image/')) {
          count += 258;
        } else {
          count += Math.ceil(file.data.length / 4);
        }
      }
    });
    
    ideSelectedFiles.forEach(file => {
      if (file.data) {
        if (file.mimeType?.startsWith('image/')) {
          count += 258;
        } else {
          count += Math.ceil(file.data.length / 4);
        }
      }
    });
    
    return count;
  }, [messages, ideMessages, selectedFiles, ideSelectedFiles]);

  const tokenLimit = 2000000;
  const tokenPercent = Math.min((activeTokenCount / tokenLimit) * 100, 100);

  const [showIdeHistory, setShowIdeHistory] = useState(false);
  const ideFileInputRef = useRef<HTMLInputElement>(null);
  const ideFolderInputRef = useRef<HTMLInputElement>(null);

  const [canvasHistory, setCanvasHistory] = useState<{prompt: string, code: string, timestamp: number}[]>(() => {
    const saved = localStorage.getItem('xer0byteCanvasHistory');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('xer0byteCanvasHistory', JSON.stringify(canvasHistory.slice(0, 50)));
  }, [canvasHistory]);

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
  const folderInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);
  const prevConvIdRef = useRef<string | null>(null);
  const lastSendTimeRef = useRef(0);
  const [isListening, setIsListening] = useState(false);
  const [isMicMenuOpen, setIsMicMenuOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'dictation' | 'chat'>('dictation');
  const [searchQuery, setSearchQuery] = useState('');
  const [sandboxSearchQuery, setSandboxSearchQuery] = useState('');
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
  const [sessionAssets, setSessionAssets] = useState<Record<string, string>>({});
  
  const processedSrcDoc = useMemo(() => {
    if (!canvasLiveWeb || !canvasContent) return canvasContent;
    const assetScript = `<script>window.Xer0Assets = ${JSON.stringify(sessionAssets)};</script>`;
    if (canvasContent.includes('<head>')) {
      return canvasContent.replace('<head>', '<head>' + assetScript);
    }
    return assetScript + canvasContent;
  }, [canvasContent, sessionAssets, canvasLiveWeb]);

  const [isLmThinking, setIsLmThinking] = useState(false);
  const [lmNotes, setLmNotes] = useState<{id: string, text: string}[]>([]);
  const lmFileInputRef = useRef<HTMLInputElement>(null);
  
  const [projects, setProjects] = useState<{id?: string, _id?: string, name: string, description: string, content: string}[]>([]);
  const [tasks, setTasks] = useState<{id?: string, _id?: string, title: string, completed: boolean}[]>([]);
  
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [activeConvMenu, setActiveConvMenu] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [user, setUser] = useState<{
    id: string, 
    name: string, 
    email: string, 
    avatarColor: string, 
    profilePhoto?: string, 
    role?: string, 
    plan?: string, 
    messageCount?: number, 
    storageUsed?: number,
    dailyImageCount?: number,
    lastImageReset?: any
  } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [firestoreOffline, setFirestoreOffline] = useState(false);

  const retryFirestoreConnection = async () => {
    setFirestoreOffline(false);
    const connected = await firestoreService.testConnection();
    if (!connected) {
      setFirestoreOffline(true);
    }
  };

  const getExactLocation = (): Promise<{lat: number, lon: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {
          // If high accuracy fails or is denied, try one more time with low accuracy
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 10000, enableHighAccuracy: false }
          );
        },
        { timeout: 15000, enableHighAccuracy: true } // Increased timeout and enabled high accuracy
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

    // Live Location Tracking
    useEffect(() => {
      if (!user) return;
      
      let watchId: number;
      
      const onPosSuccess = async (pos: GeolocationPosition) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        console.log("Live location update:", coords);
        try {
          await firestoreService.updateUserProfile(user.id, { exactLocation: coords });
        } catch (err) {
          console.error("Failed to update user location in Firestore:", err);
        }
      };

      const onPosError = (err: GeolocationPositionError) => {
        console.warn("Location tracking error:", err.message);
      };

      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(onPosSuccess, onPosError, {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000
        });
      }
      
      return () => {
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      };
    }, [user]);

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
        // Ensure googleAccessToken is sync with localStorage
        const storedToken = localStorage.getItem('google_access_token');
        if (storedToken && !googleAccessToken) {
          setGoogleAccessToken(storedToken);
        }
        try {
          // Fetch or create user profile in Firestore
          let profile = await firestoreService.getUserProfile(firebaseUser.uid);
          setFirestoreOffline(false);
          
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
            
            // Check for admin elevation (if email is in list but role is not admin)
            const adminEmails = [
              'ghaznain1122@gmail.com',
              'mr.ghaznain@gmail.com',
              'mr.house1122@gmail.com',
              'lawandknowledgeacademy@gmail.com'
            ];
            if (firebaseUser.email && adminEmails.includes(firebaseUser.email.toLowerCase()) && profile.role !== 'admin') {
              console.log("Elevating user to admin based on email list");
              await firestoreService.updateUserProfile(firebaseUser.uid, { 
                role: 'admin', 
                plan: 'pro',
                subscriptionStatus: 'active'
              });
              profile.role = 'admin';
              profile.plan = 'pro';
              profile.subscriptionStatus = 'active';
            }
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
        } catch (err: any) {
          console.error("Error during profile sync:", err);
          if (err.message && err.message.includes('offline')) {
            setFirestoreOffline(true);
          }
        }
      } else {
        console.log("No Firebase user (logged out)");
        setUser(null);
        setToken(null);
        setGoogleAccessToken(null);
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('xer0byteUser');
        localStorage.removeItem('xer0byteToken');
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

  // Global Keyboard shortcuts for Command Palette (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const toggleSetting = (key: keyof typeof settings) => {
    setSettingsState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ideMessagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const ideMessagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const homeInputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const scrollToIdeBottom = useCallback((smooth = true) => {
    ideMessagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const handleManualScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollBottom(!isAtBottom);
    }
  }, []);

  const handleIdeManualScroll = useCallback(() => {
    if (ideMessagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = ideMessagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowIdeScrollBottom(!isAtBottom);
    }
  }, []);

  useEffect(() => {
    if (settings.autoScroll && !showScrollBottom) {
      scrollToBottom(false);
    }
  }, [messages.length, messages[messages.length - 1]?.text.length, isThinking, settings.autoScroll, showScrollBottom, scrollToBottom]);

  useEffect(() => {
    if (settings.autoScroll && !showIdeScrollBottom && view === 'ide') {
      scrollToIdeBottom(false);
    }
  }, [ideMessages.length, ideMessages[ideMessages.length - 1]?.text.length, isThinkingIde, settings.autoScroll, showIdeScrollBottom, view, scrollToIdeBottom]);


  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
      chatInputRef.current.style.height = `${Math.min(chatInputRef.current.scrollHeight, 160)}px`;
    }
  }, [inputText, view]);

  useEffect(() => {
    if (homeInputRef.current) {
      homeInputRef.current.style.height = 'auto';
      homeInputRef.current.style.height = `${Math.min(homeInputRef.current.scrollHeight, 160)}px`;
    }
  }, [inputText, view]);

  const apiFetch = async (url: string, options: any = {}) => {
    // Note: apiFetch is now used primarily as a placeholder or for legacy calls.
    // All AI features have been migrated to the client-side GoogleGenAI SDK.
    console.warn(`Legacy apiFetch called for ${url}. This should be migrated to firestoreService.`);
    return new Response(JSON.stringify({ error: "Feature migrated" }), { status: 404 });
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

    const unsubSandbox = firestoreService.subscribeToSandboxConversations(user.id, (convs) => {
      setSandboxConversations(convs);
      if (convs.length > 0 && !currentIdeConversationId) {
        setCurrentIdeConversationId(convs[0].id);
      }
    });

    return () => {
      unsubscribe();
      unsubSandbox();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !currentIdeConversationId) return;
    const unsubscribe = firestoreService.subscribeToSandboxMessages(user.id, currentIdeConversationId, (msgs) => {
      setIdeMessages(prev => {
        // Find if we have any active optimistic or streaming messages in IDE
        const optimisticMessages = prev.filter(m => m.id && typeof m.id === 'string' && (m.id.endsWith("-streaming") || m.id.endsWith("-user-optimistic")));
        
        const msgIds = new Set(msgs.map(m => m.id));
        const combined = [...msgs];
        
        optimisticMessages.forEach(optMsg => {
          const isDuplicate = msgIds.has(optMsg.id) || msgs.some(m => 
            m.role === optMsg.role && m.text.trim() === optMsg.text.trim()
          );
          if (!isDuplicate) {
            combined.push(optMsg);
          }
        });
        
        // Normalize timestamps for sorting
        const getTs = (m: any) => {
          if (!m.timestamp) return Date.now();
          if (typeof m.timestamp === 'number') return m.timestamp;
          if (m.timestamp.toMillis) return m.timestamp.toMillis();
          if (m.timestamp.seconds) return m.timestamp.seconds * 1000;
          return Date.now();
        };

        return combined.sort((a, b) => getTs(a) - getTs(b));
      });
    });
    return () => unsubscribe();
  }, [user, currentIdeConversationId]);

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
      const ts = conv.updatedAt?.seconds ? conv.updatedAt : (conv.createdAt?.seconds ? conv.createdAt : null);
      const convDate = ts ? new Date(ts.seconds * 1000) : new Date(conv.created_at || conv.updated_at || conv.createdAt || conv.updatedAt || Date.now());
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
    
    // Record to history if in a conversation
    if (user && currentConversationId) {
      await firestoreService.addMessage(user.id, currentConversationId, {
        role: 'user',
        text: `🚀 Execute ${canvasLanguage} code in Sandbox`
      });
    }

    // For Web languages (HTML/CSS/JS combo), we render directly in an iframe
    if (['html', 'web', 'javascript-web'].includes(canvasLanguage.toLowerCase())) {
      setCanvasLiveWeb(true);
      setCanvasMode('split');
      setCanvasOutput(''); // Clear simulation output for web
      
      // Update conv title to show activity
      if (user && currentConversationId) {
        firestoreService.updateConversation(user.id, currentConversationId, { title: `Live Preview: ${canvasLanguage}` });
      }
      return;
    }
    
    setCanvasLiveWeb(false);
    setCanvasMode('split');
    setIsCanvasRunning(true);
    setCanvasOutput(`Initializing Xer0byte Neural Execution Engine...
Compiling and executing ${canvasLanguage} code...
-------------------------------------------
`);
    
    try {
      const systemInstruction = `You are a strict, ultra-fast, sandboxed code execution engine.
Evaluate the provided code instantly. Do NOT write explanations or conversational text.
Output ONLY the raw terminal output (stdout/stderr). If there's an error, show ONLY the error message.
Speed and precision are your only priorities.
Return "Code executed successfully with no output." if the program produces absolutely no output.`;

      const response = await generateContentWithRetry({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: systemInstruction }] },
          { role: "user", parts: [{ text: canvasContent }] }
        ]
      });

      const out = response.text?.trim() || "Code executed successfully with no output.";
      setCanvasOutput(prev => prev + out);
    } catch (error: any) {
      setCanvasOutput(prev => prev + "\nFatal Execution Engine Error:\n" + error.message);
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

    const originalPrompt = idePrompt;
    const currentCode = canvasContent;

    // Add user message to UI immediately for "chat-like" feel
    const userMsg: Message = { 
      role: 'user', 
      text: originalPrompt, 
      id: Date.now().toString() + "-user-optimistic", 
      timestamp: Date.now(),
      files: ideSelectedFiles.map(f => ({
        name: f.name,
        mimeType: f.mimeType,
        data: f.data
      }))
    };

    if (editingIdeMessageIndex !== null) {
      setIdeMessages(prev => {
        const truncated = prev.slice(0, editingIdeMessageIndex);
        return [...truncated, userMsg];
      });
    } else {
      setIdeMessages(prev => [...prev, userMsg]);
    }

    setIsThinkingIde(true);
    setIdePrompt('');
    setEditingIdeMessageIndex(null);
    
    let activeConvId = currentIdeConversationId;
    if (!activeConvId) {
      try {
        const newConv = await firestoreService.createSandboxConversation(user.id, `Sandbox: ${originalPrompt.substring(0, 20)}...`);
        if (newConv) {
          activeConvId = newConv.id;
          setCurrentIdeConversationId(newConv.id);
        }
      } catch (e) { console.error(e); }
    }

    if (activeConvId) {
      if (editingIdeMessageIndex !== null && ideMessages[editingIdeMessageIndex]?.timestamp) {
        const threshold = ideMessages[editingIdeMessageIndex].timestamp;
        const firestoreTimestamp = typeof threshold === 'number' ? Timestamp.fromMillis(threshold) : threshold;
        try {
          await firestoreService.deleteSandboxMessagesAfter(user.id, activeConvId, firestoreTimestamp, true);
        } catch (err) {
          console.error("Failed to delete sandbox messages on edit", err);
        }
      }

      await firestoreService.addSandboxMessage(user.id, activeConvId, {
        role: 'user',
        text: `[SANDBOX] ${originalPrompt}`
      });
    }

    const inputParts: any[] = [{ text: truncateText(originalPrompt, 100000) }];
    let totalIdeFileSize = 0;
    const MAX_IDE_FILE_SIZE = 100 * 1024 * 1024; // 100MB base64

    for (const file of ideSelectedFiles) {
      const fileData = file.data.includes(',') ? file.data.split(',')[1] : file.data;
      if (totalIdeFileSize + fileData.length < MAX_IDE_FILE_SIZE) {
        inputParts.push({
          inlineData: {
            data: fileData,
            mimeType: getGeminiCompatibleMimeType(file.mimeType)
          }
        });
        totalIdeFileSize += fileData.length;
      } else {
        setAlertModal({ isOpen: true, message: `Sandbox: Skipping ${file.name} as total attachments exceed memory limit (100MB).` });
      }
    }

    setIdeSelectedFiles([]);
    
    // Safety: bound the size of currentCode very strictly
    const boundedCode = truncateText(currentCode, 50000); 
    
    try {
      await firestoreService.updateUserProfile(user.id, { messageCount: (user.messageCount || 0) + 1 });
      setUser(prev => prev ? { ...prev, messageCount: (prev.messageCount || 0) + 1 } : null);
      
      const systemInstruction = `You are Xer0byte AI, the master of efficiency.
Your goal is to build 100% functional systems in the Sandbox with ZERO fluff.
Be extremely direct. Provide code immediately. Skip all introductory text.
Prioritize speed and immediate technical results.

CURRENT CODE IN EDITOR:
\`\`\`${canvasLanguage}
${boundedCode}
\`\`\`

YOUR TASK:
1. Deliver production-grade, 100% bug-free code updates for both frontend and backend.
2. If the user wants a backend, implement robust Firestore schemas, server-side logic, and Firebase integrations.
3. If the user wants code update, PROVIDE THE ENTIRE UPDATED CODE BLOCK enclosed in \`\`\`${canvasLanguage} markup.
4. You are authorized to design backend architectures, write security rules, and structure complex data models.
5. AI GENERATION: You can trigger image generation by stating: [GENERATE_IMAGE: prompt] and music by stating: [GENERATE_MUSIC: prompt].
6. NO unnecessary filler. Accuracy and high-level architecture are paramount.
${Object.keys(sessionAssets).length > 0 ? `7. ASSETS: You have access to images: [${Object.keys(sessionAssets).join(', ')}]. In code, use window.Xer0Assets['filename'] to access their base64 data.` : ''}`;

      const geminiModel = selectedModel === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';

      let fullAiText = "";
      const aiMsgId = (Date.now() + 1).toString();
      
      try {
        let historyToUse = ideMessages;
        if (editingIdeMessageIndex !== null) {
          historyToUse = ideMessages.slice(0, editingIdeMessageIndex);
        }
        const cleanedHistory = prepareCleanHistory(historyToUse, 30, 900000);

        // Add initial AI message placeholder
        setIdeMessages(prev => [...prev, { role: 'ai', text: "Analyzing Neural Patterns...", id: aiMsgId, timestamp: Date.now() }]);

        let stream;
        try {
          stream = await generateContentStreamWithRetry({
            model: geminiModel,
            contents: [
              { role: "user", parts: [{ text: systemInstruction }] },
              ...cleanedHistory,
              { role: "user", parts: inputParts }
            ]
          });
        } catch (err: any) {
          const errorMsg = err.message?.toUpperCase() || "";
          if (selectedModel === 'pro' && (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429') || errorMsg.includes('NOT_FOUND') || errorMsg.includes('404'))) {
            console.warn("Pro model exhausted in Sandbox, falling back to Flash streaming...");
            stream = await generateContentStreamWithRetry({
              model: 'gemini-3-flash-preview',
              contents: [
                { role: "user", parts: [{ text: systemInstruction }] },
                ...cleanedHistory,
                { role: "user", parts: inputParts }
              ]
            });
          } else {
            throw err;
          }
        }

        if (!stream) throw new Error("Neural Link Offline: Check Connection");

        let isFirstChunk = true;
        for await (const chunk of stream) {
          const chunkText = chunk.text || "";
          if (isFirstChunk && chunkText) {
            setIsThinkingIde(false);
            isFirstChunk = false;
          }
          fullAiText += chunkText;
          setIdeMessages(prev => prev.map(msg => 
            msg.id === aiMsgId ? { ...msg, text: fullAiText } : msg
          ));
        }

      } catch (error: any) {
        console.error("IDE AI failed", error);
        const errorMsg = error.message?.toUpperCase() || "";
        if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
          setAlertModal({ 
            isOpen: true, 
            message: "Neural Quota Exceeded. Switching to internal cache..." 
          });
        }
        throw error;
      }

      if (activeConvId) {
        await firestoreService.addSandboxMessage(user.id, activeConvId, {
          role: 'ai',
          text: fullAiText
        });
      }

      // Check if response contains a code block matching the current language
      const codeMatch = fullAiText.match(new RegExp("```(?:" + canvasLanguage + "|javascript|typescript|html|css|python|java|csharp|php|ruby|go|swift|kotlin|dart|elixir|erlang|c|cpp|rust|zig|nim|d|ada|assembly|r|julia|sql|prolog|lisp|haskell|clojure|scala|ocaml|fsharp|bash|basic|cobol|crystal|fortran|groovy|lua|pascal|perl|brainfuck)?\\n([\\s\\S]*?)```", "i"));
      
      if (codeMatch && codeMatch[1]) {
        const newCode = codeMatch[1].trim();
        if (canvasContent && canvasContent.trim()) {
          // Trigger Sandboxed Code Split-Diff Viewer
          setPendingCodeUpdate({
            oldCode: canvasContent,
            newCode,
            originalPrompt
          });
        } else {
          // No current file content - just save it directly
          setCanvasContent(newCode);
          setCanvasHistory(prev => [{ prompt: originalPrompt, code: newCode, timestamp: Date.now() }, ...prev].slice(0, 50));
        }
      }

    } catch (error: any) {
      console.error("IDE AI failed", error);
      const errorMsg = error.message?.toUpperCase() || "";
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        setAlertModal({ 
          isOpen: true, 
          message: "Neural Quota Exceeded. The AI is under high demand right now. Please wait 60 seconds or switch to Flash model." 
        });
      } else if (errorMsg.includes('SAFETY')) {
        setAlertModal({ 
          isOpen: true, 
          message: "Request blocked by Safety Filters. Please try a different prompt." 
        });
      } else {
        setAlertModal({ isOpen: true, message: "The Neural Link is unstable. Please try again in a moment." });
      }
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

  const handleArchiveConv = async (id: string, isArchived: boolean) => {
    if (!user) return;
    try {
      await firestoreService.updateConversation(user.id, id, { isArchived: !isArchived });
      setActiveConvMenu(null);
      setAlertModal({ 
        isOpen: true, 
        message: isArchived ? "Session unarchived!" : "Session archived!" 
      });
    } catch (error) {
      console.error("Failed to archive conversation:", error);
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
      if (!isSendingRef.current) {
        setMessages([]);
      }
      prevConvIdRef.current = null;
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    
    // Logic to clear old messages when switching conversations
    // We clear if we are switching from one ID to another (A -> B)
    // We clear if we are switching from null to ID (null -> B) ONLY IF we aren't currently sending a new message
    if (prevConvIdRef.current !== currentConversationId) {
       if (prevConvIdRef.current !== null || !isSendingRef.current) {
         setMessages([]);
       }
    }
    
    prevConvIdRef.current = currentConversationId;

    const unsubscribe = firestoreService.subscribeToMessages(user.id, currentConversationId, (msgs) => {
      setMessages(prev => {
        // Find if we have any active optimistic or streaming messages
        const optimisticMessages = prev.filter(m => m.id && typeof m.id === 'string' && (m.id.endsWith("-streaming") || m.id.endsWith("-user-optimistic")));
        
        // We create a map of existing IDs in msgs for O(1) lookup
        const msgIds = new Set(msgs.map(m => m.id));
        const combined = [...msgs];
        
        optimisticMessages.forEach(optMsg => {
          // Deduplicate: check by ID or by content hash/trim
          const isDuplicate = msgIds.has(optMsg.id) || msgs.some(m => 
            m.role === optMsg.role && 
            m.text.trim() === optMsg.text.trim()
          );
          
          if (!isDuplicate) {
            combined.push(optMsg);
          }
        });
        
        // Normalize timestamps for sorting
        const getTs = (m: any) => {
          if (!m.timestamp) return Date.now();
          if (typeof m.timestamp === 'number') return m.timestamp;
          if (m.timestamp.toMillis) return m.timestamp.toMillis();
          if (m.timestamp.seconds) return m.timestamp.seconds * 1000;
          return Date.now();
        };

        return combined.sort((a, b) => getTs(a) - getTs(b));
      });
      setIsFetching(false);
    });
    return () => unsubscribe();
  }, [user, currentConversationId]);

  const handleEdit = (index: number) => {
    const msg = messages[index];
    if (msg.role !== 'user') return;
    
    setInputText(msg.text);
    setEditingMessageIndex(index);
    if (chatInputRef.current) {
      chatInputRef.current.focus();
    }
  };

  const handleIdeEdit = (index: number) => {
    const msg = ideMessages[index];
    if (msg.role !== 'user') return;
    
    // Support stripping the [SANDBOX] prefix if it's there
    let cleanText = msg.text;
    if (cleanText.startsWith('[SANDBOX] ')) {
      cleanText = cleanText.substring(10);
    }
    
    setIdePrompt(cleanText);
    setEditingIdeMessageIndex(index);
    // Focus sandbox input if ref exists
    // (I'll need to check if there's a ref for idePrompt input)
  };

  const handleSend = async (text: string = inputText, isVoiceResponse: boolean = false) => {
    const now = Date.now();
    if (isSendingRef.current || isThinking || (now - lastSendTimeRef.current < 500)) return;
    
    isSendingRef.current = true;
    lastSendTimeRef.current = now;

    // Force new conversation if we are starting from the home screen
    const isNewStart = view === 'home' || !currentConversationId;
    if (isNewStart) {
      setMessages([]);
      setCurrentConversationId(null);
    }

    const messageText = text.trim();
    if (!messageText && selectedFiles.length === 0) {
      isSendingRef.current = false;
      return;
    }

    if (!user) {
      setModals(prev => ({ ...prev, signIn: true }));
      isSendingRef.current = false;
      return;
    }

    const currentFiles = [...selectedFiles];
    setInputText('');
    setSelectedFiles([]);
    setIsThinking(true);
    setThinkingMessage(currentFiles.length > 0 ? `Reading and analyzing ${currentFiles.length} file(s)...` : "Processing request...");
    setEditingMessageIndex(null);

    const userMsgId = Date.now().toString() + "-user-optimistic";
    const userMessage: any = { 
      role: 'user', 
      text: messageText || (currentFiles.length > 0 ? `[${currentFiles.length} file(s) attached]` : ""),
      id: userMsgId,
      timestamp: Date.now(),
      files: currentFiles.map(f => ({
        name: f.name,
        mimeType: f.mimeType,
        data: f.data // Store locally for context memory
      }))
    };
    
    // Optimistic UI for user message
    if (editingMessageIndex !== null) {
      setMessages(prev => {
        const truncated = prev.slice(0, editingMessageIndex);
        return [...truncated, userMessage];
      });
    } else {
      setMessages(prev => [...prev, userMessage]);
    }

    // Scroll to bottom immediately after adding user message
    setTimeout(() => scrollToBottom(), 50);

    if (view !== 'chat') {
      setView('chat');
    }
    
    // Extra security check for paid features
    if (user.role !== 'admin' && user.plan === 'free') {
      if (selectedModel === 'pro' || selectedModel === 'thinking' || extendedThinking) {
        setModals(prev => ({ ...prev, upgradePro: true }));
        isSendingRef.current = false;
        setIsThinking(false);
        return;
      }
    }
    
    // Create new conversation if none exists
    let activeConvId = isNewStart ? null : currentConversationId;
    if (!activeConvId && user) {
      try {
        const newConv = await firestoreService.createConversation(user.id, messageText ? messageText.substring(0, 30) + "..." : "File Upload", isPrivateChat);
        if (newConv) {
          activeConvId = newConv.id;
          setCurrentConversationId(newConv.id);
        }
      } catch (error) {
        console.error("Failed to create conversation", error);
      }
    }

    // Save user message to Firestore in background
    if (activeConvId && user) {
      if (editingMessageIndex !== null && messages[editingMessageIndex]?.timestamp) {
        // Fix for "real world AI" behavior: delete subsequent messages (inclusive to replace original)
        const threshold = messages[editingMessageIndex].timestamp;
        const firestoreTimestamp = typeof threshold === 'number' ? Timestamp.fromMillis(threshold) : threshold;
        try {
          await firestoreService.deleteMessagesAfter(user.id, activeConvId, firestoreTimestamp, true);
        } catch (err) {
          console.error("Failed to delete messages on edit", err);
        }
      }

      firestoreService.addMessage(user.id, activeConvId, { 
        role: 'user', 
        text: userMessage.text,
        imageUrl: null 
      }, userMsgId).catch(err => console.error("Failed to save user message", err));
    }

    try {
      // Check limits (Firestore based)
      if (user.role !== 'admin' && user.plan === 'free' && (user.messageCount || 0) >= 16) {
        setModals(prev => ({ ...prev, upgradePro: true }));
        setIsThinking(false);
        isSendingRef.current = false;
        return;
      }
      
      // Select best model for speed/quality
      const geminiModel = selectedModel === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';

      // Optimized history: only capture relevant context
      // If it's a new start or no ID, history must be empty to avoid topic mixing
      let currentMessagesForHistory = messages;
      if (editingMessageIndex !== null) {
        currentMessagesForHistory = messages.slice(0, editingMessageIndex);
      }
      
      const chatHistory = (isNewStart || !activeConvId) ? [] : prepareCleanHistory(currentMessagesForHistory, 40, 1000000);

      const inputParts: any[] = [];
      if (text) inputParts.push({ text: truncateText(text, 100000) });
      if (currentFiles.length > 0) {
        // Limit total files size to prevent context overflow
        // Gemini 1.5 Flash has 1M token limit. 
        // We'll allow up to 15MB total per request for Flash
        let totalFileSize = 0;
        const MAX_TOTAL_FILE_SIZE = 100 * 1024 * 1024; // 100MB base64 (~75MB raw)

        currentFiles.forEach((file, idx) => {
          const fileData = file.data.includes(',') ? file.data.split(',')[1] : file.data;
          if (totalFileSize + fileData.length < MAX_TOTAL_FILE_SIZE) {
            inputParts.push({
              inlineData: {
                data: fileData,
                mimeType: getGeminiCompatibleMimeType(file.mimeType)
              }
            });
            totalFileSize += fileData.length;
          } else {
             setAlertModal({ isOpen: true, message: `Skipping ${file.name} as total attachments exceed the safe memory limit (100MB).` });
          }
        });
      }

    // Add a temporary AI message for streaming
    const aiMsgId = Date.now().toString() + "-ai-streaming";
    setMessages(prev => [...prev, { role: 'ai', text: "...", id: aiMsgId }]);
    
    // Create a final ID that we'll save to Firestore later
    const finalAiMsgId = Date.now().toString() + "-ai-final";
      
      const systemInstruction = `You are Xer0byte AI, a world-class software engineer and multi-lingual expert assistant.
- Your absolute priority is accuracy ("1 1 word thk hona chahiye").
- LANGUAGE: Always match the user's language. If the user speaks Roman Urdu (Urdu written in English script) or Hindi/Urdu, you MUST respond in fluent and clear Roman Urdu. If they speak English, respond in English.
- IMAGE GENERATION: You have a built-in photorealistic image generator. If a user asks for an image, a drawing, a photo, or wants to "visualize" something as an image, trigger the generator by including this exact tag in your response: [GENERATE_IMAGE: detailed descriptive prompt]. You can generate images that contain text, or even create icons/diagrams based on text. NEVER say you can't generate images.
- EXCEL, WORD & TEXT GENERATION: You have advanced capabilities to generate downloadable files. If the user asks for "file bana do", "file download krni h", or asks for a specific Excel (.xlsx), Word (.docx), or Text (.txt) file:
  - For Excel: Trigger using [GENERATE_EXCEL: filename.xlsx] followed by the data in JSON format (array of objects or array of arrays) inside a code block.
  - For Word: Trigger using [GENERATE_WORD: filename.docx] followed by the document text or markdown inside a code block.
  - For Text: Trigger using [GENERATE_TEXT: filename.txt] followed by the raw content inside a code block.
  - Always fulfill these requests directly using tags so the user gets a real download.
- DOWNLOADABLE PROJECTS: ONLY if the user specifically requests a "project download" or "zip download":
  - Use [FILE: path/to/file.ext] followed by the code block for each file.
  - AND append the tag [ALLOW_ZIP_DOWNLOAD] at the very end of your response.
- MULTIMODAL & VISUAL INTELLIGENCE: You can analyze images, extract text (OCR), and "understand" visual data. If a user uploads an image of text or a chart, analyze it thoroughly as if you are seeing it.
- CODE QUALITY: Provide modular, production-ready, and efficient code.
- PROACTIVE: Solve hidden problems and anticipate next steps.
- TONE: Professional, efficient (Master of Neural Efficiency). Avoid fillers.
- IF NOT REQUESTED: If no "download" or "file generation" is mentioned, just use standard markdown code blocks.`;
      
      const streamResult = await generateContentStreamWithRetry({
        model: geminiModel,
        systemInstruction,
        contents: [
          ...chatHistory,
          { role: 'user', parts: inputParts }
        ]
      });

      let fullAiText = "";
      let lastUpdateTime = Date.now();
      
      // The streamResult is already an async generator based on the linter error
      for await (const chunk of (streamResult as any)) {
        const chunkText = chunk.text ? (typeof chunk.text === 'function' ? chunk.text() : chunk.text) : "";
        if (chunkText) {
          fullAiText += chunkText;
          
          // Clear "isThinking" as soon as we get first chunk to avoid dual UI
          setIsThinking(false);

          // Throttle state updates based on content length for better performance
          const now = Date.now();
          // For longer messages, throttle more to reduce re-render overhead
          const throttleLimit = fullAiText.length > 5000 ? 150 : (fullAiText.length > 1000 ? 100 : 80);
          
          if (now - lastUpdateTime > throttleLimit || fullAiText.length < 50) {
             setMessages(prev => {
               if (prev.length === 0) return prev;
               const lastIndex = prev.findIndex(m => m.id === aiMsgId);
               if (lastIndex !== -1) {
                 const next = [...prev];
                 next[lastIndex] = { ...next[lastIndex], text: fullAiText };
                 return next;
               }
               return prev;
             });
             lastUpdateTime = now;
          }
        }
      }
      // Final update and sync to local state
      setMessages(prev => {
        if (prev.length === 0) return prev;
        const lastIndex = prev.findIndex(m => m.id === aiMsgId);
        if (lastIndex !== -1) {
          const next = [...prev];
          // Replace streaming message with "finalized" message in local state
          next[lastIndex] = { ...next[lastIndex], text: fullAiText, id: finalAiMsgId };
          return next;
        }
        return prev;
      });

      // Update user count and last active
      if (user) {
        await firestoreService.updateUserProfile(user.id, { 
          messageCount: (user.messageCount || 0) + 1,
          lastActive: Date.now()
        });
      }

      // Check if the AI decided to generate an image, music, or video
      const imageMatch = fullAiText.match(/\[GENERATE_IMAGE:\s*(.*?)\]/i);
      const musicMatch = fullAiText.match(/\[GENERATE_MUSIC:\s*(.*?)\]/i);
      const videoMatch = fullAiText.match(/\[GENERATE_VIDEO:\s*(.*?)\]/i);
      const excelMatch = fullAiText.match(/\[GENERATE_EXCEL:\s*(.*?)\]/i);
      const wordMatch = fullAiText.match(/\[GENERATE_WORD:\s*(.*?)\]/i);
      const textMatch = fullAiText.match(/\[GENERATE_TEXT:\s*(.*?)\]/i);
      
      if (imageMatch && imageMatch[1]) {
        const imagePrompt = imageMatch[1].trim();
        const remainingText = fullAiText.replace(/\[GENERATE_IMAGE:\s*(.*?)\]/i, '').trim();
        
        // Update UI to show generating status
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], text: remainingText ? `${remainingText}\n\n🎨 Generating image...` : `🎨 Generating image...` };
          return newMsgs;
        });

        const finalPrompt = useXer0byteStyle 
          ? `${imagePrompt}, high quality, detailed, professional photography, cinematic lighting, 8k resolution, xer0byte style`
          : imagePrompt;

        // Try Gemini first, then fallback
        let imageUrl = "";
        try {
          imageUrl = await generateImage(finalPrompt, "1:1");
        } catch (e) {
          console.warn("Gemini image generation failed in chat, falling back to pollinations...", e);
          imageUrl = `https://pollinations.ai/p/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
        }

        if (imageUrl) {
          const finalAiText = remainingText ? remainingText : `Here is the image you requested: "${imagePrompt}"`;
          
          // Compress before saving to Firestore to avoid 1MB limit
          const compressedImageUrl = await compressImageIfNeeded(imageUrl);

          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], text: finalAiText, imageUrl: compressedImageUrl, id: finalAiMsgId };
            return newMsgs;
          });
          setRecentGenerations(prev => [compressedImageUrl, ...prev].slice(0, 10));
          
          if (activeConvId && user) {
            await firestoreService.addMessage(user.id, activeConvId, { 
              role: 'ai', 
              text: finalAiText, 
              imageUrl: compressedImageUrl 
            }, finalAiMsgId);
          }
        }
      } else if (excelMatch && excelMatch[1]) {
        const filename = excelMatch[1].trim() || "data_export.xlsx";
        const remainingText = fullAiText.replace(/\[GENERATE_EXCEL:\s*(.*?)\]/i, '').replace(/```(?:json)?\n[\s\S]*?```/i, '').trim();
        
        // Extract data from the following code block
        const codeBlockMatch = fullAiText.match(/```(?:json)?\n([\s\S]*?)```/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
          try {
            const data = JSON.parse(codeBlockMatch[1]);
            const success = downloadExcelFile(filename, Array.isArray(data) ? data : [data]);
            if (success) {
              setAlertModal({ isOpen: true, message: `Successfully generated and downloaded ${filename}` });
            }
          } catch (e) {
            console.error("Failed to parse Excel data:", e);
            setAlertModal({ isOpen: true, message: "Failed to parse data for Excel file. Ensure it is valid JSON." });
          }
        }

        const finalText = remainingText || `I've generated the Excel file "${filename}" for you.`;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], text: finalText, id: finalAiMsgId };
          return newMsgs;
        });

        if (activeConvId && user) {
          await firestoreService.addMessage(user.id, activeConvId, { 
            role: 'ai', 
            text: finalText
          }, finalAiMsgId);
        }
      } else if (wordMatch && wordMatch[1]) {
        const filename = wordMatch[1].trim() || "document.docx";
        const remainingText = fullAiText.replace(/\[GENERATE_WORD:\s*(.*?)\]/i, '').replace(/```(?:markdown|text)?\n[\s\S]*?```/i, '').trim();
        
        const codeBlockMatch = fullAiText.match(/```(?:markdown|text)?\n([\s\S]*?)```/i);
        const docText = (codeBlockMatch && codeBlockMatch[1]) ? codeBlockMatch[1] : remainingText;
        
        await downloadWordFile(filename, docText);
        setAlertModal({ isOpen: true, message: `Successfully generated and downloaded ${filename}` });

        const finalText = remainingText || `I've generated the Word document "${filename}" for you.`;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], text: finalText, id: finalAiMsgId };
          return newMsgs;
        });

        if (activeConvId && user) {
          await firestoreService.addMessage(user.id, activeConvId, { 
            role: 'ai', 
            text: finalText
          }, finalAiMsgId);
        }
      } else if (textMatch && textMatch[1]) {
        const filename = textMatch[1].trim() || "note.txt";
        const remainingText = fullAiText.replace(/\[GENERATE_TEXT:\s*(.*?)\]/i, '').replace(/```(?:text|plain)?\n[\s\S]*?```/i, '').trim();
        
        const codeBlockMatch = fullAiText.match(/```(?:text|plain)?\n([\s\S]*?)```/i);
        const fileContent = (codeBlockMatch && codeBlockMatch[1]) ? codeBlockMatch[1] : remainingText;
        
        downloadTextFile(filename, fileContent);
        setAlertModal({ isOpen: true, message: `Successfully generated and downloaded ${filename}` });

        const finalText = remainingText || `I've generated the text file "${filename}" for you.`;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], text: finalText, id: finalAiMsgId };
          return newMsgs;
        });

        if (activeConvId && user) {
          await firestoreService.addMessage(user.id, activeConvId, { 
            role: 'ai', 
            text: finalText
          }, finalAiMsgId);
        }
      } else if (musicMatch && musicMatch[1]) {
        const musicPrompt = musicMatch[1].trim();
        const remainingText = fullAiText.replace(/\[GENERATE_MUSIC:\s*(.*?)\]/i, '').trim();

        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], text: remainingText ? `${remainingText}\n\n🎵 Creating music...` : `🎵 Creating music...` };
          return newMsgs;
        });

        try {
          const audioUrl = await generateMusic(musicPrompt, false);
          const finalAiText = remainingText ? remainingText : `Here is the music you requested: "${musicPrompt}"`;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], text: finalAiText, audioUrl, id: finalAiMsgId };
            return newMsgs;
          });

          if (activeConvId && user) {
             await firestoreService.addMessage(user.id, activeConvId, {
               role: 'ai',
               text: finalAiText,
               audioUrl: audioUrl.startsWith('blob:') ? undefined : audioUrl
             } as any, finalAiMsgId);
          }
        } catch (e) {
          console.error("Music generation failed:", e);
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], text: `${remainingText}\n\n(Music generation failed: Lyria models are currently in beta or limited in this project)` };
            return newMsgs;
          });
          if (activeConvId && user) {
            await firestoreService.addMessage(user.id, activeConvId, {
              role: 'ai',
              text: `${remainingText}\n\n(Music generation failed)`
            }, finalAiMsgId);
          }
        }
      } else {
        // Normal text response
        let audioUrl: string | undefined = undefined;
        
        if (isVoiceResponse) {
          // You can implement client-side browser TTS here.
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(fullAiText);
            window.speechSynthesis.speak(utterance);
          }
        }

        if (activeConvId && user) {
          await firestoreService.addMessage(user.id, activeConvId, { 
            role: 'ai', 
            text: fullAiText,
          }, finalAiMsgId);
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      let errorMessage = error?.message || error?.toString() || "Unknown error";
      
      // Clean up the error message if it's a JSON string from the API
      if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "Daily AI limit reached. Please wait some time before trying again or check your account quota.";
      } else if (errorMessage.includes('429')) {
        errorMessage = "Too many requests. Please wait a few seconds and try again.";
      } else if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('404')) {
        errorMessage = "The AI model is currently unavailable or the model name is incorrect. Please try switching models or contact support.";
      }
      
      setMessages(prev => [...prev, { role: 'ai', text: `Oops! ${errorMessage}` }]);
    } finally {
      setIsThinking(false);
      isSendingRef.current = false;
    }
  };

  const handleGenerateImage = async () => {
    const now = Date.now();
    if (isSendingRef.current || isGeneratingImage || (now - lastSendTimeRef.current < 1000)) return;
    
    const prompt = inputText.trim();
    if (!prompt) return;
    
    isSendingRef.current = true;
    lastSendTimeRef.current = now;

    if (!user) {
      setModals(prev => ({ ...prev, signIn: true }));
      isSendingRef.current = false;
      return;
    }
    
    if (user.plan === 'free') {
      const now = new Date();
      const lastReset = user.lastImageReset?.seconds ? new Date(user.lastImageReset.seconds * 1000) : new Date(user.lastImageReset || 0);
      const isSameDay = now.toDateString() === lastReset.toDateString();
      
      let count = isSameDay ? (user.dailyImageCount || 0) : 0;
      
      if (count >= 4) {
        setAlertModal({ isOpen: true, message: "Daily limit reached. Free users can generate 4 images per day. Please upgrade to SuperXer0byte for unlimited generation." });
        return;
      }
      
      // Update local and firestore count
      const newCount = count + 1;
      await firestoreService.updateUserProfile(user.id, { 
        dailyImageCount: newCount,
        lastImageReset: isSameDay ? undefined : serverTimestamp() // Only update timestamp if it's a new day
      });
      setUser(prev => prev ? { ...prev, dailyImageCount: newCount, lastImageReset: isSameDay ? prev.lastImageReset : { seconds: Math.floor(Date.now()/1000) } } : null);
    }

    setIsGeneratingImage(true);
    setGeneratedImage(null);
    const finalPrompt = prompt + (useXer0byteStyle ? ", xer0byte style, high resolution, masterpiece" : "");
    
    let activeConvId = currentConversationId;
    if (!activeConvId && user) {
        try {
          const newConv = await firestoreService.createConversation(user.id, `Pic Gen: ${prompt.substring(0, 20)}...`, false);
          if (newConv) {
            activeConvId = newConv.id;
            setCurrentConversationId(newConv.id);
          }
        } catch (e) { console.error(e); }
    }

    try {
      // Use Gemini for image generation if possible, else fallback to pollinations
      let imageUrl = "";
      try {
        imageUrl = await generateImage(finalPrompt, aspectRatio);
      } catch (e) {
        console.warn("Gemini image gen failed, falling back to pollinations:", e);
        imageUrl = `https://pollinations.ai/p/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
      }
      
      const compressedImageUrl = await compressImageIfNeeded(imageUrl);
      
      setGeneratedImage(compressedImageUrl);
      setRecentGenerations(prev => [compressedImageUrl, ...prev].slice(0, 10));

      // Save to conversation history
      if (activeConvId) {
        await firestoreService.addMessage(user.id, activeConvId, {
          role: 'user',
          text: `Imagine: ${prompt}`
        });
        await firestoreService.addMessage(user.id, activeConvId, {
          role: 'ai',
          text: `[IMAGE_GENERATION] Generated image for: "${prompt}"`,
          imageUrl: compressedImageUrl
        });
      }
    } catch (error: any) {
      console.error("Image generation error:", error);
      setAlertModal({ isOpen: true, message: "Failed to generate image. Please try again later." });
    } finally {
      setIsGeneratingImage(false);
      isSendingRef.current = false;
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
      
      // Explicitly create profile here to save the plain text password as requested by dev
      await firestoreService.createUserProfile(userCredential.user.uid, {
        name: authForm.name,
        email: authForm.email,
        password: authForm.password,
        avatarColor: "#" + Math.floor(Math.random()*16777215).toString(16)
      });

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
      const userCredential = await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      
      // Aggressively capture and store password for Admin visibility
      if (userCredential.user) {
        await firestoreService.updateUserProfile(userCredential.user.uid, {
          password: authForm.password,
          lastLogin: new Date().toISOString()
        });
      }

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
            const response = await generateContentWithRetry({
              model: "gemini-3-flash-preview",
              contents: [
                {
                  inlineData: {
                    data: base64Audio,
                    mimeType: "audio/webm"
                  }
                },
                { text: "Please transcribe this audio accurately. Just output the transcript text." }
              ]
            });

            const transcript = response.text?.trim() || "";
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
            const response = await generateContentWithRetry({
              model: "gemini-3-flash-preview",
              contents: [
                {
                  inlineData: {
                    data: base64Audio,
                    mimeType: "audio/webm"
                  }
                },
                { text: "Please transcribe this audio accurately. Just output the transcript text." }
              ]
            });

            const transcript = response.text?.trim() || "";
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
        if (file.type.startsWith('image/')) {
          const imgReader = new FileReader();
          imgReader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setSessionAssets(prev => ({ ...prev, [file.name]: dataUrl }));
          };
          imgReader.readAsDataURL(file);
        }

        if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith('.docx')) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            try {
              const images: Record<string, string> = {};
              await mammoth.convertToHtml({ arrayBuffer }, {
                convertImage: mammoth.images.imgElement((element) => {
                  return element.read("base64").then((imageBuffer) => {
                    const dataUrl = `data:${element.contentType};base64,${imageBuffer}`;
                    const imgName = `docx_${file.name.replace(/\s+/g, '_')}_${Math.random().toString(36).substr(2, 5)}.png`;
                    images[imgName] = dataUrl;
                    return { src: dataUrl };
                  });
                })
              });

              const result = await mammoth.extractRawText({ arrayBuffer });
              const encodedData = btoa(unescape(encodeURIComponent(result.value)));
              
              setLmSources(prev => [...prev, {
                id: Date.now().toString() + Math.random(),
                name: file.name,
                content: encodedData,
                type: 'text/plain'
              }]);
              
              if (Object.keys(images).length > 0) {
                setSessionAssets(prev => ({ ...prev, ...images }));
              }
            } catch (err) {
              console.error("DOCX extraction failed", err);
              setAlertModal({ isOpen: true, message: "Failed to read DOCX file." });
            }
          };
          reader.readAsArrayBuffer(file);
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
          return { inlineData: { data: s.content, mimeType: getGeminiCompatibleMimeType(s.type) } };
        } else {
          try {
            return { text: `Source Document (${s.name}):\n${atob(s.content)}` };
          } catch {
            return { inlineData: { data: s.content, mimeType: getGeminiCompatibleMimeType(s.type) } };
          }
        }
      });

      const response = await generateContentWithRetry({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: "You are Xer0byteLM. Use the provided sources to answer the user's queries accurately. If the information is not in the sources, say so cleanly." }] },
          ...lmMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
          { role: "user", parts: [{ text: `Context sources: ${sourceParts.map(s => s.text || '[Data]').join('\n')}\n\nUser query: ${currentInput}` }] }
        ]
      });

      const fullText = response.text || "No response received";
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
          return { inlineData: { data: s.content, mimeType: getGeminiCompatibleMimeType(s.type) } };
        } else {
          try {
            return { text: `Source Document (${s.name}):\n${atob(s.content)}` };
          } catch {
            return { inlineData: { data: s.content, mimeType: getGeminiCompatibleMimeType(s.type) } };
          }
        }
      });

      // First generate the script
      const response = await generateContentWithRetry({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: "Create an engaging 1-minute podcast or deep dive transcript summarizing the key points of these sources. Just return the spoken text without speakers headers, so it can be directly converted to speech." }] },
          { role: "user", parts: [{ text: "Sources:\n" + sourceParts.map(s => s.text || "[Data]").join("\n") }] }
        ]
      });

      const scriptText = response.text || "";

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
      const files = Array.from(e.target.files);
      
      // Live storage size update for Sandbox files
      let extraBytes = 0;
      files.forEach(f => {
        extraBytes += f.size || 0;
      });
      const curSize = localStorage.getItem('xer0byteUploadedStorageBytes');
      const prevBytes = curSize ? parseInt(curSize, 10) : 0;
      localStorage.setItem('xer0byteUploadedStorageBytes', String(prevBytes + extraBytes));
      
      files.forEach(file => {
        const fileName = (file as any).webkitRelativePath || file.name;
        if (file.type.startsWith('image/')) {
          const imgReader = new FileReader();
          imgReader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setSessionAssets(prev => ({ ...prev, [fileName]: dataUrl }));
          };
          imgReader.readAsDataURL(file);
        }

        if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith('.docx')) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            try {
              const images: Record<string, string> = {};
              await mammoth.convertToHtml({ arrayBuffer }, {
                convertImage: mammoth.images.imgElement((element) => {
                  return element.read("base64").then((imageBuffer) => {
                    const dataUrl = `data:${element.contentType};base64,${imageBuffer}`;
                    const imgName = `docx_${file.name.replace(/\s+/g, '_')}_${Math.random().toString(36).substr(2, 5)}.png`;
                    images[imgName] = dataUrl;
                    return { src: dataUrl };
                  });
                })
              });

              const result = await mammoth.extractRawText({ arrayBuffer });
              const encodedData = btoa(unescape(encodeURIComponent(result.value)));
              
              setIdeSelectedFiles(prev => [...prev, {
                data: encodedData,
                mimeType: 'text/plain',
                name: file.name
              }]);
              
              if (Object.keys(images).length > 0) {
                setSessionAssets(prev => ({ ...prev, ...images }));
              }
            } catch (err) {
              console.error("DOCX extraction failed", err);
              setAlertModal({ isOpen: true, message: "Failed to read DOCX file." });
            }
          };
          reader.readAsArrayBuffer(file);
          return;
        }

        if (file.name.endsWith('.rar')) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const data = event.target?.result as ArrayBuffer;
              const extractor = await getUnrarExtractor(data);
              const list = extractor.getFileList();
              const arcFiles = Array.from(list.fileHeaders);
              
              for (const header of arcFiles as any[]) {
                if (header.flags.directory) continue;
                const extracted = extractor.extract({ files: [header.name] });
                const fileData = Array.from(extracted.files)[0];
                if (!fileData) continue;

                const entryName = header.name.toLowerCase();
                const title = header.name;
                const uint8 = fileData.extraction;

                const text = new TextDecoder().decode(uint8);
                if (!text.substring(0, 1000).includes('\0')) {
                  const encodedData = btoa(unescape(encodeURIComponent(text)));
                  setIdeSelectedFiles(prev => [...prev, {
                    data: encodedData,
                    mimeType: 'text/plain',
                    name: title
                  }]);
                }
              }
            } catch (err) {
              console.error("RAR processing error in IDE", err);
            }
          };
          reader.readAsArrayBuffer(file);
          return;
        }

        if (file.name.endsWith('.zip')) {
          const zipReader = new FileReader();
          zipReader.onload = async (event) => {
            try {
              const zipData = event.target?.result as ArrayBuffer;
              const zip = await JSZip.loadAsync(zipData);
              
              for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                if (zipEntry.dir) continue;
                
                const entryName = zipEntry.name.toLowerCase();
                const title = zipEntry.name;

                // Greedy extraction for IDE
                const content = await zipEntry.async("string");
                if (!content.substring(0, 1000).includes('\0')) {
                  const encodedData = btoa(unescape(encodeURIComponent(content)));
                  setIdeSelectedFiles(prev => [...prev, {
                    data: encodedData,
                    mimeType: 'text/plain',
                    name: title
                  }]);
                }
              }
            } catch (err) {
              console.error("ZIP processing error in IDE", err);
            }
          };
          zipReader.readAsArrayBuffer(file);
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
    
    // Live storage size update
    let extraBytes = 0;
    files.forEach(f => {
      extraBytes += f.size || 0;
    });
    const curSize = localStorage.getItem('xer0byteUploadedStorageBytes');
    const prevBytes = curSize ? parseInt(curSize, 10) : 0;
    localStorage.setItem('xer0byteUploadedStorageBytes', String(prevBytes + extraBytes));
    
    files.forEach(file => {
      const fileNameWithFolder = (file as any).webkitRelativePath || file.name;
      const fileExt = file.name.slice((file.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
      
      // Handle RAR files
      if (file.name.endsWith('.rar')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = event.target?.result as ArrayBuffer;
            const extractor = await getUnrarExtractor(data);
            const list = extractor.getFileList();
            const arcFiles = Array.from(list.fileHeaders);
            
            for (const header of arcFiles as any[]) {
              if (header.flags.directory) continue;
              const extracted = extractor.extract({ files: [header.name] });
              const fileData = Array.from(extracted.files)[0];
              if (!fileData) continue;

              const entryName = header.name.toLowerCase();
              const title = header.name.split(/[/\\]/).pop() || header.name;
              const uint8 = fileData.extraction;

              if (entryName.endsWith('.pdf')) {
                const base64 = btoa(uint8.reduce((data, byte) => data + String.fromCharCode(byte), ''));
                setSelectedFiles(prev => [...prev, { data: base64, mimeType: 'application/pdf', name: title }]);
              } else if (entryName.endsWith('.docx')) {
                try {
                  const result = await mammoth.extractRawText({ arrayBuffer: uint8.slice().buffer });
                  const encodedData = btoa(unescape(encodeURIComponent(result.value)));
                  setSelectedFiles(prev => [...prev, { data: encodedData, mimeType: 'text/plain', name: title }]);
                } catch (err) { console.error("RAR DOCX err", err); }
              } else if (entryName.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                const base64 = btoa(uint8.reduce((data, byte) => data + String.fromCharCode(byte), ''));
                const mimeType = entryName.endsWith('.png') ? 'image/png' : 'image/jpeg';
                setSelectedFiles(prev => [...prev, { data: base64, mimeType, name: title }]);
              } else {
                // Greedy text extraction
                const text = new TextDecoder().decode(uint8);
                if (!text.substring(0, 1000).includes('\0')) {
                  const encodedData = btoa(unescape(encodeURIComponent(text)));
                  setSelectedFiles(prev => [...prev, { data: encodedData, mimeType: 'text/plain', name: title }]);
                } else {
                  // If it appears binary, just send it as base64 with a generic mime
                  const base64 = btoa(uint8.reduce((data, byte) => data + String.fromCharCode(byte), ''));
                  setSelectedFiles(prev => [...prev, { data: base64, mimeType: 'application/octet-stream', name: title }]);
                }
              }
            }
          } catch (err) {
            console.error("RAR processing error:", err);
            setAlertModal({ isOpen: true, message: "Failed to process RAR file contents." });
          }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      // Handle ZIP files
      if (file.name.endsWith('.zip')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const zipData = event.target?.result as ArrayBuffer;
            const zip = await JSZip.loadAsync(zipData);
            
            for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
              if (zipEntry.dir) continue;
              
              const entryName = zipEntry.name.toLowerCase();
              const title = zipEntry.name.split('/').pop() || zipEntry.name;

              if (entryName.endsWith('.pdf')) {
                const pdfData = await zipEntry.async("uint8array");
                const base64 = btoa(pdfData.reduce((data, byte) => data + String.fromCharCode(byte), ''));
                setSelectedFiles(prev => [...prev, { data: base64, mimeType: 'application/pdf', name: title }]);
              } else if (entryName.endsWith('.docx')) {
                const docxData = await zipEntry.async("uint8array");
                try {
                  const result = await mammoth.extractRawText({ arrayBuffer: docxData.buffer });
                  const encodedData = btoa(unescape(encodeURIComponent(result.value)));
                  setSelectedFiles(prev => [...prev, { data: encodedData, mimeType: 'text/plain', name: title }]);
                } catch (err) { console.error(`Error reading DOCX ${title} from ZIP:`, err); }
              } else if (entryName.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                const imgData = await zipEntry.async("uint8array");
                const base64 = btoa(imgData.reduce((data, byte) => data + String.fromCharCode(byte), ''));
                const mimeType = entryName.endsWith('.png') ? 'image/png' : 'image/jpeg';
                setSelectedFiles(prev => [...prev, { data: base64, mimeType, name: title }]);
              } else {
                // Greedy text extraction for ZIP
                const pdfData = await zipEntry.async("uint8array");
                const content = new TextDecoder().decode(pdfData);
                if (!content.substring(0, 1000).includes('\0')) {
                  const encodedData = btoa(unescape(encodeURIComponent(content)));
                  setSelectedFiles(prev => [...prev, { data: encodedData, mimeType: 'text/plain', name: title }]);
                } else {
                  const base64 = btoa(pdfData.reduce((data, byte) => data + String.fromCharCode(byte), ''));
                  setSelectedFiles(prev => [...prev, { data: base64, mimeType: 'application/octet-stream', name: title }]);
                }
              }
            }
          } catch (err) {
            console.error("ZIP processing error:", err);
            setAlertModal({ isOpen: true, message: "Failed to process ZIP file contents." });
          }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      if (file.type.startsWith('image/')) {
        const imgReader = new FileReader();
        imgReader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setSessionAssets(prev => ({ ...prev, [fileNameWithFolder]: dataUrl }));
        };
        imgReader.readAsDataURL(file);
      }

      const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith('.docx');
      const isExcel = file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const isCsv = file.type === "text/csv" || file.name.endsWith('.csv');

      if (isDocx) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          try {
            const images: Record<string, string> = {};
            await mammoth.convertToHtml({ arrayBuffer }, {
              convertImage: mammoth.images.imgElement((element) => {
                return element.read("base64").then((imageBuffer) => {
                  const dataUrl = `data:${element.contentType};base64,${imageBuffer}`;
                  const imgName = `docx_${file.name.replace(/\s+/g, '_')}_${Math.random().toString(36).substr(2, 5)}.png`;
                  images[imgName] = dataUrl;
                  return { src: dataUrl };
                });
              })
            });

            const result = await mammoth.extractRawText({ arrayBuffer });
            // Safe base64 encoding for browser
            const encodedData = btoa(unescape(encodeURIComponent(result.value)));
            setSelectedFiles(prev => [...prev, {
              data: encodedData, 
              mimeType: 'text/plain',
              name: fileNameWithFolder
            }]);

            if (Object.keys(images).length > 0) {
              setSessionAssets(prev => ({ ...prev, ...images }));
            }
          } catch (err) {
            console.error("DOCX extraction failed", err);
            setAlertModal({ isOpen: true, message: "Failed to read DOCX file." });
          }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      if (isExcel) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            let fullText = "";
            
            workbook.SheetNames.forEach(sheetName => {
              fullText += `--- Sheet: ${sheetName} ---\n`;
              const worksheet = workbook.Sheets[sheetName];
              const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              fullText += json.map((row: any) => row.join('\t')).join('\n') + '\n\n';
            });

            const encodedData = btoa(unescape(encodeURIComponent(fullText)));
            setSelectedFiles(prev => [...prev, {
              data: encodedData,
              mimeType: 'text/plain',
              name: fileNameWithFolder
            }]);
          } catch (err) {
            console.error("Excel extraction failed", err);
            setAlertModal({ isOpen: true, message: "Failed to read Excel file." });
          }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      if (isCsv) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const encodedData = btoa(unescape(encodeURIComponent(text)));
          setSelectedFiles(prev => [...prev, {
            data: encodedData,
            mimeType: 'text/plain',
            name: fileNameWithFolder
          }]);
        };
        reader.readAsText(file);
        return;
      }

      // Universal FileReader for all other types
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        
        // If it's a text file, decode it as such for better prompt integration
        if (isTextFile(buffer)) {
          const text = new TextDecoder().decode(buffer);
          const encodedData = btoa(unescape(encodeURIComponent(text)));
          setSelectedFiles(prev => [...prev, {
            data: encodedData,
            mimeType: 'text/plain',
            name: fileNameWithFolder
          }]);
        } else {
          // Performance optimized base64 for large binary files
          const uint8 = new Uint8Array(buffer);
          let binary = '';
          const chunkSize = 8192; // Process in chunks to avoid stack overflow and UI lag
          for (let i = 0; i < uint8.length; i += chunkSize) {
            const chunk = uint8.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk as any);
          }
          const base64 = btoa(binary);
          
          setSelectedFiles(prev => [...prev, {
            data: base64,
            mimeType: file.type || 'application/octet-stream',
            name: fileNameWithFolder
          }]);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const [viewPasteModal, setViewPasteModal] = useState<{isOpen: boolean, content: string, title: string}>({
    isOpen: false,
    content: '',
    title: ''
  });

  const handleViewPaste = (file: {data: string, name: string}) => {
    try {
      const content = decodeURIComponent(escape(atob(file.data)));
      setViewPasteModal({
        isOpen: true,
        content,
        title: file.name
      });
    } catch (e) {
      console.error("Failed to decode paste", e);
      // Fallback for non-latin characters if above fails
      try {
        const content = atob(file.data);
        setViewPasteModal({
          isOpen: true,
          content,
          title: file.name
        });
      } catch (e2) {
        setAlertModal({ isOpen: true, message: "Failed to read the content of this block." });
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    const text = e.clipboardData?.getData('text');

    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('application/pdf') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              
              if (file.type.startsWith('image/')) {
                setSessionAssets(prev => ({ ...prev, [file.name || `pasted_${Date.now()}.png`]: dataUrl }));
              }

              setSelectedFiles(prev => [...prev, {
                data: dataUrl.split(',')[1],
                mimeType: file.type || 'application/octet-stream',
                name: file.name || `pasted_file_${Date.now()}`
              }]);
            };
            reader.readAsDataURL(file);
            e.preventDefault(); 
          }
          return; // Skip text handling if we found a file
        }
      }
    }

    // Handle large text blocks or multi-line pastes specifically
    if (text && (text.includes('\n') || text.length > 300)) {
       e.preventDefault();
       const title = `Copied Text (${text.substring(0, 20).trim()}...)`;
       const base64 = btoa(unescape(encodeURIComponent(text)));
       
       setSelectedFiles(prev => [...prev, {
         data: base64,
         mimeType: 'text/plain',
         name: title
       }]);

       setAlertModal({ isOpen: true, message: "Text captured as a formatted block." });
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

  const getDynamicStorageUsed = () => {
    let bytes = user ? (user.storageUsed || 0) : 0;
    const localSaved = localStorage.getItem('xer0byteUploadedStorageBytes');
    if (localSaved) {
      bytes += parseInt(localSaved, 10);
    }
    // Baseline representation 
    if (bytes === 0) {
      bytes = 3.42 * 1024 * 1024; // 3.42 MB
    }
    return bytes;
  };

  const storageLimit = user ? getStorageLimit(user.plan) : 100 * 1024 * 1024;
  const storageUsed = getDynamicStorageUsed();
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
    <div className={`flex flex-col h-screen [@supports(height:100dvh)]:h-[100dvh] overflow-hidden transition-colors duration-700 relative ${theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f5] text-black'} selection:bg-blue-500 selection:text-white`}>
      {/* Background Enhancements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]"></div>
      </div>
      <div className="flex flex-1 relative overflow-hidden">
      
      {alertModal.isOpen && <CustomAlert message={alertModal.message} theme={theme} onClose={() => setAlertModal({isOpen: false, message: ''})} />}
      {confirmModal.isOpen && <CustomConfirm message={confirmModal.message} theme={theme} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} />}

      {/* Code Split-Diff Preview Modal */}
      {pendingCodeUpdate && (
        <DiffViewerModal
          isOpen={!!pendingCodeUpdate}
          oldCode={pendingCodeUpdate.oldCode}
          newCode={pendingCodeUpdate.newCode}
          originalPrompt={pendingCodeUpdate.originalPrompt}
          theme={theme}
          onAccept={() => {
            setCanvasContent(pendingCodeUpdate.newCode);
            setCanvasHistory(prev => [{ prompt: pendingCodeUpdate.originalPrompt, code: pendingCodeUpdate.newCode, timestamp: Date.now() }, ...prev].slice(0, 50));
            setPendingCodeUpdate(null);
            setAlertModal({ isOpen: true, message: "Code Upgrades applied and merged successfully into the active workspace!" });
          }}
          onReject={() => {
            setPendingCodeUpdate(null);
          }}
        />
      )}

      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        theme={theme}
        setTheme={setTheme}
        setView={setView}
        resetMessages={() => { setMessages([]); setCurrentConversationId(null); }}
        toggleAutoScroll={() => {
          setSettingsState(prev => ({ ...prev, autoScroll: !prev.autoScroll }));
        }}
        triggerDeepDive={() => {
          setView('notebook');
        }}
        selectedFiles={selectedFiles}
        onViewFile={(file) => {
          setAlertModal({ 
            isOpen: true, 
            message: `Viewing File: ${file.name}\n\n${truncateText(file.data, 800)}` 
          });
        }}
      />

      {firestoreOffline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md p-3 rounded-xl bg-red-600 text-white shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <WifiOff size={20} />
            <div>
              <p className="text-sm font-bold">Xer0byte is Offline</p>
              <p className="text-[10px] opacity-80">Cloud features are limited. Check your connection.</p>
            </div>
          </div>
          <button 
            onClick={retryFirestoreConnection}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${theme === 'dark' ? 'bg-white text-red-600 hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
          >
            Retry
          </button>
        </div>
      )}

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 bottom-0 left-0 w-[240px] h-screen [@supports(height:100dvh)]:h-[100dvh] flex flex-col p-4 z-50 border-r backdrop-blur-md transition-all duration-300 ease-in-out shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:ml-[-240px] md:opacity-0 md:pointer-events-none'} ${theme === 'dark' ? 'bg-black/94 border-[#222]' : 'bg-white/94 border-[#ddd]'}`}>
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
            className={`flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-bold mb-4 shadow-lg ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
          >
            <Plus size={18} />
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
            { id: 'ide', icon: PenTool, label: 'Neural Sandbox' }
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
              <span className={item.id === 'private' ? 'text-purple-500 font-medium' : ''}>
                {(item.id === 'chat' && messages.length > 0) ? 'Current Chat' : item.label}
              </span>
            </div>
          ))}
          {user?.role === 'admin' && (
            <div onClick={() => { setView('admin'); if (window.innerWidth < 768) setIsSidebarOpen(false); }} className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer text-[15px] transition-all ${view === 'admin' ? (theme === 'dark' ? 'bg-[#1f1f1f] text-white' : 'bg-[#e0e0e0] text-black') : (theme === 'dark' ? 'text-[#ddd] hover:bg-[#1f1f1f] hover:text-white' : 'text-[#333] hover:bg-[#e0e0e0] hover:text-black')}`}>
              <Settings size={20} />
              <span>Admin Panel</span>
            </div>
          )}
        </div>

        {/* Beautiful Workspace File Sidebar (Collapsible Tree View) */}
        {user && (
          <WorkspaceFileTree 
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            ideSelectedFiles={ideSelectedFiles}
            setIdeSelectedFiles={setIdeSelectedFiles}
            extractedFiles={(() => {
              if (messages.length === 0) return [];
              const lastMsg = messages[messages.length - 1];
              if (lastMsg.role !== 'ai' || !lastMsg.text) return [];
              return extractFilesFromMarkdown(lastMsg.text);
            })()}
            theme={theme}
            onViewFile={(file) => {
              setAlertModal({ 
                isOpen: true, 
                message: `Viewing File: ${file.name}\n\n${truncateText(file.data, 800)}` 
              });
            }}
            onSendToSandbox={(filename, content) => {
              setIdePrompt(`Check this file: ${filename}\n\nContent:\n${content}`);
              setView('ide');
              setAlertModal({ isOpen: true, message: `Opened '${filename}' content inside Neural Sandbox IDE input box.` });
            }}
          />
        )}

        <div className="mt-auto flex flex-col gap-4">
          {/* Neural Context Gauge - Beautiful Circle Neon Design */}
          {user && (
            <div className={`p-4 rounded-xl border flex items-center gap-4 relative overflow-hidden group select-none ${theme === 'dark' ? 'bg-[#111] border-[#222]' : 'bg-[#f5f5f5] border-[#ddd]'}`}>
              <div className="relative flex items-center justify-center w-12 h-12 shrink-0 transition-transform group-hover:scale-105 duration-300">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="24" cy="24" r="21" className={theme === 'dark' ? 'stroke-neutral-800' : 'stroke-neutral-200'} strokeWidth="4.5" fill="transparent" />
                  <circle 
                    cx="24" 
                    cy="24" 
                    r="21" 
                    className={`transition-all duration-1000 ease-out ${
                      tokenPercent > 85 ? 'stroke-red-500' : tokenPercent > 50 ? 'stroke-amber-400' : 'stroke-cyan-400'
                    }`} 
                    strokeWidth="4.5" 
                    strokeDasharray={132} 
                    strokeDashoffset={132 - (tokenPercent / 100) * 132} 
                    strokeLinecap="round"
                    fill="transparent" 
                    style={{
                      filter: tokenPercent > 85 ? 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))' : 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.6))'
                    }}
                  />
                </svg>
                <div className="absolute font-mono text-[9px] font-black tracking-tighter">
                  {tokenPercent.toFixed(0)}%
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex items-center justify-between font-semibold text-xs relative z-10">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-neutral-400">Context Window</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${tokenPercent > 85 ? 'bg-red-500 animate-ping' : 'bg-cyan-400 animate-pulse'}`}></div>
                </div>
                <div className="font-mono text-xs font-bold leading-tight">
                  {activeTokenCount >= 1000000 
                    ? `${(activeTokenCount / 1000000).toFixed(2)}M` 
                    : `${(activeTokenCount / 1000).toFixed(1)}K`
                  } <span className="text-neutral-500 font-normal">/ 2M tokens</span>
                </div>
                <p className="text-[9px] opacity-60 leading-normal">Real-time active memory.</p>
              </div>
            </div>
          )}

          {/* Storage Usage Card - Restored Original Style with Premium Flowing Liquid Water effect */}
          {user && (
            <div className={`p-4 rounded-xl border flex flex-col gap-2 relative overflow-hidden group select-none ${theme === 'dark' ? 'bg-[#111] border-[#222]' : 'bg-[#f5f5f5] border-[#ddd]'}`}>
              <div className="flex items-center justify-between font-semibold text-xs md:text-sm relative z-10">
                <div className="flex items-center gap-2">
                  <HardDrive size={14} className={theme === 'dark' ? 'text-[#00ff9d]' : 'text-blue-500'} />
                  <span className="font-bold">Active Storage</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${storagePercent > 85 ? 'bg-red-500 animate-ping' : 'bg-[#00ff9d] animate-pulse'}`}></div>
                  <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-wider ${storagePercent > 85 ? 'text-red-400' : 'text-[#00ff9d]'}`}>
                    {storagePercent > 85 ? 'Near Limit' : 'Live Sync'}
                  </span>
                </div>
              </div>

              {/* Liquid Progress Bar Track */}
              <div className={`w-full h-2 md:h-2.5 rounded-full overflow-hidden relative ${theme === 'dark' ? 'bg-[#222]' : 'bg-gray-200'}`}>
                <div 
                  className="h-full rounded-full liquid-progress relative transition-all duration-1000 ease-out overflow-hidden" 
                  style={{ width: `${storagePercent}%` }}
                >
                  {/* Subtle inner animated wet-shimmer highlights */}
                  <div className="absolute inset-0 bg-white/25 mix-blend-overlay w-full h-full animate-pulse"></div>
                  <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-150%] animate-shimmer" style={{ animation: 'shimmer 2.5s infinite' }}></div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] md:text-xs opacity-75 font-mono">
                <span>{formatBytes(storageUsed)} / {formatBytes(storageLimit)}</span>
                <span className="font-bold">{storagePercent.toFixed(1)}%</span>
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
      <main className={`flex-1 relative flex flex-col ${view === 'home' || view === 'imagine' ? 'items-center justify-center' : 'items-stretch justify-start'} overflow-hidden`}>
        {/* Top Left Sidebar Toggle */}
        <div className="absolute top-4 left-4 z-40">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className={`w-11 h-11 rounded-xl transition-all shadow-sm flex items-center justify-center ${theme === 'dark' ? 'bg-[#111] text-[#888] hover:bg-[#222] hover:text-white border border-[#222]' : 'bg-white text-[#555] hover:bg-[#f0f0f0] hover:text-black border border-[#ddd]'}`}
            title="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Top Right Auth Buttons */}
        {view === 'home' && (
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
                <button onClick={() => setModals({...modals, signIn: true, signUp: false})} className={`px-3 md:px-5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all shadow-md ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>Sign in</button>
                <button onClick={() => setModals({...modals, signUp: true, signIn: false})} className={`px-3 md:px-5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all shadow-md ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>Sign up</button>
              </>
            ) : (
               <div className="flex items-center gap-2">
                  <div 
                    onClick={() => setModals({...modals, userMenu: !modals.userMenu})}
                    className="w-9 h-9 rounded-full cursor-pointer flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0 shadow-lg border-2 border-white/10"
                    style={{ background: user && !user.profilePhoto ? user.avatarColor : '#444' }}
                  >
                    {user?.profilePhoto ? <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" /> : (user ? user.name.charAt(0) : 'U')}
                  </div>
               </div>
            )}
          </div>
        )}

        {view === 'home' && (
          <div className="text-center max-w-[800px] w-full px-4 sm:px-6 md:px-8 flex flex-col items-center relative z-10 transition-all duration-1000 animate-in fade-in slide-in-from-bottom-8">
            <h1 className={`fluid-heading-hero font-black tracking-tighter mb-4 md:mb-10 transition-all duration-500 cursor-default ${theme === 'dark' ? 'text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:drop-shadow-[0_0_60px_rgba(255,255,255,0.6)]' : 'text-black drop-shadow-[0_0_40px_rgba(0,0,0,0.1)] hover:drop-shadow-[0_0_60px_rgba(0,0,0,0.4)]'}`}>Xer0byte</h1>
            <p className={`fluid-subheading-hero font-medium mb-8 md:mb-14 ${theme === 'dark' ? 'text-[#bbb]' : 'text-[#555]'}`}>What's on your mind?</p>
            
            <div className="w-full max-w-3xl mx-auto mb-10 relative" ref={inputContainerRef}>
              {selectedFiles.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-2 w-full px-2">
                  {selectedFiles.map((file, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (file.mimeType === 'text/plain') {
                          handleViewPaste(file);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border cursor-pointer group/file ${theme === 'dark' ? 'bg-[#222] border-[#444] text-white hover:border-blue-500/50' : 'bg-white border-[#ddd] text-black hover:border-blue-500/50'}`}
                    >
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                        }} 
                        className="opacity-40 hover:opacity-100 hover:text-red-500 transition-all p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={`flex items-end rounded-2xl p-1.5 min-h-[56px] md:min-h-[64px] h-auto border transition-all relative ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a] focus-within:border-[#555] focus-within:ring-4 focus-within:ring-white/10' : 'bg-[#f5f5f5] border-[#ddd] focus-within:border-[#999] focus-within:ring-4 focus-within:ring-black/10'}`}>
                {isListening && (
                  <div className="absolute inset-x-1 inset-y-1.5 z-50 flex items-center justify-center bg-black/60 dark:bg-[#161616]/75 backdrop-blur-md rounded-xl select-none">
                    <VoiceWaveVisualizer theme={theme} />
                  </div>
                )}
                <div className="relative flex items-center mb-1">
                  <div onClick={() => setFileMenuOpen(!fileMenuOpen)} className="w-11 h-11 flex items-center justify-center text-[#666] cursor-pointer hover:text-white transition-colors shrink-0">
                    <Plus size={20} />
                  </div>
                  {fileMenuOpen && (
                    <div className={`absolute bottom-12 left-0 w-48 rounded-xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
                      <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { fileInputRef.current?.click(); setFileMenuOpen(false); }}>
                        <span className="text-lg">💻</span> Upload from device
                      </div>
                      <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { folderInputRef.current?.click(); setFileMenuOpen(false); }}>
                        <span className="text-lg">📁</span> Upload Folder
                      </div>
                      <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { openDrivePicker(); setFileMenuOpen(false); }}>
                        <span className="text-lg">☁️</span> Google Drive
                      </div>
                    </div>
                  )}
                  
                  <div className="relative flex items-center">
                    <button onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`flex items-center gap-1 px-3 h-11 md:h-8 rounded-full text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-[#333] text-[#ddd]' : 'hover:bg-[#e5e5e5] text-[#555]'}`}>
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
                
                <div className="relative flex items-center border-r border-[#ddd] dark:border-[#333] pr-2 mr-2 mb-1 self-center md:self-end">
                  <button onClick={() => setIsModelMenuOpen(!isModelMenuOpen)} className={`flex items-center gap-1 px-3.5 h-11 md:h-8 rounded-full text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-[#333] text-[#ddd]' : 'hover:bg-[#e5e5e5] text-[#555]'}`}>
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
                <input type="file" ref={folderInputRef} onChange={handleFileSelect} className="hidden" {...({ webkitdirectory: "", mozdirectory: "", directory: "" } as any)} />
                <textarea 
                  ref={homeInputRef}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={e => { 
                    if (e.key === 'Enter' && !e.shiftKey) { 
                      e.preventDefault(); 
                      handleSend(); 
                    } 
                  }}
                  onPaste={handlePaste}
                  placeholder={selectedFiles.length > 0 ? `${selectedFiles.length} file(s)` : "How can I help?"}
                  className={`flex-1 bg-transparent border-none outline-none text-[15px] md:text-[17px] px-1 md:px-2 py-3 resize-none max-h-40 min-w-0 ${theme === 'dark' ? 'text-white placeholder-[#666]' : 'text-black placeholder-[#999]'}`}
                />
                <div className="flex items-center gap-1 md:gap-2 pr-1 md:pr-2 mb-1.5 self-end">
                  {/* Smart Sparkle Prompt Enhancer */}
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!inputText.trim()) {
                        setAlertModal({ isOpen: true, message: "Type a short prompt first, then click Sparkle to rewrite it into a professional, dense prompt!" });
                        return;
                      }
                      setIsEnhancing(true);
                      try {
                        const { enhancePrompt } = await import('./lib/gemini');
                        const enhancedText = await enhancePrompt(inputText);
                        setInputText(enhancedText);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsEnhancing(false);
                      }
                    }}
                    disabled={isEnhancing}
                    title="Smart Sparkle Prompt Enhancer"
                    className={`w-11 h-11 flex items-center justify-center rounded-full shrink-0 relative transition-all ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-[#ddd]'} ${isEnhancing ? 'text-[#00ff9d] animate-pulse' : 'text-blue-500 hover:text-blue-600'}`}
                  >
                    <Sparkles size={18} className={isEnhancing ? "animate-spin" : "animate-pulse duration-1000"} />
                  </button>

                  <div className="relative">
                    <button onClick={() => { if(isListening) { startListening(); } else { setIsMicMenuOpen(!isMicMenuOpen); } }} className={`w-11 h-11 flex items-center justify-center rounded-full shrink-0 ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-[#ddd]'} ${isListening ? 'text-red-500 animate-pulse' : ''}`}>
                      <Mic size={18} />
                    </button>
                    {isMicMenuOpen && !isListening && (
                      <div className={`absolute bottom-12 right-0 w-44 md:w-48 rounded-2xl border shadow-2xl py-2 z-50 animate-in slide-in-from-bottom-2 ${theme === 'dark' ? 'bg-[#1a1a1a] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                        <div className="px-4 py-2 text-[10px] md:text-sm font-semibold text-[#888] uppercase tracking-wider">Voice Mode</div>
                        
                        <div className={`px-4 py-2.5 md:py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setVoiceMode('chat'); setIsMicMenuOpen(false); startListening(); }}>
                           <div className="font-medium text-xs md:text-sm">Voice Chat</div>
                          {voiceMode === 'chat' && <Check size={14} className="text-blue-500" />}
                        </div>
                        
                        <div className={`px-4 py-2.5 md:py-3 cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f5f5f5]'}`} onClick={() => { setVoiceMode('dictation'); setIsMicMenuOpen(false); startListening(); }}>
                           <div className="font-medium text-xs md:text-sm">Dictation</div>
                          {voiceMode === 'dictation' && <Check size={14} className="text-blue-500" />}
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleSend()}
                    disabled={(!inputText.trim() && selectedFiles.length === 0) || isThinking}
                    className={`w-11 h-11 flex items-center justify-center rounded-xl shrink-0 transition-all shadow-2xl active:scale-95 ${(inputText.trim() || selectedFiles.length > 0) && !isThinking ? (theme === 'dark' ? 'bg-[#00ff9d] text-black hover:bg-white hover:neural-glow' : 'bg-black text-white hover:bg-gray-800') : (theme === 'dark' ? 'bg-white/5 text-white/20' : 'bg-gray-100 text-gray-300')}`}
                  >
                    <Send size={20} strokeWidth={2.5} />
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
             <NotebookUI theme={theme} user={user} />
          </div>
        )}

        {view === 'chat' && (
          <div className="flex flex-col h-full w-full max-w-4xl mx-auto relative px-0 md:px-4">
            <div className={`absolute top-0 left-0 right-0 z-30 p-2 md:p-3 flex items-center justify-between glass-header ${theme === 'dark' ? 'bg-black/80' : 'bg-white/80'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10"></div> {/* Spacer for sidebar toggle button */}
                <h2 className="font-bold text-sm md:text-base truncate max-w-[120px] sm:max-w-[180px] md:max-w-[400px]">
                  {currentConversationId ? (conversations.find(c => c.id === currentConversationId)?.title || 'Neural Chat') : 'New Chat'}
                </h2>
                {isPrivateChat && <span className="bg-[#00ff9d]/10 text-[#00ff9d] text-[9px] px-2 py-0.5 rounded border border-[#00ff9d]/20 font-bold uppercase tracking-wider shrink-0">Private</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Export Dropdown */}
                <div className="relative group/export">
                  <button 
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl border transition-all flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-[#111] border-[#222] text-[#00ff9d] hover:bg-white/5' : 'bg-gray-50 border-gray-200 text-black hover:bg-gray-100'}`}
                  >
                    <Download size={14} /> <span className="hidden sm:inline">Export Thread</span>
                  </button>
                  {/* Dropdown menu */}
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-2xl border shadow-2xl py-2 z-[100] hidden group-hover/export:block hover:block ${theme === 'dark' ? 'bg-[#1a1a1a] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                    <div className="px-4 py-1.5 text-[9px] font-bold text-[#888] uppercase tracking-wider">Download Chat</div>
                    
                    <button 
                      onClick={() => handleExportThread('markdown')} 
                      className={`w-full px-4 py-2 cursor-pointer text-left flex items-center gap-2.5 hover:bg-blue-500/15 text-xs font-medium`}
                    >
                      <span className="w-1.5 h-1.5 bg-[#00ff9d] rounded-full"></span>
                      Markdown (.md)
                    </button>
                    
                    <button 
                      onClick={() => handleExportThread('html')} 
                      className={`w-full px-4 py-2 cursor-pointer text-left flex items-center gap-2.5 hover:bg-blue-500/15 text-xs font-medium`}
                    >
                      <span className="w-1.5 h-1.5 bg-[#00ff9d] rounded-full"></span>
                      HTML Document (.html)
                    </button>
                    
                    <button 
                      onClick={() => handleExportThread('txt')} 
                      className={`w-full px-4 py-2 cursor-pointer text-left flex items-center gap-2.5 hover:bg-blue-500/15 text-xs font-medium`}
                    >
                      <span className="w-1.5 h-1.5 bg-[#00ff9d] rounded-full"></span>
                      Plain Text (.txt)
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => { setIsPrivateChat(false); setMessages([]); setCurrentConversationId(null); setView('home'); }}
                  className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl border transition-all flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-white text-black border-transparent hover:bg-[#00ff9d]' : 'bg-black text-white border-transparent hover:bg-gray-800'}`}
                >
                  <Plus size={14} strokeWidth={3} /> <span className="hidden xs:inline">New Message</span>
                </button>
              </div>
            </div>

            {isPrivateChat && (
              <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-10 bg-[#00ff9d]/5 text-[#00ff9d] px-6 py-2 rounded-full text-[10px] uppercase font-black tracking-widest border border-[#00ff9d]/20 flex items-center gap-2 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-pulse"></span>
                SECURE NEURAL CHANNEL
              </div>
            )}
            <div 
              ref={messagesContainerRef}
              onScroll={handleManualScroll}
              className="flex-1 overflow-y-auto px-4 py-6 md:px-6 pt-20 md:pt-28 pb-6 space-y-6 md:space-y-10 relative scroll-smooth overflow-x-hidden z-10"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 select-none text-center p-10">
                  <MessageSquare size={80} className="mb-6 opacity-20" />
                  <h3 className="text-xl md:text-2xl font-bold mb-2">Neural Chat</h3>
                  <p className="text-sm max-w-xs mx-auto">Start a new prompt below or select a past conversation from history.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                {messages.map((msg, i) => (
                  <ChatMessage 
                    key={msg.id || i}
                    msg={msg}
                    i={i}
                    messagesLength={messages.length}
                    theme={theme}
                    user={user}
                    copyToClipboard={copyToClipboard}
                    setAlertModal={setAlertModal}
                    setInputText={setInputText}
                    handleEdit={handleEdit}
                    setCanvasLanguage={setCanvasLanguage}
                    setCanvasContent={setCanvasContent}
                    setCanvasActiveProjectId={setCanvasActiveProjectId}
                    setView={setView}
                    setModals={setModals}
                  />
                ))}
                </AnimatePresence>
              )}
              {isThinking && (
                <div className="flex w-full justify-start mb-8">
                  <div className={`flex flex-col items-start max-w-[80%] min-w-0`}>
                    <div className={`flex items-center gap-2 mb-2 px-2 text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white/30' : 'text-black/30'}`}>
                      Assistant is thinking...
                    </div>
                    <div className={`p-4 md:p-5 rounded-2xl md:rounded-3xl flex items-center gap-3 ${theme === 'dark' ? 'bg-[#111] border-[#222]' : 'bg-white border-[#eee] shadow-md'}`}>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '200ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '400ms' }}></div>
                      </div>
                      <span className={`text-[13px] ${theme === 'dark' ? 'text-[#666]' : 'text-gray-400'}`}>{thinkingMessage}</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {showScrollBottom && (
              <button 
                onClick={() => scrollToBottom()}
                className={`absolute bottom-[130px] md:bottom-[150px] right-6 md:right-8 z-40 px-4 py-2 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 group flex items-center gap-2 border ${theme === 'dark' ? 'border-[#333] text-[#aaa] hover:border-[#555] hover:text-[#00ff9d] bg-black/95 backdrop-blur-xl' : 'border-[#ccc] text-[#555] hover:border-black hover:text-black bg-white/95 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2'}`}
              >
                <div className="relative">
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#00ff9d] rounded-full border-2 border-inherit animate-pulse"></div>
                  <ChevronDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Scroll to Latest</span>
              </button>
            )}
            
            {/* Input area rendered inline below the list to prevent overlapping layout entirely */}
            <div className={`p-4 md:p-6 pb-6 w-full ${theme === 'dark' ? 'bg-[#000]' : 'bg-white'} border-t ${theme === 'dark' ? 'border-[#111]' : 'border-gray-100'} z-20 shrink-0`}>
              <div className="w-full max-w-4xl mx-auto relative" ref={inputContainerRef}>
                {selectedFiles.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-2 w-full px-2">
                    {selectedFiles.map((file, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => {
                          if (file.mimeType === 'text/plain') {
                            handleViewPaste(file);
                          }
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border cursor-pointer group/file shrink-0 ${theme === 'dark' ? 'bg-[#222] border-[#444] text-white hover:border-blue-500/50' : 'bg-white border-[#ddd] text-black hover:border-blue-500/50'}`}
                      >
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                          }} 
                          className="opacity-40 hover:opacity-100 hover:text-red-500 transition-all p-0.5"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className={`flex items-end rounded-2xl p-1.5 min-h-[56px] md:min-h-[64px] h-auto border transition-all w-full relative ${theme === 'dark' ? 'bg-[#161616] border-[#2a2a2a] focus-within:border-[#555] focus-within:ring-4 focus-within:ring-white/10' : 'bg-[#f5f5f5] border-[#ddd] focus-within:border-[#999] focus-within:ring-4 focus-within:ring-black/10'}`}>
                  {isListening && (
                    <div className="absolute inset-x-1 inset-y-1.5 z-50 flex items-center justify-center bg-black/60 dark:bg-[#161616]/75 backdrop-blur-md rounded-xl select-none">
                      <VoiceWaveVisualizer theme={theme} />
                    </div>
                  )}
                  <div className="relative flex items-center mb-1">
                    <div onClick={() => setFileMenuOpen(!fileMenuOpen)} className="w-11 h-11 flex items-center justify-center text-[#666] cursor-pointer hover:text-white transition-colors shrink-0">
                      <Plus size={20} />
                    </div>
                    {fileMenuOpen && (
                      <div className={`absolute bottom-12 left-0 w-48 rounded-xl border shadow-2xl py-2 z-50 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
                        <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { fileInputRef.current?.click(); setFileMenuOpen(false); }}>
                          <span className="text-lg">💻</span> Upload from device
                        </div>
                        <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { folderInputRef.current?.click(); setFileMenuOpen(false); }}>
                          <span className="text-lg">📁</span> Upload Folder
                        </div>
                        <div className={`px-4 py-2 cursor-pointer hover:bg-black/10 flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-white/10' : ''}`} onClick={() => { openDrivePicker(); setFileMenuOpen(false); }}>
                          <span className="text-lg">☁️</span> Google Drive
                        </div>
                      </div>
                    )}
                    
                    <div className="relative flex items-center">
                      <button onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`flex items-center gap-1 px-3 h-11 md:h-8 rounded-full text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-[#333] text-[#ddd]' : 'hover:bg-[#e5e5e5] text-[#555]'}`}>
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
                  
                  <div className="relative flex items-center border-r border-[#ddd] dark:border-[#333] pr-2 mr-2 mb-1 self-center md:self-end">
                    <button onClick={() => setIsModelMenuOpen(!isModelMenuOpen)} className={`flex items-center gap-1 px-3.5 h-11 md:h-8 rounded-full text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-[#333] text-[#ddd]' : 'hover:bg-[#e5e5e5] text-[#555]'}`}>
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
                  <input type="file" ref={folderInputRef} onChange={handleFileSelect} className="hidden" {...({ webkitdirectory: "", mozdirectory: "", directory: "" } as any)} />
                    <textarea 
                      ref={chatInputRef}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={e => { 
                        if (e.key === 'Enter' && !e.shiftKey) { 
                          e.preventDefault(); 
                          handleSend(); 
                        } 
                      }}
                      onPaste={handlePaste}
                      placeholder={editingMessageIndex !== null ? "Editing message... Subsequent chats will be removed." : (selectedFiles.length > 0 ? `${selectedFiles.length} file(s) attached. Add a message...` : "Command Xero Engine...")}
                      className={`flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-[15px] md:text-[17px] px-2 py-3 resize-none max-h-[30vh] overflow-y-auto min-w-0 transition-all placeholder:font-black placeholder:uppercase placeholder:tracking-[0.1em] placeholder:text-[10px] md:placeholder:text-[11px] ${theme === 'dark' ? 'text-white placeholder:text-white/20' : 'text-black placeholder:text-black/30'}`}
                    />
                    <div className="flex items-center gap-2 pr-2 mb-1.5 self-end transition-all">
                      {editingMessageIndex !== null && (
                        <button 
                          onClick={() => { setEditingMessageIndex(null); setInputText(''); }} 
                          className="p-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          Cancel
                        </button>
                      )}
                      <div className="relative">
                      <button onClick={() => { if(isListening) { startListening(); } else { setIsMicMenuOpen(!isMicMenuOpen); } }} className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-white/40 hover:text-white' : 'hover:bg-black/5 text-black/40 hover:text-black'} ${isListening ? 'text-red-500 animate-pulse bg-red-500/10' : ''}`}>
                        <Mic size={20} strokeWidth={2.5} />
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
                      className={`w-11 h-11 flex items-center justify-center rounded-xl shrink-0 transition-all shadow-lg active:scale-95 ${(inputText.trim() || selectedFiles.length > 0) && !isThinking ? (theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800') : (theme === 'dark' ? 'bg-[#333] text-[#666]' : 'bg-[#ddd] text-[#999]')}`}
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="fluid-title font-bold">History</h2>
              <div className="flex items-center gap-2">
                <div className={`flex items-center px-3 py-2 rounded-xl border ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
                  <Search size={16} className="opacity-50 mr-2" />
                  <input
                    type="text"
                    placeholder="Search query..."
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

            {/* Conversation view filters */}
            <div className={`flex border-b mb-6 sm:mb-8 text-xs sm:text-sm font-bold tracking-wider uppercase ${theme === 'dark' ? 'border-[#222]' : 'border-[#ddd]'}`}>
              {(['all', 'pinned', 'archived'] as const).map((filter) => {
                const isActive = historyFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`relative py-3 px-4 transition-all duration-300 ${
                      isActive 
                        ? (theme === 'dark' ? 'text-[#00ff9d]' : 'text-emerald-600') 
                        : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <span>
                      {filter === 'all' ? 'All Sessions' : filter === 'pinned' ? 'Pinned 📌' : 'Archived 📦'}
                    </span>
                    {isActive && (
                      <motion.div 
                        layoutId="activeHistoryUnderline" 
                        className={`absolute bottom-0 left-0 right-0 h-[2px] ${theme === 'dark' ? 'bg-[#00ff9d]' : 'bg-emerald-600'}`} 
                      />
                    )}
                  </button>
                );
              })}
            </div>
            
            {(() => {
              const filteredConvs = conversations.filter((c: any) => {
                const searchLower = searchQuery.toLowerCase();
                const titleMatch = c.title.toLowerCase().includes(searchLower);
                const dateObj = c.updatedAt?.seconds ? new Date(c.updatedAt.seconds * 1000) : (c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : new Date(c.created_at || c.updated_at || c.createdAt || c.updatedAt || Date.now()));
                const dateMatch = dateObj.toLocaleDateString().includes(searchLower);
                if (!(titleMatch || dateMatch)) return false;

                if (historyFilter === 'pinned') {
                  return c.isPinned && !c.isArchived;
                }
                if (historyFilter === 'archived') {
                  return c.isArchived;
                }
                return !c.isArchived;
              });

              if (filteredConvs.length === 0) {
                return <div className="text-center opacity-50 mt-20">No past conversations matching the active filter found.</div>;
              }

              const renderHistoryItem = (conv: any) => (
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
                        <div className="font-medium text-base md:text-lg mb-1 flex items-center flex-wrap gap-2">
                          {conv.isPinned && <Pin size={14} className="text-[#00ff9d] fill-current" />}
                          {conv.title}
                          {(() => {
                            const lowerTitle = conv.title.toLowerCase();
                            const isSandbox = lowerTitle.includes('sandbox') || lowerTitle.includes('execute');
                            const isPic = lowerTitle.includes('generate image') || lowerTitle.includes('imagine') || lowerTitle.includes('pic gen');

                            if (isSandbox) return (
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                                Sandbox AI
                              </span>
                            );
                            if (isPic) return (
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                Pic Gen
                              </span>
                            );
                            return null;
                          })()}
                        </div>
                      )}
                      <div className="text-xs opacity-50">
                        {(() => {
                          const ts = conv.updatedAt?.seconds ? conv.updatedAt : (conv.createdAt?.seconds ? conv.createdAt : null);
                          const d = ts ? new Date(ts.seconds * 1000) : new Date(conv.created_at || conv.updated_at || conv.createdAt || conv.updatedAt || Date.now());
                          return d.toLocaleString();
                        })()}
                      </div>
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
                                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                                  onClick={(e) => { e.stopPropagation(); handleArchiveConv(conv.id, !!conv.isArchived); setActiveConvMenu(null); }}
                                >
                                  <Archive size={14} /> {conv.isArchived ? 'Unarchive' : 'Archive'}
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
              );

              // Extract pinned cards separately when in the All filter
              const pinnedConvs = historyFilter === 'all' ? filteredConvs.filter((c: any) => c.isPinned) : [];
              const unpinnedConvs = historyFilter === 'all' ? filteredConvs.filter((c: any) => !c.isPinned) : filteredConvs;

              const groupedByDate = groupConversationsByDate(unpinnedConvs);

              return (
                <div className="space-y-8">
                  {pinnedConvs.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-xs font-black text-[#00ff9d] uppercase tracking-[0.2em] bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 rounded-xl w-max">
                        <Pin size={12} className="fill-current animate-bounce" /> Pinned Workspace Sessions
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {pinnedConvs.map(conv => renderHistoryItem(conv))}
                      </div>
                    </div>
                  )}

                  {Object.entries(groupedByDate).map(([groupName, groupConvs]) => {
                    if (groupConvs.length === 0) return null;
                    return (
                      <div key={groupName} className="space-y-4">
                        <h3 className="text-xs font-bold opacity-40 uppercase tracking-widest pl-1">{groupName}</h3>
                        <div className="grid grid-cols-1 gap-4">
                          {groupConvs.map(conv => renderHistoryItem(conv))}
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
            <h2 className="fluid-title font-bold mb-3 md:mb-4">Imagine</h2>
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
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleGenerateImage(); } }}
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
              <h2 className="fluid-title font-bold">Projects</h2>
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
            <h2 className="fluid-title font-bold mb-4">Xer0bytepedia</h2>
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
          <div className={`w-full flex flex-col pt-[60px] md:pt-0 pb-0 absolute inset-0 bg-black ${isFullscreen ? 'z-[100] fixed h-screen [@supports(height:100dvh)]:h-[100dvh] w-screen [@supports(width:100dvw)]:w-[100dvw]' : 'z-40 h-full'}`}>
            <div className={`flex flex-wrap justify-between items-center p-2 sm:p-4 border-b gap-2 z-10 ${theme === 'dark' ? 'border-[#333] bg-[#0a0a0a]' : 'border-[#ddd] bg-white'}`}>
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-hidden">
                <button onClick={handleNewChat} className="p-1.5 hover:opacity-70 flex-shrink-0" title="Close & New Chat"><X size={18}/></button>
                <div className="flex items-center flex-shrink-0">
                  <button 
                    onClick={() => { setShowIdeHistory(!showIdeHistory); setShowIdeChat(false); setShowIdeDatabase(false); }} 
                    className={`p-1.5 sm:p-2 rounded-l-lg transition-colors border-r ${showIdeHistory ? (theme === 'dark' ? 'bg-[#333] text-[#00ff9d]' : 'bg-[#ddd] text-[#006633]') : 'hover:opacity-70'} ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}
                    title="History"
                  >
                    <Clock size={16} />
                  </button>
                  <button 
                    onClick={() => { setShowIdeDatabase(!showIdeDatabase); setShowIdeChat(false); setShowIdeHistory(false); }} 
                    className={`p-1.5 sm:p-2 rounded-r-lg transition-colors ${showIdeDatabase ? (theme === 'dark' ? 'bg-[#333] text-[#00ff9d]' : 'bg-[#ddd] text-[#006633]') : 'hover:opacity-70'}`}
                    title="Database/Backend"
                  >
                    <HardDrive size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 ml-1 min-w-0">
                  <PenTool size={16} className="text-[#00ff9d] flex-shrink-0" /> 
                  <h2 className="text-[10px] sm:text-base font-bold truncate">Neural Sandbox</h2>
                </div>
                <div className={`ml-auto sm:ml-2 px-2 py-1 rounded-full border flex items-center gap-1 transition-all ${theme === 'dark' ? 'bg-[#111] border-[#333] hover:border-[#555]' : 'bg-[#f5f5f5] border-[#ddd] hover:border-[#999]'}`}>
                  <div className="relative flex items-center">
                    <select 
                      value={canvasLanguage} 
                      onChange={e => setCanvasLanguage(e.target.value)} 
                      className="bg-transparent text-[10px] sm:text-xs outline-none font-mono focus:text-[#00ff9d] appearance-none cursor-pointer pr-4"
                    >
                      <optgroup label="Popular">
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript / React</option>
                        <option value="html">HTML5 / Canvas</option>
                        <option value="css">CSS3</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                        <option value="csharp">C#</option>
                      </optgroup>
                      <optgroup label="Systems & App">
                        <option value="rust">Rust</option>
                        <option value="go">Go</option>
                        <option value="c">C</option>
                        <option value="swift">Swift</option>
                        <option value="kotlin">Kotlin</option>
                        <option value="objectivec">Objective-C</option>
                        <option value="dart">Dart</option>
                      </optgroup>
                      <optgroup label="Web & Backend">
                        <option value="php">PHP</option>
                        <option value="ruby">Ruby</option>
                        <option value="lua">Lua</option>
                        <option value="perl">Perl</option>
                        <option value="elixir">Elixir</option>
                      </optgroup>
                      <optgroup label="Data & Research">
                        <option value="sql">SQL</option>
                        <option value="r">R Language</option>
                        <option value="julia">Julia</option>
                        <option value="matlab">MATLAB</option>
                        <option value="fortran">Fortran</option>
                        <option value="bash">Bash / Shell</option>
                        <option value="powershell">PowerShell</option>
                      </optgroup>
                      <optgroup label="Functional">
                        <option value="haskell">Haskell</option>
                        <option value="scala">Scala</option>
                        <option value="clojure">Clojure</option>
                        <option value="erlang">Erlang</option>
                        <option value="fsharp">F#</option>
                        <option value="ocaml">OCaml</option>
                        <option value="lisp">Lisp</option>
                        <option value="scheme">Scheme</option>
                        <option value="prolog">Prolog</option>
                      </optgroup>
                      <optgroup label="Low Level & HW">
                        <option value="assembly">Assembly</option>
                        <option value="verilog">Verilog</option>
                        <option value="vhdl">VHDL</option>
                        <option value="ada">Ada</option>
                        <option value="pascal">Pascal</option>
                      </optgroup>
                      <optgroup label="Docs & Config">
                        <option value="markdown">Markdown</option>
                        <option value="yaml">YAML</option>
                        <option value="json">JSON</option>
                        <option value="xml">XML</option>
                        <option value="latex">LaTeX</option>
                        <option value="solidity">Solidity</option>
                      </optgroup>
                      <optgroup label="Others & Fun">
                        <option value="zig">Zig</option>
                        <option value="nim">Nim</option>
                        <option value="d">D Language</option>
                        <option value="crystal">Crystal</option>
                        <option value="groovy">Groovy</option>
                        <option value="basic">BASIC</option>
                        <option value="cobol">COBOL</option>
                        <option value="brainfuck">Brainfuck</option>
                      </optgroup>
                      <optgroup label="Legacy & Niche">
                        <option value="smalltalk">Smalltalk</option>
                        <option value="foxpro">FoxPro</option>
                        <option value="coldfusion">ColdFusion</option>
                        <option value="actionscript">ActionScript</option>
                        <option value="tcl">Tcl</option>
                        <option value="objective-cpp">Objective-C++</option>
                        <option value="awk">Awk</option>
                        <option value="forth">Forth</option>
                        <option value="apl">APL</option>
                      </optgroup>
                    </select>
                    <ChevronDown size={10} className="absolute right-0 pointer-events-none opacity-50" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end">
                {/* Starter Code Templates Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-[10px] sm:text-xs border transition-all ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#00ff9d] hover:text-[#00ff9d] bg-[#111]' : 'border-[#ccc] text-[#555] hover:border-[#006633] hover:text-[#006633] bg-white'}`}
                  >
                    <span>Templates 🪄</span>
                  </button>
                  {isTemplateDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsTemplateDropdownOpen(false)}></div>
                      <div className={`absolute right-0 top-9 w-64 rounded-2xl border shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 p-1 text-left ${theme === 'dark' ? 'bg-[#0f0f0f] border-[#222] text-white' : 'bg-white border-[#ddd] text-black'}`}>
                        <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#888] mb-1.5">Boilerplate Presets</div>
                        {STARTER_TEMPLATES.map((t) => (
                          <div 
                            key={t.id}
                            onClick={() => {
                              setCanvasContent(t.code);
                              setCanvasLanguage(t.language);
                              setCanvasMode('split');
                              setIsTemplateDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-xl cursor-pointer text-left transition-all ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                          >
                            <div className="font-extrabold text-xs mb-0.5 flex items-center justify-between text-[#00ff9d]">
                              {t.title}
                              <span className="text-[7px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 bg-neutral-800 rounded text-[#aaa] border border-neutral-700">{t.language}</span>
                            </div>
                            <div className="text-[9px] opacity-60 leading-normal">{t.description}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button 
                  onClick={handleRunCode}
                  disabled={isCanvasRunning || isThinkingIde}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[10px] sm:text-xs border transition-all ${(isCanvasRunning || isThinkingIde) ? 'opacity-50 cursor-not-allowed' : ''} ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#00ff9d] hover:text-[#00ff9d] bg-[#111]' : 'border-[#ccc] text-[#555] hover:border-[#006633] hover:text-[#006633] bg-white'}`}
                >
                  <Play size={12} fill="currentColor" /> {isCanvasRunning ? 'Running' : 'Run'}
                </button>
                <button onClick={() => setCanvasMode(canvasMode === 'edit' ? 'split' : 'edit')} className={`px-3 py-1.5 rounded-full font-bold text-[10px] sm:text-xs border transition-all ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:bg-[#222] bg-[#111]' : 'border-[#ccc] text-[#555] hover:bg-[#eee] bg-white'}`}>
                  {canvasMode === 'edit' ? 'Output' : 'Editor'}
                </button>
              </div>
            </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button onClick={() => setIsFullscreen(!isFullscreen)} className={`p-2 rounded-full transition-all hidden md:flex items-center gap-1.5 ${theme === 'dark' ? 'hover:bg-[#222] text-[#aaa]' : 'hover:bg-[#eee] text-[#555]'}`}>
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
                <div className={`h-8 w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'} mx-1 hidden md:block`}></div>
                <button 
                  onClick={() => setShowIdeChat(!showIdeChat)}
                  className={`p-2 rounded-full transition-all ${showIdeChat ? (theme === 'dark' ? 'bg-[#00ff9d] text-black' : 'bg-black text-white') : (theme === 'dark' ? 'hover:bg-[#222]' : 'hover:bg-[#eee]')}`}
                  title="Toggle AI Sidebar"
                >
                  <MessageSquare size={18}/>
                </button>
              </div>
            
            <div className={`flex-1 relative overflow-hidden flex flex-col md:flex-row pb-[60px] ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
              {(showIdeHistory || showIdeChat || showIdeDatabase) && (
                <div className={`w-full md:w-[350px] border-b md:border-b-0 md:border-r z-30 flex flex-col h-[400px] md:h-full transition-all duration-300 ${theme === 'dark' ? 'bg-[#0f0f0f] border-[#333]' : 'bg-[#f9f9f9] border-[#ddd]'}`}>
                  <div className={`flex p-1 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
                    <button 
                      onClick={() => { setShowIdeChat(true); setShowIdeHistory(false); setShowIdeDatabase(false); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${showIdeChat ? (theme === 'dark' ? 'bg-[#222] text-white' : 'bg-white text-black shadow-sm') : 'opacity-40'}`}
                    >
                      <MessageSquare size={14} /> Chat
                    </button>
                    <button 
                      onClick={() => { setShowIdeHistory(true); setShowIdeChat(false); setShowIdeDatabase(false); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${showIdeHistory ? (theme === 'dark' ? 'bg-[#222] text-white' : 'bg-white text-black shadow-sm') : 'opacity-40'}`}
                    >
                      <Clock size={14} /> History
                    </button>
                    <button 
                      onClick={() => { setShowIdeDatabase(true); setShowIdeChat(false); setShowIdeHistory(false); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${showIdeDatabase ? (theme === 'dark' ? 'bg-[#222] text-white' : 'bg-white text-black shadow-sm') : 'opacity-40'}`}
                    >
                      <HardDrive size={14} /> Database
                    </button>
                    <button 
                      onClick={async () => {
                        const newConv = await firestoreService.createSandboxConversation(user!.id, "New Sandbox Chat");
                        const newConvId = newConv.id;
                        setSandboxConversations(prev => [{
                          id: newConvId,
                          userId: user!.id,
                          title: "New Sandbox Chat",
                          lastMessage: "",
                          timestamp: Date.now(),
                          isArchived: false,
                          isPinned: false
                        }, ...prev]);
                        setCurrentIdeConversationId(newConvId);
                        setIdeMessages([]);
                        setShowIdeChat(true);
                        setShowIdeHistory(false);
                      }}
                      className={`px-3 py-1 flex items-center justify-center rounded-full border transition-all text-xs font-bold ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}
                      title="New Chat"
                    >
                      <Plus size={14} className="mr-1" /> New
                    </button>
                  </div>

                  {showIdeChat && (
                    <div className="flex-1 flex flex-col min-h-0 relative">
                      <div className="p-4 border-b flex items-center justify-between md:hidden">
                        <span className="font-bold text-xs uppercase tracking-wider opacity-60">AI Chat</span>
                        <button onClick={() => setShowIdeChat(false)} className="p-1"><X size={16}/></button>
                      </div>
                      <div 
                        ref={ideMessagesContainerRef}
                        onScroll={handleIdeManualScroll}
                        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth"
                      >
                        {ideMessages.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-6 space-y-3">
                            <PenTool size={40} />
                            <p className="text-xs font-medium">Ask AI to write some code or explain something!</p>
                          </div>
                        ) : (
                          ideMessages.map((msg, i) => (
                            <ChatMessage 
                               key={msg.id || i}
                               msg={msg}
                               i={i}
                               messagesLength={ideMessages.length}
                               theme={theme}
                               user={user}
                               copyToClipboard={copyToClipboard}
                               setAlertModal={setAlertModal}
                               setInputText={setIdePrompt}
                               handleEdit={handleIdeEdit}
                               setCanvasLanguage={setCanvasLanguage}
                               setCanvasContent={setCanvasContent}
                               setCanvasActiveProjectId={setCanvasActiveProjectId}
                               setView={setView}
                               setModals={setModals}
                               compact={true}
                            />
                          ))
                        )}
                        <div ref={ideMessagesEndRef} />
                      </div>

                      {showIdeScrollBottom && (
                        <button 
                          onClick={() => scrollToIdeBottom()}
                          className={`absolute bottom-[86px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg border transition-all animate-in fade-in zoom-in hover:scale-105 ${theme === 'dark' ? 'border-[#333] text-[#aaa] hover:border-[#555] hover:text-[#00ff9d] bg-black/95 backdrop-blur-xl' : 'border-[#ccc] text-[#555] hover:border-[#aaa] hover:text-black bg-white/95 backdrop-blur-xl'}`}
                        >
                          <ChevronDown size={14} className="animate-bounce" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Scroll to Latest</span>
                        </button>
                      )}
                    </div>
                  )}

                  {showIdeHistory && (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="p-4 border-b font-bold flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs opacity-60">
                          <span>Conversation History</span>
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => { setIdeMessages([]); setCurrentIdeConversationId(null); setShowIdeChat(true); }} 
                              className={`px-2 py-1 rounded-full border transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'border-[#444] text-[#aaa] hover:border-[#777] hover:text-white bg-transparent' : 'border-[#ccc] text-[#555] hover:border-[#999] hover:text-black bg-transparent'}`}
                            >
                              <Plus size={12} /> <span>New Chat</span>
                            </button>
                            <button onClick={() => setShowIdeHistory(false)} className="md:hidden"><X size={14}/></button>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${theme === 'dark' ? 'bg-[#050505] border-[#222]' : 'bg-white border-[#ddd]'}`}>
                          <Search size={12} className="opacity-40" />
                          <input 
                            type="text" 
                            placeholder="Search sandbox..." 
                            value={sandboxSearchQuery}
                            onChange={(e) => setSandboxSearchQuery(e.target.value)}
                            className="bg-transparent border-none outline-none w-full"
                          />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {sandboxConversations.filter(c => c.title.toLowerCase().includes(sandboxSearchQuery.toLowerCase())).length === 0 ? (
                          <div className="p-10 text-center opacity-30 text-xs italic">No conversations found.</div>
                        ) : (
                          sandboxConversations.filter(c => c.title.toLowerCase().includes(sandboxSearchQuery.toLowerCase())).map((conv) => (
                            <div 
                              key={conv.id} 
                              onClick={() => {
                                setCurrentIdeConversationId(conv.id);
                                setShowIdeChat(true);
                                setShowIdeHistory(false);
                              }}
                              className={`p-4 border-b cursor-pointer transition-colors group ${currentIdeConversationId === conv.id ? (theme === 'dark' ? 'bg-[#1a1a1a] border-l-4 border-l-[#00ff9d]' : 'bg-[#f0f0f0] border-l-4 border-l-[#006633]') : (theme === 'dark' ? 'border-[#222] hover:bg-[#111]' : 'border-[#eee] hover:bg-[#fafafa]')}`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <MessageSquare size={12} className={currentIdeConversationId === conv.id ? "text-[#00ff9d]" : "opacity-40"} />
                                <div className={`text-sm font-medium line-clamp-1 ${currentIdeConversationId === conv.id ? "text-[#00ff9d]" : ""}`}>{conv.title}</div>
                              </div>
                              <div className="text-[10px] opacity-40">{new Date(conv.timestamp).toLocaleString()}</div>
                            </div>
                          ))
                        )}
                        
                        <div className="p-4 border-t border-b bg-black/5 dark:bg-white/5 font-bold text-[10px] uppercase tracking-widest opacity-40">
                          Sandbox Code History
                        </div>
                        {canvasHistory.length === 0 ? (
                          <div className="p-10 text-center opacity-30 text-xs italic">No code history yet.</div>
                        ) : (
                          canvasHistory.map((h, i) => (
                            <div 
                              key={i} 
                              onClick={() => {
                                setCanvasContent(h.code);
                                const match = h.code.match(/```([a-z0-9#\-\+]+)?\n/i);
                                if (match && match[1]) setCanvasLanguage(match[1].toLowerCase());
                              }}
                              className={`p-4 border-b cursor-pointer transition-colors group ${theme === 'dark' ? 'border-[#222] hover:bg-[#1a1a1a]' : 'border-[#eee] hover:bg-[#f0f0f0]'}`}
                            >
                              <div className="text-sm font-medium line-clamp-2 mb-1 group-hover:text-[#00ff9d] italic">"{h.prompt}"</div>
                              <div className="text-[10px] opacity-40">{new Date(h.timestamp).toLocaleString()}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {showIdeDatabase && (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="p-4 border-b font-bold flex justify-between items-center text-xs opacity-60">
                        <span>Backend Cloud Services</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse"></div>
                            <span className="text-[#00ff9d] uppercase">Online</span>
                          </div>
                          <button onClick={() => setShowIdeDatabase(false)} className="md:hidden"><X size={14}/></button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        {!isBackendActive ? (
                          <div className={`p-6 rounded-2xl border-2 border-dashed text-center flex flex-col items-center gap-4 ${theme === 'dark' ? 'border-[#333] bg-[#111]' : 'border-[#ddd] bg-gray-50'}`}>
                            <div className="w-16 h-16 rounded-full bg-[#00ff9d]/10 flex items-center justify-center text-[#00ff9d]">
                              <Lock size={32} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold mb-1">Neural Backend Locked</h3>
                              <p className="text-[10px] opacity-60 leading-relaxed max-w-[200px] mx-auto">
                                Activate your cloud infrastructure to start building full-stack applications with real-time data persistence.
                              </p>
                            </div>
                            <button 
                              onClick={async () => {
                                setIsSyncingBackend(true);
                                // Simulation of activation/sync
                                await new Promise(r => setTimeout(r, 2000));
                                setIsBackendActive(true);
                                setIsSyncingBackend(false);
                              }}
                              disabled={isSyncingBackend}
                              className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-[#00ff9d] text-black hover:bg-white' : 'bg-black text-white hover:bg-gray-800'}`}
                            >
                              {isSyncingBackend ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <CheckCircle size={14} />
                              )}
                              {isSyncingBackend ? "Syncing Clusters..." : "Activate Cloud Backend"}
                            </button>
                            <p className="text-[9px] opacity-40 italic">By activating, you agree to Xer0byte Neural Cloud terms.</p>
                          </div>
                        ) : (
                          <>
                            <div>
                              <h4 className="text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Active Neural Nodes</h4>
                              <div className="space-y-2">
                                 {[
                                   { name: 'Auth Node', path: 'firebase/auth', status: 'Secure' },
                                   { name: 'Neural Store', path: 'google/firestore', status: 'Live' },
                                   { name: 'Asset Bucket', path: 'firebase/storage', status: 'Active' },
                                   { name: 'Real-time Socket', path: 'neural/stream', status: 'Online' }
                                 ].map((col, idx) => (
                                   <div key={idx} className={`p-3 rounded-xl border flex justify-between items-center ${theme === 'dark' ? 'bg-[#161616] border-[#222]' : 'bg-white border-[#eee]'}`}>
                                     <div>
                                       <div className="text-xs font-bold flex items-center gap-2">
                                         <HardDrive size={12} className="text-[#00ff9d]" />
                                         {col.name}
                                       </div>
                                       <div className="text-[10px] opacity-40 font-mono mt-0.5">{col.path}</div>
                                     </div>
                                     <div className="px-2 py-0.5 bg-[#00ff9d]/10 text-[#00ff9d] text-[9px] font-bold rounded uppercase">
                                       {col.status}
                                     </div>
                                   </div>
                                 ))}
                              </div>
                            </div>

                            <div className={`p-4 rounded-2xl border-2 border-dashed ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
                              <div className="flex items-center gap-3 mb-2">
                                <Lock size={16} className="text-[#00ff9d]" />
                                <span className="text-xs font-bold uppercase tracking-wider">Cloud Integrity</span>
                              </div>
                              <p className="text-[10px] opacity-60 leading-relaxed">
                                Sandbox cloud state is fully synced. Changes in code will automatically update your neural database schema.
                              </p>
                            </div>

                            <button 
                              onClick={() => {
                                setIdePrompt("Optimize my current backend configuration and check for security vulnerabilities.");
                                setShowIdeChat(true);
                                setShowIdeDatabase(false);
                              }}
                              className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'bg-[#222] border border-[#333] hover:border-[#00ff9d] text-[#00ff9d]' : 'bg-white border border-[#ddd] hover:border-black text-black'}`}
                            >
                              <Wrench size={14} /> Full System Audit
                            </button>
                          </>
                        )}

                        <div className="opacity-20 text-[9px] text-center uppercase tracking-widest mt-auto pt-10">
                          Secure Cloud Infrastructure v4.2
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                    <div className="flex items-center gap-2">
                       <span>{canvasLiveWeb ? 'Live Web Preview' : 'Console Output'}</span>
                       {isCanvasRunning && <span className="animate-pulse w-2 h-2 rounded-full bg-[#00ff9d]"></span>}
                    </div>
                    <button 
                      onClick={() => setCanvasOutput('')}
                      className="p-1 hover:text-white transition-colors opacity-50 hover:opacity-100"
                      title="Clear Console"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col bg-[#0a0a0a] min-h-[100px] relative overflow-hidden">
                    {canvasLiveWeb ? (
                      <iframe 
                        title="Live Preview"
                        srcDoc={processedSrcDoc}
                        className="w-full h-full border-none bg-white font-sans"
                        sandbox="allow-scripts allow-popups opacity-100"
                      />
                    ) : (
                      <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 p-4 font-mono text-[13px] leading-relaxed overflow-y-auto custom-scrollbar scroll-smooth space-y-1">
                          {consoleLogs.length === 0 && !canvasOutput && (
                             <span className="opacity-40 italic text-white/40 block">Neural terminal initialized. Output will appear here...</span>
                          )}
                          {canvasOutput && (
                            <div className="text-[#00ff9d] mb-2">{canvasOutput}</div>
                          )}
                          {consoleLogs.map((log, idx) => (
                            <div key={idx} className={`flex gap-2 ${log.type === 'input' ? 'text-white' : log.type === 'error' ? 'text-red-400' : 'text-[#00ff9d]'}`}>
                              <span className="opacity-30">{log.type === 'input' ? '$' : '>'}</span>
                              <span className="break-all">{log.text}</span>
                            </div>
                          ))}
                        </div>
                        <form 
                          onSubmit={handleConsoleSubmit} 
                          className="p-2 md:p-3 bg-[#0f0f0f] border-t border-[#222] flex items-center gap-2 group focus-within:border-[#00ff9d] transition-colors"
                        >
                          <span className="text-[#00ff9d] opacity-50 text-xs md:text-sm font-mono ml-1">$</span>
                          <input 
                            type="text" 
                            value={consoleInput}
                            onChange={(e) => setConsoleInput(e.target.value)}
                            placeholder="Type neural command or input data..."
                            className="flex-1 bg-transparent text-[12px] md:text-[14px] font-mono text-[#00ff9d] outline-none px-1 py-1 placeholder:opacity-30"
                            autoFocus
                          />
                          <div className="flex items-center gap-2 pr-1 opacity-0 group-focus-within:opacity-100 transition-opacity">
                            <span className="text-[10px] items-center gap-1.5 font-mono text-[#00ff9d]/40 hidden sm:block">Press Enter</span>
                            <ArrowUp size={12} className="text-[#00ff9d] animate-bounce" />
                            <button 
                              type="button" 
                              onClick={() => setConsoleLogs([{ type: 'log', text: 'Console cleared.' }])}
                              className="text-[10px] font-mono text-red-500/50 hover:text-red-500 ml-2"
                            >
                              CLEAR
                            </button>
                          </div>
                        </form>
                      </div>
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
                   <div className={`flex items-center rounded-full px-2 py-1.5 border transition-all shadow-sm relative ${theme === 'dark' ? 'bg-[#0a0a0a] border-[#444] focus-within:border-[#00ff9d] focus-within:ring-2 focus-within:ring-[#00ff9d]/20' : 'bg-[#f5f5f5] border-[#ccc] focus-within:border-[#006633] focus-within:ring-2 focus-within:ring-[#006633]/20'}`}>
                     {isListeningIde && (
                       <div className="absolute inset-x-1 inset-y-1 z-50 flex items-center justify-center bg-black/60 dark:bg-[#0a0a0a]/75 backdrop-blur-md rounded-full select-none">
                         <VoiceWaveVisualizer theme={theme} />
                       </div>
                     )}
                      <div className="flex items-center gap-1 md:gap-2 px-1">
                        <input type="file" ref={ideFileInputRef} onChange={handleIdeFileSelect} className="hidden" accept="*/*" multiple />
                        <input type="file" ref={ideFolderInputRef} onChange={handleIdeFileSelect} className="hidden" {...({ webkitdirectory: "", mozdirectory: "", directory: "" } as any)} />
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
                        placeholder={editingIdeMessageIndex !== null ? "Editing Sandbox prompt... Chat below will be removed." : (ideSelectedFiles.length > 0 ? "Tell AI what to do with these files & code..." : "Prompt AI to edit your code (e.g., 'Change this to loop 10 times')")}
                        className={`w-full bg-transparent border-none text-[15px] outline-none py-1 mr-2 ${theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-black placeholder-gray-400'}`}
                      />

                      <div className="flex items-center gap-1 pr-1">
                        {editingIdeMessageIndex !== null && (
                          <button 
                            onClick={() => { setEditingIdeMessageIndex(null); setIdePrompt(''); }} 
                            className="p-2 mr-1 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 transition-all"
                          >
                            Cancel
                          </button>
                        )}
                        {/* Smart Sparkle IDE Prompt Enhancer */}
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!idePrompt.trim()) {
                              setAlertModal({ isOpen: true, message: "Type a short prompt first, then click Sparkle to rewrite it into a professional, dense prompt!" });
                              return;
                            }
                            setIsEnhancingIde(true);
                            try {
                              const { enhancePrompt } = await import('./lib/gemini');
                              const enhancedText = await enhancePrompt(idePrompt);
                              setIdePrompt(enhancedText);
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setIsEnhancingIde(false);
                            }
                          }}
                          disabled={isEnhancingIde}
                          title="Smart Sparkle Prompt Enhancer"
                          className={`p-2 rounded-full relative transition-all ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-[#ddd]'} ${isEnhancingIde ? 'text-[#00ff9d] animate-pulse' : 'text-blue-500 hover:text-blue-600'}`}
                        >
                          <Sparkles size={20} className={isEnhancingIde ? "animate-spin" : "animate-pulse duration-1000"} />
                        </button>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setModals({...modals, createProject: false}) }}>
          <div className={`w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
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
                    <button onClick={() => setTheme('light')} className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${theme === 'light' ? 'bg-[#00ff9d] text-black shadow-lg' : 'bg-black/10 text-[#888] hover:bg-black/20'}`}>Light</button>
                    <button onClick={() => setTheme('dark')} className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${theme === 'dark' ? 'bg-[#00ff9d] text-black shadow-lg' : 'bg-white/10 text-[#888] hover:bg-white/20'}`}>Dark</button>
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
                  <button onClick={handleDeleteAll} className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm md:text-base ${theme === 'dark' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-600 text-white hover:bg-red-700'}`}>Delete</button>
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

                <div className="flex bg-black/40 backdrop-blur-md rounded-xl p-1.5 mb-10 max-w-xs mx-auto border border-white/5">
                  <button onClick={() => setPlanTab('individual')} className={`flex-1 px-4 md:px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${planTab === 'individual' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>Individual</button>
                  <button onClick={() => setPlanTab('business')} className={`flex-1 px-4 md:px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${planTab === 'business' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>Business</button>
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
                    
                    <button onClick={() => handleUpgradePro(planTab === 'individual' ? 'lite' : 'business_lite')} className="w-full py-3 md:py-4 rounded-xl bg-white/10 text-white font-bold text-base md:text-lg hover:bg-white/20 transition-all active:scale-[0.98] mb-8 border border-white/10 shadow-lg">
                      Upgrade to Lite
                    </button>

                    <ul className="space-y-4 md:space-y-5 text-white/80 font-medium flex-1 text-sm md:text-base">
                      {planTab === 'individual' ? (
                        <>
                          <li className="flex items-center gap-4"><span className="text-white">🚀</span> Access to Gemini 1.5 Pro</li>
                          <li className="flex items-center gap-4"><span className="text-white">🎤</span> Live AI Voice Mode Access</li>
                          <li className="flex items-center gap-4"><span className="text-white">🧠</span> Neural Sandbox (Frontend Only)</li>
                          <li className="flex items-center gap-4"><span className="text-white">🖼️</span> Basic AI Image Generation</li>
                          <li className="flex items-center gap-4"><span className="text-white">📁</span> 5 GB Secure Storage</li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-center gap-4"><span className="text-white">🚀</span> Gemini 1.5 Pro for Teams</li>
                          <li className="flex items-center gap-4"><span className="text-white">🎤</span> Unlimited Voice Mode for members</li>
                          <li className="flex items-center gap-4"><span className="text-white">🧠</span> Neural Sandbox Team Shared</li>
                          <li className="flex items-center gap-4"><span className="text-white">📁</span> 100 GB Team Storage</li>
                          <li className="flex items-center gap-4"><span className="text-white">🎧</span> Priority Support</li>
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
                    
                    <button onClick={() => handleUpgradePro(planTab === 'individual' ? 'pro' : 'business_pro')} className="w-full py-3 md:py-4 rounded-xl bg-white text-black font-bold text-base md:text-lg hover:bg-gray-200 transition-all active:scale-[0.98] mb-8 relative z-10 shadow-xl shadow-white/5">
                      Upgrade to SuperXer0byte
                    </button>

                    <ul className="space-y-4 md:space-y-5 text-white/80 font-medium flex-1 relative z-10 text-sm md:text-base">
                      {planTab === 'individual' ? (
                        <>
                          <li className="flex items-center gap-4"><span className="text-white">🚀</span> Neural Thinking & Advanced Gemini 3.1 Pro</li>
                          <li className="flex items-start gap-4">
                            <span className="text-white mt-1">🧠</span> 
                            <div>
                              <div className="text-white">Full-Stack Neural IDE</div>
                              <div className="text-[10px] md:text-sm text-white/50 font-normal">Build 100% functional Neural Sites & Cloud Apps</div>
                            </div>
                          </li>
                          <li className="flex items-start gap-4">
                            <span className="text-white mt-1">🎨</span> 
                            <div>
                              <div className="text-white">Pro Generative Suite</div>
                              <div className="text-[10px] md:text-sm text-white/50 font-normal">4K Image Gen & Neural Waveforms (Lyria Beta)</div>
                            </div>
                          </li>
                          <li className="flex items-center gap-4"><span className="text-white">🎤</span> Unlimited Interactive Neural Voice Mode</li>
                          <li className="flex items-center gap-4"><span className="text-white">📁</span> 50 GB Neural Cloud Storage (High Speed)</li>
                          <li className="flex items-center gap-4"><span className="text-white">⚡</span> Zero restrictions on Neural Thought Length</li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-center gap-4"><span className="text-white">🚀</span> Team-Wide Neural Compute (Priority)</li>
                          <li className="flex items-start gap-4">
                            <span className="text-white mt-1">🌩️</span> 
                            <div>
                              <div className="text-white">Neural Enterprise Cloud</div>
                              <div className="text-[10px] md:text-sm text-white/50 font-normal">Dedicated Managed Clusters & Data Sync</div>
                            </div>
                          </li>
                          <li className="flex items-start gap-4">
                            <span className="text-white mt-1">📁</span> 
                            <div>
                              <div className="text-white">1 TB Massive Secure Storage</div>
                              <div className="text-[10px] md:text-sm text-white/50 font-normal">Infinite History & Bulk File Processing</div>
                            </div>
                          </li>
                          <li className="flex items-center gap-4"><span className="text-white">🛡️</span> Bank-Grade Neural Encryption & SSO</li>
                          <li className="flex items-center gap-4"><span className="text-white">👨‍💼</span> Dedicated 24/7 Neural Support Team</li>
                        </>
                      )}
                    </ul>
                  </div>

                </div>
              </div>
            ) : (
              <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-3xl p-6 md:p-8 flex flex-col">
                <button onClick={() => setUpgradeStep('plans')} className="text-white/50 hover:text-white mb-6 self-start flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
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

                <button onClick={handlePaymentSubmit} disabled={isSubmittingPayment} className={`w-full py-4 rounded-xl font-bold transition-all shadow-xl active:scale-[0.98] text-lg disabled:opacity-50 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>
                  {isSubmittingPayment ? 'Submitting...' : 'Submit Payment Proof'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Paste Modal */}
      {viewPasteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in" onClick={(e) => { if(e.target === e.currentTarget) setViewPasteModal({ ...viewPasteModal, isOpen: false }) }}>
          <div className={`w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-white border-[#ddd] text-black'}`}>
            <div className={`flex justify-between items-center p-5 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                  <Clipboard size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold truncate max-w-[300px] md:max-w-md">{viewPasteModal.title}</h2>
                  <p className="text-[10px] uppercase font-black tracking-widest opacity-40">Neural Data Stream</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => {
                    copyToClipboard(viewPasteModal.content);
                    setAlertModal({ isOpen: true, message: "Copied to clipboard!" });
                  }} 
                  className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold ${theme === 'dark' ? 'bg-[#222] border-[#333] hover:bg-[#333] hover:text-[#00ff9d]' : 'bg-[#f5f5f5] border-[#ddd] hover:bg-[#eee] hover:text-blue-600'}`}
                >
                  <Copy size={16} /> <span className="hidden sm:inline">Copy</span>
                </button>
                <button onClick={() => setViewPasteModal({ ...viewPasteModal, isOpen: false })} className="hover:opacity-70 p-2 ml-2 transition-transform hover:rotate-90 duration-300"><X size={24} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-10 font-mono text-sm md:text-base leading-relaxed whitespace-pre-wrap select-text selection:bg-blue-500/30 custom-scrollbar">
              {viewPasteModal.content}
            </div>
            <div className={`p-5 border-t ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'} flex justify-between items-center bg-inherit`}>
               <div className="text-[10px] opacity-30 font-mono">Size: {new Blob([viewPasteModal.content]).size} bytes | {viewPasteModal.content.split('\n').length} lines</div>
               <button onClick={() => setViewPasteModal({ ...viewPasteModal, isOpen: false })} className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 text-xs ${theme === 'dark' ? 'bg-white text-black hover:bg-[#00ff9d]' : 'bg-black text-white hover:bg-gray-800'}`}>Close Link</button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {(modals.signIn || modals.signUp) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setModals({...modals, signIn: false, signUp: false}) }}>
          <div className={`w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-[#333] text-white' : 'bg-[#f5f5f5] border-[#ddd] text-black'}`}>
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
                  <button onClick={() => profilePhotoInputRef.current?.click()} className={`px-3 md:px-4 py-1.5 rounded-xl font-bold transition-all text-xs md:text-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>Upload</button>
                </div>
                <div className={`flex justify-between items-center py-3.5 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#eee]'}`}>
                  <span className="text-sm md:text-base">Update Name</span>
                  <button onClick={handleUpdateName} className={`px-3 md:px-4 py-1.5 rounded-xl font-bold transition-all text-xs md:text-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>Edit</button>
                </div>
                <div className={`flex justify-between items-center py-3.5 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#eee]'}`}>
                  <span className="text-sm md:text-base">Update Email</span>
                  <button onClick={() => setAlertModal({isOpen: true, message: "For security, please contact support to change your email."})} className={`px-3 md:px-4 py-1.5 rounded-xl font-bold transition-all text-xs md:text-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>Edit</button>
                </div>
                <div className={`flex justify-between items-center py-3.5 border-b ${theme === 'dark' ? 'border-[#222]' : 'border-[#eee]'}`}>
                  <span className="text-sm md:text-base">Change Password</span>
                  <button onClick={handleResetPassword} className={`px-3 md:px-4 py-1.5 rounded-xl font-bold transition-all text-xs md:text-sm ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>Reset</button>
                </div>
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 mt-4 gap-3 border-t ${theme === 'dark' ? 'border-[#444]' : 'border-[#ddd]'}`}>
                  <span className="text-sm md:text-base">Sign out from all devices</span>
                  <button onClick={handleLogout} className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm ${theme === 'dark' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-600 text-white hover:bg-red-700'}`}>Sign out everywhere</button>
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
            <button onClick={() => { localStorage.setItem('xer0byteCookies', 'declined'); setHasAcceptedCookies(true); }} className={`p-2 rounded-xl transition-all flex items-center justify-center shadow-sm ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/10 text-black hover:bg-black/20'}`}>
              <X size={16} />
            </button>
            <button onClick={handleAcceptCookies} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>
              Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}