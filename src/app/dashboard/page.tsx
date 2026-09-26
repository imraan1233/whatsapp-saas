'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardHome() {
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedTier, setSelectedTier] = useState<'starter' | 'pro' | 'enterprise' | null>(null);
  
  const [agentName, setAgentName] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [greetingMsg, setGreetingMsg] = useState('');
  const [kbText, setKbText] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [hasAnyAgent, setHasAnyAgent] = useState(false);
  
  const [editAgent, setEditAgent] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [chatAgent, setChatAgent] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [kbAgent, setKbAgent] = useState<any>(null);
  const [editKbText, setEditKbText] = useState('');
  const [isKbSaving, setIsKbSaving] = useState(false);

  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{role: string, content: string}[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState(0);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUser(user);
    };
    getUser();
  }, []);

  useEffect(() => { if (user) fetchAgents(); }, [user]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiChatMessages]);

  const fetchAgents = async () => {
    const { data } = await supabase.from('agents').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) { setAgents(data); setHasAnyAgent(data.length > 0); }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) return; 
    if (!user || !selectedTier) return;
    if (hasAnyAgent) { alert('⚠️ You already have an agent. Please delete it first.'); return; }

    setIsLoading(true);
    setLoadingStatus('Creating agent...');

    const daysToAdd = selectedTier === 'starter' ? 3 : 7;
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + daysToAdd);

    const finalGreeting = greetingMsg || `Hello! I am ${agentName}. How can I help you today?`;

    const { data: newAgent, error } = await supabase.from('agents').insert([{
      user_id: user.id, name: agentName, system_prompt: agentPrompt,
      greeting_message: finalGreeting,
      tier: selectedTier, trial_ends_at: trialEndDate.toISOString(),
    }]).select().single();

    if (error) {
      alert('Error creating agent: ' + error.message);
    } else if (newAgent) {
      let scrapedContent = '';
      if (selectedTier === 'enterprise' && websiteUrl) {
        setLoadingStatus('🕷️ Scraping website content...');
        try {
          const scrapeRes = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: websiteUrl }) });
          const scrapeData = await scrapeRes.json();
          scrapedContent = scrapeData.text || '';
        } catch (err) { console.error('Scrape failed', err); }
      }

      if (selectedTier === 'pro' || selectedTier === 'enterprise') {
        await supabase.from('knowledge_bases').insert([{
          agent_id: newAgent.id, manual_text: kbText,
          website_url: selectedTier === 'enterprise' ? websiteUrl : null,
          scraped_text: scrapedContent,
        }]);
      }

      setAgentName(''); setAgentPrompt(''); setGreetingMsg(''); setKbText(''); setWebsiteUrl(''); setSelectedTier(null);
      setLoadingStatus('');
      fetchAgents();
    }
    setIsLoading(false);
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAgent) return;
    setIsLoading(true);
    
    const finalGreeting = greetingMsg || `Hello! I am ${agentName}. How can I help you today?`;

    const { error } = await supabase.from('agents').update({ name: agentName, system_prompt: agentPrompt, greeting_message: finalGreeting, tier: selectedTier }).eq('id', editAgent.id);

    if (error) { alert('Error updating agent: ' + error.message); } 
    else {
      if (selectedTier === 'pro' || selectedTier === 'enterprise') {
        const { data: existingKb } = await supabase.from('knowledge_bases').select('id').eq('agent_id', editAgent.id).single();
        if (existingKb) {
          await supabase.from('knowledge_bases').update({ manual_text: kbText, website_url: selectedTier === 'enterprise' ? websiteUrl : null }).eq('id', existingKb.id);
        } else {
          await supabase.from('knowledge_bases').insert([{ agent_id: editAgent.id, manual_text: kbText, website_url: selectedTier === 'enterprise' ? websiteUrl : null }]);
        }
      }
      alert('✅ Agent updated successfully!');
      closeEditAgent();
      fetchAgents();
    }
    setIsLoading(false);
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    await supabase.from('knowledge_bases').delete().eq('agent_id', agentId);
    await supabase.from('knowledge_chunks').delete().eq('agent_id', agentId);
    await supabase.from('conversations').delete().eq('agent_id', agentId);
    await supabase.from('messages').delete().eq('agent_id', agentId);
    await supabase.from('agents').delete().eq('id', agentId);
    fetchAgents();
  };

  const openChat = (agent: any) => {
    setChatAgent(agent);
    setChatMessages([{ role: 'assistant', content: agent.greeting_message || `Hello! I am ${agent.name}.` }]);
    setChatInput('');
  };
  const closeChat = () => { setChatAgent(null); setChatMessages([]); };

  // --- THIS IS THE SINGLE, CORRECT LINK RENDERER ---
  const renderMessage = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return (
      <>
        {parts.map((part, i) => {
          if (part.match(urlRegex)) {
            const cleanUrl = part.replace(/[.,;:!?]+$/, ''); 
            return (
              <a key={i} href={cleanUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium break-all">
                {cleanUrl}
              </a>
            );
          }
          return part;
        })}
      </>
    );
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !chatAgent) return;
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: chatAgent.id, message: userMessage, chatHistory: chatMessages }) });
      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]); }
    setIsChatLoading(false);
  };

  const openKb = async (agent: any) => {
    setKbAgent(agent);
    const { data } = await supabase.from('knowledge_bases').select('*').eq('agent_id', agent.id).single();
    setEditKbText(data?.manual_text || '');
  };
  const closeKb = () => { setKbAgent(null); setEditKbText(''); };
  const saveKb = async () => {
    setIsKbSaving(true);
    await supabase.from('knowledge_bases').upsert({ agent_id: kbAgent.id, manual_text: editKbText });
    alert('✅ Knowledge Base Saved!'); closeKb(); setIsKbSaving(false);
  };

  const openEditAgent = (agent: any) => {
    setEditAgent(agent); setIsEditing(true); setSelectedTier(agent.tier);
    setAgentName(agent.name); setAgentPrompt(agent.system_prompt); setGreetingMsg(agent.greeting_message || '');
    setKbText(''); setWebsiteUrl('');
    if (agent.tier === 'pro' || agent.tier === 'enterprise') {
      supabase.from('knowledge_bases').select('*').eq('agent_id', agent.id).single().then(({ data }) => {
        if (data) { setKbText(data.manual_text || ''); setWebsiteUrl(data.website_url || ''); }
      });
    }
    setTimeout(() => { document.getElementById('create-form')?.scrollIntoView({ behavior: 'smooth' }); }, 100);
  };

  const closeEditAgent = () => {
    setEditAgent(null); setIsEditing(false); setAgentName(''); setAgentPrompt(''); setGreetingMsg(''); setKbText(''); setWebsiteUrl(''); setSelectedTier(null);
  };

  const openAiAssistant = () => {
    setShowAiAssistant(true); setAiStep(0);
    setAiChatMessages([{ role: 'assistant', content: "👋 Hi! I'm your AI Setup Assistant. I'll help you create the perfect agent in just a few questions. Type 'OK' to get started!" }]);
    setAiInput('');
  };
  const closeAiAssistant = () => { setShowAiAssistant(false); setAiChatMessages([]); setAiStep(0); };

  const sendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || !selectedTier) return;
    const userMessage = aiInput.trim();
    setAiChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiInput('');
    setIsAiLoading(true);

    const currentAnswers = [...aiChatMessages.filter(m => m.role === 'user').map(m => m.content), userMessage];

    try {
      const response = await fetch('/api/ai-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMessage, step: aiStep, tier: selectedTier, previousAnswers: currentAnswers }) });
      const data = await response.json();

      if (data.done) {
        setAgentName(data.agentName || '');
        setAgentPrompt(data.systemPrompt || '');
        setGreetingMsg(data.greetingMessage || '');
        setKbText(data.knowledgeBase || '');
        setWebsiteUrl(data.websiteUrl || '');
        setAiChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        setTimeout(() => { closeAiAssistant(); document.getElementById('create-form')?.scrollIntoView({ behavior: 'smooth' }); }, 1500);
      } else {
        setAiChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        setAiStep(data.nextStep || aiStep + 1);
      }
    } catch (error) { setAiChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]); }
    setIsAiLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.email}!</h1>
        <p className="text-gray-400 text-lg font-bold">Manage and test your AI WhatsApp Assistants.</p>
      </div>

      {agents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Your Active Agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col justify-between relative">
                <button onClick={() => deleteAgent(agent.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-all" title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
                <div>
                  <div className="flex justify-between items-start mb-2 pr-8">
                    <h3 className="text-lg font-bold text-gray-900">{agent.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold text-right ${agent.tier === 'starter' ? 'bg-gray-100 text-gray-700' : agent.tier === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {agent.tier === 'starter' ? 'AI Agent' : agent.tier === 'pro' ? 'AI Agent + Knowledge Base' : 'AI Agent + Knowledge Base + Website'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">{agent.system_prompt}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openChat(agent)} className="flex-1 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold transition-all text-sm">💬 Test</button>
                  {(agent.tier === 'pro' || agent.tier === 'enterprise') && ( <button onClick={() => openKb(agent)} className="flex-1 py-2 rounded-xl bg-[#E5C158] hover:bg-[#d4b045] text-gray-900 font-semibold transition-all text-sm">📚 Knowledge</button> )}
                  <button onClick={() => openEditAgent(agent)} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all text-sm">✏️ Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {chatAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#25D366] rounded-t-2xl">
              <div><h3 className="text-white font-bold text-lg">{chatAgent.name}</h3><p className="text-green-100 text-xs">Online</p></div>
              <button onClick={closeChat} className="text-white hover:bg-white/20 rounded-full p-2">✕</button>
            </div>
            
            {/* CHAT MESSAGES WITH RENDER MESSAGE APPLIED */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#25D366] text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                    {renderMessage(msg.content)}
                  </div>
                </div>
              ))}
              {isChatLoading && <div className="flex justify-start"><div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm"><div className="flex space-x-1"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div></div></div></div>}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 bg-white rounded-b-2xl flex gap-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none" disabled={isChatLoading} />
              <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="p-2 rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></button>
            </form>
          </div>
        </div>
      )}

      {kbAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col h-[500px]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#E5C158] rounded-t-2xl">
              <div><h3 className="text-gray-900 font-bold text-lg">📚 {kbAgent.name} Knowledge</h3></div>
              <button onClick={closeKb} className="text-gray-900 hover:bg-black/10 rounded-full p-2">✕</button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto"> <textarea value={editKbText} onChange={(e) => setEditKbText(e.target.value)} className="w-full h-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#E5C158] outline-none resize-none text-gray-800" /> </div>
            <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl flex justify-end"> <button onClick={saveKb} disabled={isKbSaving} className="px-6 py-2 rounded-xl bg-[#E5C158] hover:bg-[#d4b045] text-gray-900 font-bold transition-all disabled:opacity-50">{isKbSaving ? 'Saving...' : 'Save Knowledge'}</button> </div>
          </div>
        </div>
      )}

      {showAiAssistant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col h-[650px]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-2xl">
              <div><h3 className="text-white font-bold text-lg">🤖 AI Setup Assistant</h3><p className="text-purple-100 text-xs">I'll fill the form for you!</p></div>
              <button onClick={closeAiAssistant} className="text-white hover:bg-white/20 rounded-full p-2">✕</button>
            </div>
            <div className="p-3 bg-purple-50 border-b border-purple-100"> <div className="flex items-start gap-2"><div className="text-purple-600 text-lg">💡</div><div className="text-xs text-purple-900"><p className="font-bold mb-1">How it works:</p><p>1. I'll ask you 3-4 simple questions</p><p>2. You answer in plain English</p><p>3. I'll auto-fill all the form fields for you!</p></div></div> </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {aiChatMessages.map((msg, idx) => ( <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}> <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>{msg.content}</div> </div> ))}
              {isAiLoading && <div className="flex justify-start"><div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm"><div className="flex space-x-1"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div></div></div></div>}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendAiMessage} className="p-4 border-t border-gray-200 bg-white rounded-b-2xl flex gap-2">
              <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Type your answer..." className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none" disabled={isAiLoading} />
              <button type="submit" disabled={isAiLoading || !aiInput.trim()} className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></button>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4 pt-6 border-t border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">{isEditing ? 'Edit Your Agent' : 'Create a New Agent'}</h2>
        {hasAnyAgent && !isEditing && ( <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-sm font-medium">⚠️ You already have an active agent. Delete it first to create a new one.</div> )}
        {!isEditing && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button type="button" onClick={() => hasAnyAgent ? alert('⚠️ Delete your existing agent first.') : setSelectedTier('starter')} disabled={hasAnyAgent} className={`p-6 rounded-2xl border-2 text-left transition-all ${selectedTier === 'starter' ? 'border-gray-900 bg-gray-50 shadow-lg' : hasAnyAgent ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="text-xl font-bold text-gray-900 mb-1">Starter</div><div className="text-gray-500 font-bold mb-3 text-sm">Basic AI Agent</div>
              <ul className="text-gray-400 text-xs space-y-1 mb-3"><li>✓ Custom personality</li><li>✓ WhatsApp integration</li><li>✓ 3-day free trial</li><li>✗ No knowledge base</li><li>✗ No website scraping</li></ul>
              {hasAnyAgent && <p className="text-red-500 text-xs font-bold">✓ Agent Active</p>}
            </button>
            <button type="button" onClick={() => hasAnyAgent ? alert('⚠️ Delete your existing agent first.') : setSelectedTier('pro')} disabled={hasAnyAgent} className={`p-6 rounded-2xl border-2 text-left transition-all ${selectedTier === 'pro' ? 'border-blue-500 bg-blue-50 shadow-lg' : hasAnyAgent ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="text-xl font-bold text-gray-900 mb-1">Pro</div><div className="text-blue-600 font-bold mb-3 text-sm">AI + Knowledge Base</div>
              <ul className="text-gray-400 text-xs space-y-1 mb-3"><li>✓ Everything in Starter</li><li>✓ Paste PDF/Text content</li><li>✓ Business FAQs & pricing</li><li>✓ 7-day free trial</li><li>✗ No website scraping</li></ul>
              {hasAnyAgent && <p className="text-red-500 text-xs font-bold">✓ Agent Active</p>}
            </button>
            <button type="button" onClick={() => hasAnyAgent ? alert('⚠️ Delete your existing agent first.') : setSelectedTier('enterprise')} disabled={hasAnyAgent} className={`p-6 rounded-2xl border-2 text-left transition-all ${selectedTier === 'enterprise' ? 'border-[#E5C158] bg-yellow-50 shadow-lg' : hasAnyAgent ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="text-xl font-bold text-gray-900 mb-1">Enterprise</div><div className="text-[#E5C158] font-bold mb-3 text-sm">AI + Knowledge + Web</div>
              <ul className="text-gray-400 text-xs space-y-1 mb-3"><li>✓ Everything in Pro</li><li>✓ Auto website scraping</li><li>✓ Live business data</li><li>✓ 7-day free trial</li><li>✓ Best for businesses</li></ul>
              {hasAnyAgent && <p className="text-red-500 text-xs font-bold">✓ Agent Active</p>}
            </button>
          </div>
        )}

        {selectedTier && (
          <form id="create-form" onSubmit={isEditing ? handleUpdateAgent : handleCreateAgent} className="space-y-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Agent Details</h3>
              {!isEditing && ( <button type="button" onClick={openAiAssistant} className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold hover:opacity-90 transition-opacity">🤖 Let AI fill this for me</button> )}
              {isEditing && ( <button type="button" onClick={closeEditAgent} className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-300 transition-opacity">Cancel Edit</button> )}
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label><input type="text" placeholder="e.g., Imraan's Support Bot" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#25D366] outline-none" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">System Prompt (Personality)</label><textarea placeholder="e.g., You are a friendly assistant..." value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#25D366] outline-none resize-none" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message (First message sent to user)</label><input type="text" placeholder="Hello! I am [Name] at [Business]. How can I help?" value={greetingMsg} onChange={(e) => setGreetingMsg(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#25D366] outline-none" /></div>
            {(selectedTier === 'pro' || selectedTier === 'enterprise') && ( <div><label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Base (Paste PDF/Text content here)</label><textarea placeholder="Paste your FAQs, pricing, or document text here..." value={kbText} onChange={(e) => setKbText(e.target.value)} rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none" /></div> )}
            {selectedTier === 'enterprise' && ( <div><label className="block text-sm font-medium text-gray-700 mb-1">Website URL (To be scraped)</label><input type="url" placeholder="https://yourbusiness.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#E5C158] outline-none" /></div> )}
            {loadingStatus && <p className="text-sm text-blue-600 font-semibold animate-pulse">{loadingStatus}</p>}
            <button type="submit" disabled={isLoading} className="w-full py-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-lg transition-all shadow-lg shadow-green-500/20 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {isEditing ? (isLoading ? 'Updating...' : 'Update Agent') : (isLoading ? 'Processing...' : 'Create My AI Agent')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}