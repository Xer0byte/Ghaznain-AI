import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot, Mail, Store, Calculator, Check, Copy, Send, Plus, Trash2,
  FileUp, Sparkles, ArrowUpRight, Sliders, Download, RefreshCw, X, Play
} from 'lucide-react';
import { generateContentStreamWithRetry } from '../lib/gemini';
import { STARTER_TEMPLATES, StarterTemplate } from '../lib/templates';
import { copyToClipboard, downloadTextFile, extractUrlsFromText, fetchWebUrlsData, formatWebUrlsForPrompt } from '../lib/utils';

interface BrandMemory {
  brandName: string;
  founderName: string;
  niche: string;
  market: string;
  currency: string;
  tone: string;
  productsOrServices: string;
}

interface CustomAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  samplePrompt: string;
}

interface QueueItem {
  id: string;
  agentName: string;
  agentRole: string;
  prompt: string;
  output: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

interface AgentWorkspaceProps {
  theme: 'dark' | 'light';
  user: any;
  onLaunchTemplate: (template: StarterTemplate) => void;
  onLaunchCustomSandbox: (prompt: string) => void;
  onSendToMainChat: (text: string) => void;
}

const DEFAULT_BRAND: BrandMemory = {
  brandName: 'Xer0byte',
  founderName: 'Ghaznain Ahmad',
  niche: 'AI Solutions, Web Development & Digital Commerce',
  market: 'Global / Pakistan / ASEAN',
  currency: 'USD',
  tone: 'Clear, direct, practical, and trustworthy',
  productsOrServices: 'AI workflows, Python automation, React web applications, e-commerce systems',
};

const BUILTIN_AGENTS: CustomAgent[] = [
  {
    id: 'muse',
    name: 'Muse',
    role: 'Social Media Executive',
    description: 'Turns weekly offers and product launches into multi-platform content calendars, ad hooks, and campaign recaps.',
    systemPrompt:
      'You are Muse, a senior Social Media Executive. Produce structured weekly content calendars, platform-tailored hooks (Instagram, TikTok, LinkedIn, X), visual creative briefs, and measurable KPI tracking plans. Lead with immediate, publish-ready drafts.',
    samplePrompt: 'Create a 7-day product launch campaign with 3 short-form video hooks and 2 LinkedIn posts.',
  },
  {
    id: 'closer',
    name: 'Closer',
    role: 'Sales Executive',
    description: 'Qualifies inbound leads, drafts quote follow-ups, handles pricing objections, and keeps active deals moving.',
    systemPrompt:
      'You are Closer, a disciplined B2B/B2C Sales Executive. Provide lead qualification scorecards, crisp follow-up sequences, objection-handling scripts, and concrete next steps to close quotes cleanly without hype.',
    samplePrompt: 'Draft a 3-step follow-up sequence for a prospect who requested a custom storefront quote 4 days ago.',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    role: 'Bookkeeper Assistant',
    description: 'Cleans expense logs and CSV tables, categorizes P&L entries, checks margins, and prepares month-end close summaries.',
    systemPrompt:
      'You are Ledger, a meticulous Bookkeeper Assistant. Parse transaction data or expense lists, output clean Markdown financial tables with categorized line items, calculate totals accurately, flag margin leaks or duplicate expenses, and list month-end reconciliation checks.',
    samplePrompt: 'Categorize monthly software, shipping, and ad expenses into a clean P&L table with tax-deductible notes.',
  },
  {
    id: 'haven',
    name: 'Haven',
    role: 'Customer Service Executive',
    description: 'Triages support tickets, resolves shipping or refund inquiries with policy clarity, and prepares escalation notes.',
    systemPrompt:
      'You are Haven, a calm Customer Service Executive. Triage support inquiries by urgency, write empathetic policy-aligned replies, propose fair resolutions (exchange, store credit, refund), and include concise internal escalation notes when needed.',
    samplePrompt: 'A customer received a delayed cross-border order after 12 days and asked for a refund. Draft a resolution reply.',
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'Business Development & Cross-Border Strategist',
    description: 'Builds supplier outreach briefs, evaluates cross-border expansion routes, and drafts partner proposals.',
    systemPrompt:
      'You are Scout, a Business Development Manager specializing in cross-border commerce (Global, China, ASEAN, Pakistan). Output practical market entry plans, supplier vetting checklists, wholesale outreach templates, and partner deal terms.',
    samplePrompt: 'Build a cross-border supplier vetting checklist and initial outreach email for Shenzhen electronics fulfillment.',
  },
];

export const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({
  theme,
  onLaunchTemplate,
  onLaunchCustomSandbox,
  onSendToMainChat,
}) => {
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'agents' | 'onemail' | 'commerce'>('agents');
  const [showBrandEditor, setShowBrandEditor] = useState(false);

  const [brandMemory, setBrandMemory] = useState<BrandMemory>(() => {
    try {
      const saved = localStorage.getItem('xer0byteBrandMemory');
      return saved ? { ...DEFAULT_BRAND, ...JSON.parse(saved) } : DEFAULT_BRAND;
    } catch {
      return DEFAULT_BRAND;
    }
  });

  useEffect(() => {
    localStorage.setItem('xer0byteBrandMemory', JSON.stringify(brandMemory));
  }, [brandMemory]);

  const [customAgents, setCustomAgents] = useState<CustomAgent[]>(() => {
    try {
      const saved = localStorage.getItem('xer0byteCustomAgents');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('xer0byteCustomAgents', JSON.stringify(customAgents));
  }, [customAgents]);

  const allAgents = [...BUILTIN_AGENTS, ...customAgents];
  const [selectedAgentId, setSelectedAgentId] = useState<string>('muse');
  const activeAgent = allAgents.find((a) => a.id === selectedAgentId) || allAgents[0];

  const [agentTaskInput, setAgentTaskInput] = useState('');
  const [agentAttachedText, setAgentAttachedText] = useState('');
  const [agentOutput, setAgentOutput] = useState('');
  const [isRunningAgent, setIsRunningAgent] = useState(false);

  const [approvalQueue, setApprovalQueue] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem('xer0byteApprovalQueue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('xer0byteApprovalQueue', JSON.stringify(approvalQueue.slice(0, 30)));
  }, [approvalQueue]);

  // Custom agent modal state
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({ name: '', role: '', description: '', systemPrompt: '' });

  // OneMAIL state
  const [rawInboxText, setRawInboxText] = useState('');
  const [triageFocus, setTriageFocus] = useState<'briefing' | 'replies' | 'actions'>('briefing');
  const [inboxOutput, setInboxOutput] = useState('');
  const [isTriaging, setIsTriaging] = useState(false);

  // Commerce Studio state
  const [templateCategory, setTemplateCategory] = useState<string>('All');
  const [productName, setProductName] = useState('');
  const [productSpecs, setProductSpecs] = useState('');
  const [targetLang, setTargetLang] = useState<'English' | 'English + Roman Urdu' | 'English + Chinese' | 'Arabic'>('English');
  const [productImage, setProductImage] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [listingOutput, setListingOutput] = useState('');
  const [isGeneratingListing, setIsGeneratingListing] = useState(false);

  // Unit Economics state
  const [calcPrice, setCalcPrice] = useState(49);
  const [calcCogs, setCalcCogs] = useState(14);
  const [calcShipping, setCalcShipping] = useState(6);
  const [calcFeePct, setCalcFeePct] = useState(3.2);
  const [calcCpa, setCalcCpa] = useState(11);

  const feeAmount = calcPrice * (calcFeePct / 100);
  const grossProfitBeforeAds = calcPrice - calcCogs - calcShipping - feeAmount;
  const netProfit = grossProfitBeforeAds - calcCpa;
  const netMarginPct = calcPrice > 0 ? (netProfit / calcPrice) * 100 : 0;
  const breakEvenRoas = grossProfitBeforeAds > 0 ? calcPrice / grossProfitBeforeAds : 0;

  const brandContextBlock = `ACTIVE BUSINESS MEMORY:
- Brand: ${brandMemory.brandName}
- Founder / Operator: ${brandMemory.founderName}
- Industry / Niche: ${brandMemory.niche}
- Primary Markets: ${brandMemory.market}
- Default Currency: ${brandMemory.currency}
- Brand Voice: ${brandMemory.tone}
- Core Offerings: ${brandMemory.productsOrServices}`;

  const handleRunAgent = async (overridePrompt?: string) => {
    const promptToRun = (overridePrompt ?? agentTaskInput).trim() || activeAgent.samplePrompt;
    if (!promptToRun || isRunningAgent) return;

    setIsRunningAgent(true);
    setAgentOutput('');

    try {
      const baseText = `${promptToRun}${agentAttachedText ? `\n\nATTACHED DATA / CONTEXT:\n${agentAttachedText}` : ''}`;
      const detectedUrls = extractUrlsFromText(baseText, 5);
      let urlContextAppend = '';
      if (detectedUrls.length > 0) {
        setAgentOutput(`Reading live data from ${detectedUrls.join(', ')}...`);
        const webResults = await fetchWebUrlsData(detectedUrls);
        urlContextAppend = formatWebUrlsForPrompt(webResults, { includeRawHtml: false, cloneMode: false });
        setAgentOutput('');
      }

      const fullPrompt = `${baseText}${urlContextAppend}`;
      const stream = await generateContentStreamWithRetry({
        model: 'gemini-4-hydrogen',
        systemInstruction: `${activeAgent.systemPrompt}\n\n${brandContextBlock}\n\nRules: Output high-signal, actionable business work. Use Markdown tables where structured comparison helps. Never fabricate fake client metrics or credentials.`,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        tools: detectedUrls.length > 0 ? [{ urlContext: {} }] : undefined,
      });

      let accumulated = '';
      for await (const chunk of stream) {
        if (chunk.text) {
          accumulated += chunk.text;
          setAgentOutput(accumulated);
        }
      }

      if (accumulated.trim()) {
        const newItem: QueueItem = {
          id: Date.now().toString(),
          agentName: activeAgent.name,
          agentRole: activeAgent.role,
          prompt: promptToRun,
          output: accumulated,
          status: 'pending',
          timestamp: Date.now(),
        };
        setApprovalQueue((prev) => [newItem, ...prev].slice(0, 30));
      }
    } catch (err: any) {
      setAgentOutput(`Error running agent: ${err?.message || 'Unable to connect to AI service.'}`);
    } finally {
      setIsRunningAgent(false);
    }
  };

  const handleAgentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setAgentAttachedText((prev) => (prev ? `${prev}\n\n--- ${file.name} ---\n${text.slice(0, 40000)}` : `--- ${file.name} ---\n${text.slice(0, 40000)}`));
  };

  const handleRunOneMail = async () => {
    if (!rawInboxText.trim() || isTriaging) return;
    setIsTriaging(true);
    setInboxOutput('');

    const focusPrompt =
      triageFocus === 'briefing'
        ? 'Classify every thread by intent (Urgent, Sales Lead, Support, Finance/Invoice, Low Priority), build a concise Priority Table, and provide an Executive Morning Briefing.'
        : triageFocus === 'replies'
        ? 'For each important email/message below, write a ready-to-send, crisp, polite reply aligned with the brand voice.'
        : 'Extract every concrete follow-up task, deadline, owner, and risk into an actionable checklist.';

    try {
      const stream = await generateContentStreamWithRetry({
        model: 'gemini-4-hydrogen',
        systemInstruction: `You are OneMAIL, an executive inbox triage & daily briefing AI agent.\n\n${brandContextBlock}\n\nFocus mode: ${focusPrompt}`,
        contents: [{ role: 'user', parts: [{ text: `RAW INBOX / MESSAGE THREADS:\n\n${rawInboxText}` }] }],
      });

      let accumulated = '';
      for await (const chunk of stream) {
        if (chunk.text) {
          accumulated += chunk.text;
          setInboxOutput(accumulated);
        }
      }
    } catch (err: any) {
      setInboxOutput(`Error triaging inbox: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsTriaging(false);
    }
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const b64 = res.includes(',') ? res.split(',')[1] : res;
      setProductImage({ data: b64, mimeType: file.type || 'image/png', name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateListing = async () => {
    if ((!productName.trim() && !productSpecs.trim() && !productImage) || isGeneratingListing) return;
    setIsGeneratingListing(true);
    setListingOutput('');

    try {
      const detectedUrls = extractUrlsFromText(`${productName} ${productSpecs}`, 3);
      let webContextBlock = '';
      if (detectedUrls.length > 0) {
        const webResults = await fetchWebUrlsData(detectedUrls);
        webContextBlock = formatWebUrlsForPrompt(webResults, { includeRawHtml: false, cloneMode: false });
      }

      const parts: any[] = [
        {
          text: `Product Name: ${productName || 'Analyze from attached image or link'}\nDetails / Audience / Price: ${productSpecs || 'Standard retail positioning'}${webContextBlock}\nTarget Localization: ${targetLang}\n\nGenerate a complete e-commerce launch pack:\n1. High-converting Shopify / Amazon Title (SEO + clarity)\n2. 5 Benefit-driven Bullet Points\n3. Answer-First Product Description + 3 GEO/FAQ questions\n4. 3 Meta / TikTok Ad Hooks + 1 Short UGC Video Script\n5. Clean JSON-LD Product Schema snippet ready for storefront deployment.`,
        },
      ];
      if (productImage) {
        parts.push({ inlineData: { data: productImage.data, mimeType: productImage.mimeType } });
      }

      const stream = await generateContentStreamWithRetry({
        model: 'gemini-4-hydrogen',
        systemInstruction: `You are an elite E-Commerce Merchandising, SEO/GEO, and Paid Acquisition AI.\n\n${brandContextBlock}\n\nWrite crisp, factual, conversion-oriented copy without fabricated claims or fake reviews.`,
        contents: [{ role: 'user', parts }],
        tools: detectedUrls.length > 0 ? [{ urlContext: {} }] : undefined,
      });

      let accumulated = '';
      for await (const chunk of stream) {
        if (chunk.text) {
          accumulated += chunk.text;
          setListingOutput(accumulated);
        }
      }
    } catch (err: any) {
      setListingOutput(`Error generating listing: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingListing(false);
    }
  };

  const handleCreateCustomAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentForm.name.trim() || !newAgentForm.role.trim()) return;
    const created: CustomAgent = {
      id: 'custom-' + Date.now(),
      name: newAgentForm.name.trim(),
      role: newAgentForm.role.trim(),
      description: newAgentForm.description.trim() || 'Custom autonomous workflow agent.',
      systemPrompt: newAgentForm.systemPrompt.trim() || `You are ${newAgentForm.name}, ${newAgentForm.role}. Deliver precise, practical outputs.`,
      samplePrompt: `Run primary workflow for ${newAgentForm.role}.`,
    };
    setCustomAgents((prev) => [...prev, created]);
    setSelectedAgentId(created.id);
    setNewAgentForm({ name: '', role: '', description: '', systemPrompt: '' });
    setShowNewAgentModal(false);
  };

  const filteredTemplates =
    templateCategory === 'All'
      ? STARTER_TEMPLATES
      : STARTER_TEMPLATES.filter((t) => t.category === templateCategory);

  const surfaceClass = isDark ? 'bg-[#0e0e0e] border-[#222] text-white' : 'bg-white border-neutral-200 text-neutral-900';
  const subSurfaceClass = isDark ? 'bg-[#141414] border-[#262626]' : 'bg-neutral-50 border-neutral-200';
  const inputClass = isDark
    ? 'bg-[#090909] border-[#282828] text-white placeholder-neutral-500 focus:border-[#00ff9d]'
    : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-black';

  return (
    <div className={`flex-1 flex flex-col h-full w-full overflow-y-auto pt-16 md:pt-8 pb-12 px-4 sm:px-6 md:px-10 ${isDark ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-900'}`}>
      <div className="w-full max-w-6xl mx-auto space-y-6">
        {/* Top Bar Contract */}
        <header className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b ${isDark ? 'border-[#222]' : 'border-neutral-200'}`}>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Business & AI Agent Studio</h1>
            <p className={`text-xs md:text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {brandMemory.brandName} · {brandMemory.market} · {brandMemory.currency}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Tab Switcher */}
            <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-[#111] border-[#252525]' : 'bg-neutral-100 border-neutral-200'}`}>
              <button
                onClick={() => setActiveTab('agents')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'agents'
                    ? isDark ? 'bg-white text-black' : 'bg-black text-white'
                    : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-black'
                }`}
              >
                <Bot size={14} /> Agent Team
              </button>
              <button
                onClick={() => setActiveTab('onemail')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'onemail'
                    ? isDark ? 'bg-white text-black' : 'bg-black text-white'
                    : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-black'
                }`}
              >
                <Mail size={14} /> OneMAIL Triage
              </button>
              <button
                onClick={() => setActiveTab('commerce')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'commerce'
                    ? isDark ? 'bg-white text-black' : 'bg-black text-white'
                    : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-black'
                }`}
              >
                <Store size={14} /> Storefront & SME Apps
              </button>
            </div>

            <button
              onClick={() => setShowBrandEditor(!showBrandEditor)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                showBrandEditor
                  ? 'border-[#00ff9d] text-[#00ff9d]'
                  : isDark ? 'border-[#282828] text-neutral-300 hover:border-neutral-600' : 'border-neutral-300 text-neutral-700 hover:border-black'
              }`}
            >
              <Sliders size={14} /> Brand Memory
            </button>
          </div>
        </header>

        {/* Persistent Brand Memory Drawer */}
        {showBrandEditor && (
          <section className={`rounded-xl border p-5 space-y-4 ${surfaceClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">Shared Business Memory</h2>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Saved automatically across every agent, OneMAIL draft, and Storefront generator.
                </p>
              </div>
              <button onClick={() => setShowBrandEditor(false)} className="p-1 opacity-60 hover:opacity-100">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-medium mb-1 opacity-70">Brand / Store Name</label>
                <input
                  value={brandMemory.brandName}
                  onChange={(e) => setBrandMemory({ ...brandMemory, brandName: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`}
                />
              </div>
              <div>
                <label className="block font-medium mb-1 opacity-70">Founder / Operator</label>
                <input
                  value={brandMemory.founderName}
                  onChange={(e) => setBrandMemory({ ...brandMemory, founderName: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`}
                />
              </div>
              <div>
                <label className="block font-medium mb-1 opacity-70">Target Markets</label>
                <input
                  value={brandMemory.market}
                  onChange={(e) => setBrandMemory({ ...brandMemory, market: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`}
                />
              </div>
              <div>
                <label className="block font-medium mb-1 opacity-70">Currency</label>
                <input
                  value={brandMemory.currency}
                  onChange={(e) => setBrandMemory({ ...brandMemory, currency: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`}
                />
              </div>
              <div>
                <label className="block font-medium mb-1 opacity-70">Industry / Niche</label>
                <input
                  value={brandMemory.niche}
                  onChange={(e) => setBrandMemory({ ...brandMemory, niche: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`}
                />
              </div>
              <div>
                <label className="block font-medium mb-1 opacity-70">Brand Tone</label>
                <input
                  value={brandMemory.tone}
                  onChange={(e) => setBrandMemory({ ...brandMemory, tone: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`}
                />
              </div>
            </div>
            <div className="text-xs">
              <label className="block font-medium mb-1 opacity-70">Core Products / Services</label>
              <input
                value={brandMemory.productsOrServices}
                onChange={(e) => setBrandMemory({ ...brandMemory, productsOrServices: e.target.value })}
                className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`}
              />
            </div>
          </section>
        )}

        {/* TAB 1: ROLE-BASED AI AGENTS + APPROVAL QUEUE */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Agent Selector List */}
            <aside className={`lg:col-span-4 rounded-xl border p-4 space-y-3 ${surfaceClass}`}>
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800/40">
                <h2 className="text-sm font-bold">Role-Based Agents</h2>
                <button
                  onClick={() => setShowNewAgentModal(true)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border ${isDark ? 'border-[#333] hover:border-[#00ff9d] text-[#00ff9d]' : 'border-neutral-300 hover:border-black'}`}
                >
                  <Plus size={12} /> Custom
                </button>
              </div>
              <div className="space-y-2">
                {allAgents.map((agent) => {
                  const selected = agent.id === activeAgent.id;
                  return (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selected
                          ? isDark
                            ? 'bg-[#191919] border-[#00ff9d]/70'
                            : 'bg-neutral-100 border-black'
                          : isDark
                          ? 'bg-[#0b0b0b] border-[#202020] hover:border-[#383838]'
                          : 'bg-white border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">{agent.name}</span>
                        {agent.id.startsWith('custom-') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomAgents((prev) => prev.filter((c) => c.id !== agent.id));
                            }}
                            className="text-neutral-500 hover:text-red-500"
                            title="Remove custom agent"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{agent.role}</div>
                      <p className={`text-xs mt-1.5 line-clamp-2 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                        {agent.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Right Agent Execution Console & Human-in-the-Loop Queue */}
            <section className="lg:col-span-8 space-y-6">
              <div className={`rounded-xl border p-5 space-y-4 ${surfaceClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">
                      {activeAgent.name} — {activeAgent.role}
                    </h2>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{activeAgent.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      setAgentTaskInput(activeAgent.samplePrompt);
                      handleRunAgent(activeAgent.samplePrompt);
                    }}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${isDark ? 'border-[#333] text-neutral-300 hover:border-white' : 'border-neutral-300 text-neutral-700 hover:border-black'}`}
                  >
                    Run Sample Task
                  </button>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={agentTaskInput}
                    onChange={(e) => setAgentTaskInput(e.target.value)}
                    placeholder={`Assign a task to ${activeAgent.name} (e.g. "${activeAgent.samplePrompt}")`}
                    className={`w-full rounded-lg border p-3 text-sm min-h-[96px] outline-none resize-y ${inputClass}`}
                  />
                  {agentAttachedText && (
                    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${subSurfaceClass}`}>
                      <span className="truncate">Context file attached ({agentAttachedText.length.toLocaleString()} chars)</span>
                      <button onClick={() => setAgentAttachedText('')} className="text-red-500 font-medium ml-2">
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${isDark ? 'border-[#2c2c2c] text-neutral-300 hover:border-neutral-500' : 'border-neutral-300 text-neutral-700 hover:border-black'}`}>
                      <FileUp size={14} /> Attach CSV / Log / Brief
                      <input type="file" accept=".csv,.txt,.json,.md,.log" onChange={handleAgentFileUpload} className="hidden" />
                    </label>
                    <button
                      onClick={() => handleRunAgent()}
                      disabled={isRunningAgent}
                      className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-colors ${
                        isDark ? 'bg-[#00ff9d] text-black hover:bg-white' : 'bg-black text-white hover:bg-neutral-800'
                      } disabled:opacity-50`}
                    >
                      {isRunningAgent ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                      {isRunningAgent ? 'Executing...' : `Run ${activeAgent.name}`}
                    </button>
                  </div>
                </div>

                {agentOutput && (
                  <div className={`rounded-lg border p-4 space-y-3 ${subSurfaceClass}`}>
                    <div className="flex items-center justify-between border-b border-neutral-800/40 pb-2">
                      <span className="text-xs font-semibold">Latest Agent Draft</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(agentOutput)}
                          className="text-xs flex items-center gap-1 opacity-75 hover:opacity-100"
                        >
                          <Copy size={12} /> Copy
                        </button>
                        <button
                          onClick={() => downloadTextFile(`${activeAgent.name.toLowerCase()}_output.md`, agentOutput)}
                          className="text-xs flex items-center gap-1 opacity-75 hover:opacity-100"
                        >
                          <Download size={12} /> Export
                        </button>
                        <button
                          onClick={() => onSendToMainChat(`Continue refining this draft from ${activeAgent.name} (${activeAgent.role}):\n\n${agentOutput}`)}
                          className="text-xs flex items-center gap-1 text-[#00ff9d] hover:underline"
                        >
                          Open in Chat <ArrowUpRight size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed overflow-x-auto">
                      <Markdown remarkPlugins={[remarkGfm]}>{agentOutput}</Markdown>
                    </div>
                  </div>
                )}
              </div>

              {/* Human-in-the-Loop Approval Queue */}
              <div className={`rounded-xl border p-5 space-y-4 ${surfaceClass}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold">Human-in-the-Loop Approval Queue</h3>
                    <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      Review agent deliverables before publishing or exporting externally.
                    </p>
                  </div>
                  {approvalQueue.length > 0 && (
                    <button
                      onClick={() => setApprovalQueue([])}
                      className="text-xs text-neutral-500 hover:text-red-500"
                    >
                      Clear Queue
                    </button>
                  )}
                </div>

                {approvalQueue.length === 0 ? (
                  <div className={`text-center py-8 rounded-lg border text-xs ${subSurfaceClass} ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    No queued deliverables yet. Run an agent task above to generate a draft for review.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvalQueue.slice(0, 6).map((item) => (
                      <div key={item.id} className={`rounded-lg border p-3.5 space-y-2 ${subSurfaceClass}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{item.agentName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="opacity-70">{item.agentRole}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums opacity-60">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <span
                            className={`font-semibold ${
                              item.status === 'approved'
                                ? 'text-emerald-500'
                                : item.status === 'rejected'
                                ? 'text-red-500'
                                : 'text-amber-500'
                            }`}
                          >
                            {item.status === 'approved' ? 'Approved' : item.status === 'rejected' ? 'Revision Needed' : 'Pending Review'}
                          </span>
                        </div>
                        <p className="text-xs opacity-80 line-clamp-2">{item.prompt}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() =>
                              setApprovalQueue((prev) =>
                                prev.map((q) => (q.id === item.id ? { ...q, status: 'approved' } : q))
                              )
                            }
                            className="px-2.5 py-1 rounded border border-emerald-600/40 text-emerald-500 text-xs font-medium hover:bg-emerald-500/10 flex items-center gap-1"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={() =>
                              setApprovalQueue((prev) =>
                                prev.map((q) => (q.id === item.id ? { ...q, status: 'rejected' } : q))
                              )
                            }
                            className="px-2.5 py-1 rounded border border-neutral-600/40 text-xs font-medium opacity-80 hover:opacity-100"
                          >
                            Mark Revision
                          </button>
                          <button
                            onClick={() => copyToClipboard(item.output)}
                            className="px-2.5 py-1 rounded border border-neutral-600/40 text-xs font-medium opacity-80 hover:opacity-100"
                          >
                            Copy Output
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: ONEMAIL AI INBOX & BRIEFING */}
        {activeTab === 'onemail' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className={`lg:col-span-5 rounded-xl border p-5 space-y-4 ${surfaceClass}`}>
              <div>
                <h2 className="text-lg font-bold">OneMAIL AI Inbox Triage</h2>
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Paste customer emails, supplier quotes, WhatsApp threads, or import an `.eml`/`.txt` file to classify intent, extract tasks, and draft replies.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'briefing', label: 'Daily Briefing & Intent' },
                  { id: 'replies', label: 'Draft All Replies' },
                  { id: 'actions', label: 'Action Checklist' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setTriageFocus(mode.id as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      triageFocus === mode.id
                        ? isDark ? 'bg-white text-black border-white' : 'bg-black text-white border-black'
                        : isDark ? 'border-[#2c2c2c] text-neutral-400 hover:text-white' : 'border-neutral-300 text-neutral-600'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <textarea
                value={rawInboxText}
                onChange={(e) => setRawInboxText(e.target.value)}
                placeholder="Paste 1 or multiple raw emails / messages here..."
                className={`w-full rounded-lg border p-3 text-sm min-h-[240px] outline-none ${inputClass}`}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${isDark ? 'border-[#2c2c2c] text-neutral-300' : 'border-neutral-300 text-neutral-700'}`}>
                    <FileUp size={14} /> Import File
                    <input
                      type="file"
                      accept=".txt,.eml,.csv,.md"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) setRawInboxText(await f.text());
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() =>
                      setRawInboxText(
                        `From: ali.khan@retailpk.com\nSubject: Bulk POS Quote Request\nHi Xer0byte team, we operate 4 cafes in Lahore and need a custom POS + Inventory tracker integrated. Budget around $2,500. Can we schedule a call Thursday?\n\n---\nFrom: billing@cloudhost.io\nSubject: Invoice #9921 Due in 3 Days\nYour monthly cluster renewal ($148.00) processes automatically on Nov 17.\n\n---\nFrom: sara.lin@aseanimports.sg\nSubject: Order #4412 Damaged Packaging\nOne thermal printer arrived with cracked housing. Please advise on replacement.`
                      )
                    }
                    className="text-xs underline opacity-70 hover:opacity-100"
                  >
                    Load Sample
                  </button>
                </div>

                <button
                  onClick={handleRunOneMail}
                  disabled={!rawInboxText.trim() || isTriaging}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold ${
                    isDark ? 'bg-[#00ff9d] text-black hover:bg-white' : 'bg-black text-white hover:bg-neutral-800'
                  } disabled:opacity-50`}
                >
                  {isTriaging ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {isTriaging ? 'Triaging...' : 'Triage & Brief'}
                </button>
              </div>
            </div>

            <div className={`lg:col-span-7 rounded-xl border p-5 space-y-4 min-h-[380px] ${surfaceClass}`}>
              <div className="flex items-center justify-between border-b border-neutral-800/40 pb-3">
                <h3 className="text-sm font-bold">Executive Briefing & Drafts</h3>
                {inboxOutput && (
                  <div className="flex items-center gap-3">
                    <button onClick={() => copyToClipboard(inboxOutput)} className="text-xs flex items-center gap-1 opacity-75 hover:opacity-100">
                      <Copy size={12} /> Copy All
                    </button>
                    <button
                      onClick={() => downloadTextFile('onemail_briefing.md', inboxOutput)}
                      className="text-xs flex items-center gap-1 opacity-75 hover:opacity-100"
                    >
                      <Download size={12} /> Export
                    </button>
                  </div>
                )}
              </div>
              {inboxOutput ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed overflow-x-auto">
                  <Markdown remarkPlugins={[remarkGfm]}>{inboxOutput}</Markdown>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center opacity-50 text-xs max-w-sm mx-auto">
                  <Mail size={32} className="mb-3" />
                  <p>Paste incoming emails on the left and click Triage & Brief to classify leads, spot urgent support tickets, and prepare instant replies.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STOREFRONT TEMPLATES, PRODUCT STUDIO & UNIT ECONOMICS */}
        {activeTab === 'commerce' && (
          <div className="space-y-8">
            {/* SME & Storefront One-Click Templates */}
            <section className={`rounded-xl border p-5 space-y-4 ${surfaceClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">One-Click SME & Storefront Apps</h2>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Launch live working storefronts, POS terminals, CRM pipelines, or invoicing apps directly in Neural Sandbox IDE.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['All', 'Commerce', 'Operations', 'Finance', 'Customer', 'Developer'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setTemplateCategory(cat)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                        templateCategory === cat
                          ? isDark ? 'bg-white text-black border-white font-semibold' : 'bg-black text-white border-black font-semibold'
                          : isDark ? 'border-[#262626] text-neutral-400 hover:text-white' : 'border-neutral-200 text-neutral-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((tpl) => (
                  <div key={tpl.id} className={`rounded-lg border p-4 flex flex-col justify-between gap-4 ${subSurfaceClass}`}>
                    <div>
                      <div className={`text-xs mb-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{tpl.category}</div>
                      <h3 className="font-semibold text-sm">{tpl.title}</h3>
                      <p className={`text-xs mt-1.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{tpl.description}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/30">
                      <button
                        onClick={() => onLaunchTemplate(tpl)}
                        className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${
                          isDark ? 'bg-[#00ff9d] text-black hover:bg-white' : 'bg-black text-white hover:bg-neutral-800'
                        }`}
                      >
                        Launch Live App
                      </button>
                      <button
                        onClick={() => onLaunchCustomSandbox(`Build a customized ${tpl.title} tailored for ${brandMemory.brandName} (${brandMemory.niche}, currency ${brandMemory.currency}).`)}
                        className={`px-3 py-2 rounded-md border text-xs font-medium ${isDark ? 'border-[#333] hover:border-white' : 'border-neutral-300 hover:border-black'}`}
                        title="Generate bespoke AI version in Sandbox"
                      >
                        AI Custom
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Split Section: Product Listing / Ad Copy Studio + Unit Economics Calculator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Product Listing & Ad Generator */}
              <div className={`lg:col-span-7 rounded-xl border p-5 space-y-4 ${surfaceClass}`}>
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Sparkles size={16} className="text-[#00ff9d]" /> Product Listing, SEO/GEO & Ad Studio
                  </h2>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Upload a product photo or enter specs to generate Shopify/Amazon copy, Schema JSON-LD, and Meta/TikTok ad scripts.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Product Name (e.g. Aluminum USB-C Dock)"
                    className={`rounded-lg border px-3 py-2.5 outline-none ${inputClass}`}
                  />
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value as any)}
                    className={`rounded-lg border px-3 py-2.5 outline-none ${inputClass}`}
                  >
                    <option value="English">English</option>
                    <option value="English + Roman Urdu">English + Roman Urdu</option>
                    <option value="English + Chinese">English + Chinese (Cross-Border)</option>
                    <option value="Arabic">Arabic + English</option>
                  </select>
                </div>

                <textarea
                  value={productSpecs}
                  onChange={(e) => setProductSpecs(e.target.value)}
                  placeholder="Key specs, price point, materials, target customer, or pain points solved..."
                  className={`w-full rounded-lg border p-3 text-xs min-h-[90px] outline-none ${inputClass}`}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${isDark ? 'border-[#2c2c2c]' : 'border-neutral-300'}`}>
                    <FileUp size={14} /> {productImage ? productImage.name : 'Upload Product Photo (Optional)'}
                    <input type="file" accept="image/*" onChange={handleProductImageUpload} className="hidden" />
                  </label>
                  <button
                    onClick={handleGenerateListing}
                    disabled={isGeneratingListing}
                    className={`px-5 py-2 rounded-lg text-xs font-bold ${isDark ? 'bg-[#00ff9d] text-black hover:bg-white' : 'bg-black text-white hover:bg-neutral-800'} disabled:opacity-50`}
                  >
                    {isGeneratingListing ? 'Generating Pack...' : 'Generate Launch Copy'}
                  </button>
                </div>

                {listingOutput && (
                  <div className={`rounded-lg border p-4 space-y-2 ${subSurfaceClass}`}>
                    <div className="flex justify-between items-center border-b border-neutral-800/40 pb-2 text-xs">
                      <span className="font-semibold">Conversion & Schema Pack</span>
                      <button onClick={() => copyToClipboard(listingOutput)} className="flex items-center gap-1 opacity-75 hover:opacity-100">
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed overflow-x-auto">
                      <Markdown remarkPlugins={[remarkGfm]}>{listingOutput}</Markdown>
                    </div>
                  </div>
                )}
              </div>

              {/* Unit Economics & Profit Calculator */}
              <div className={`lg:col-span-5 rounded-xl border p-5 space-y-4 ${surfaceClass}`}>
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Calculator size={16} className="text-[#00ff9d]" /> Unit Economics & ROAS Calculator
                  </h2>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Verify real net margin and break-even ad ROAS before launching campaigns.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block opacity-70 mb-1">Selling Price ({brandMemory.currency})</label>
                    <input type="number" value={calcPrice} onChange={(e) => setCalcPrice(Number(e.target.value) || 0)} className={`w-full rounded-lg border px-3 py-2 tabular-nums outline-none ${inputClass}`} />
                  </div>
                  <div>
                    <label className="block opacity-70 mb-1">Product COGS</label>
                    <input type="number" value={calcCogs} onChange={(e) => setCalcCogs(Number(e.target.value) || 0)} className={`w-full rounded-lg border px-3 py-2 tabular-nums outline-none ${inputClass}`} />
                  </div>
                  <div>
                    <label className="block opacity-70 mb-1">Shipping / Fulfillment</label>
                    <input type="number" value={calcShipping} onChange={(e) => setCalcShipping(Number(e.target.value) || 0)} className={`w-full rounded-lg border px-3 py-2 tabular-nums outline-none ${inputClass}`} />
                  </div>
                  <div>
                    <label className="block opacity-70 mb-1">Gateway / Platform Fee (%)</label>
                    <input type="number" step="0.1" value={calcFeePct} onChange={(e) => setCalcFeePct(Number(e.target.value) || 0)} className={`w-full rounded-lg border px-3 py-2 tabular-nums outline-none ${inputClass}`} />
                  </div>
                  <div className="col-span-2">
                    <label className="block opacity-70 mb-1">Estimated Ad Cost per Order (CPA)</label>
                    <input type="number" value={calcCpa} onChange={(e) => setCalcCpa(Number(e.target.value) || 0)} className={`w-full rounded-lg border px-3 py-2 tabular-nums outline-none ${inputClass}`} />
                  </div>
                </div>

                <div className={`rounded-lg border p-4 grid grid-cols-3 gap-3 text-center ${subSurfaceClass}`}>
                  <div>
                    <div className="text-[11px] opacity-60">Net Profit</div>
                    <div className={`text-base font-bold tabular-nums mt-0.5 ${netProfit >= 0 ? 'text-[#00ff9d]' : 'text-red-500'}`}>
                      {netProfit.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] opacity-60">Net Margin</div>
                    <div className={`text-base font-bold tabular-nums mt-0.5 ${netMarginPct >= 15 ? (isDark ? 'text-white' : 'text-neutral-900') : 'text-amber-500'}`}>
                      {netMarginPct.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] opacity-60">Break-Even ROAS</div>
                    <div className="text-base font-bold tabular-nums mt-0.5">
                      {breakEvenRoas > 0 ? `${breakEvenRoas.toFixed(2)}x` : 'N/A'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    onSendToMainChat(
                      `Analyze these e-commerce unit economics for ${brandMemory.brandName} (${brandMemory.currency}): Selling Price ${calcPrice}, COGS ${calcCogs}, Shipping ${calcShipping}, Payment Fee ${calcFeePct}%, Ad CPA ${calcCpa}. Current Net Profit is ${netProfit.toFixed(2)} (${netMarginPct.toFixed(1)}% margin, Break-even ROAS ${breakEvenRoas.toFixed(2)}x). Suggest concrete bundle pricing, upsell offers, and CPA targets to improve profitability.`
                    )
                  }
                  className={`w-full py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                    isDark ? 'border-[#333] hover:border-[#00ff9d] text-[#00ff9d]' : 'border-neutral-300 hover:border-black'
                  }`}
                >
                  Ask AI Strategy to Optimize Margin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Custom Agent Modal */}
      {showNewAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form onSubmit={handleCreateCustomAgent} className={`w-full max-w-md rounded-xl border p-6 space-y-4 ${surfaceClass}`}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold">Create Custom Role Agent</h3>
              <button type="button" onClick={() => setShowNewAgentModal(false)} className="opacity-60 hover:opacity-100">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Agent Name</label>
                <input required value={newAgentForm.name} onChange={(e) => setNewAgentForm({ ...newAgentForm, name: e.target.value })} placeholder="e.g. Atlas" className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`} />
              </div>
              <div>
                <label className="block font-medium mb-1">Role Title</label>
                <input required value={newAgentForm.role} onChange={(e) => setNewAgentForm({ ...newAgentForm, role: e.target.value })} placeholder="e.g. Supply Chain Coordinator" className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`} />
              </div>
              <div>
                <label className="block font-medium mb-1">Short Description</label>
                <input value={newAgentForm.description} onChange={(e) => setNewAgentForm({ ...newAgentForm, description: e.target.value })} placeholder="What workflows does this agent own?" className={`w-full rounded-lg border px-3 py-2 outline-none ${inputClass}`} />
              </div>
              <div>
                <label className="block font-medium mb-1">System Instructions</label>
                <textarea value={newAgentForm.systemPrompt} onChange={(e) => setNewAgentForm({ ...newAgentForm, systemPrompt: e.target.value })} placeholder="Rules, tone, and output structure..." className={`w-full rounded-lg border p-3 min-h-[90px] outline-none ${inputClass}`} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowNewAgentModal(false)} className="px-4 py-2 rounded-lg border border-neutral-600/40 text-xs font-medium">Cancel</button>
              <button type="submit" className={`px-4 py-2 rounded-lg text-xs font-bold ${isDark ? 'bg-[#00ff9d] text-black' : 'bg-black text-white'}`}>Save Agent</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
