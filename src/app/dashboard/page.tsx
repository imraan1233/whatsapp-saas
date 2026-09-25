'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardHome() {
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedTier, setSelectedTier] = useState<'simple' | 'advanced' | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // 1. Get the logged-in user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUser(user);
    };
    getUser();
  }, []);

  // 2. Fetch existing agents for this user
  useEffect(() => {
    if (user) {
      fetchAgents();
    }
  }, [user]);

  const fetchAgents = async () => {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (data) setAgents(data);
  };

  // 3. Handle Form Submission
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTier) return;

    setIsLoading(true);

    const daysToAdd = selectedTier === 'simple' ? 3 : 7;
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + daysToAdd);

    const { error } = await supabase
      .from('agents')
      .insert([
        {
          user_id: user.id,
          name: agentName,
          system_prompt: agentPrompt,
          greeting_message: `Hello! I am ${agentName}. How can I help you today?`,
          tier: selectedTier, 
          trial_ends_at: trialEndDate.toISOString(),
        },
      ]);

    if (error) {
      alert('❌ Error creating agent: ' + error.message);
    } else {
      // Clear form and refresh the list
      setAgentName('');
      setAgentPrompt('');
      setSelectedTier(null);
      fetchAgents(); // This updates the screen instantly!
    }

    setIsLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.email}!</h1>
        <p className="text-gray-400 text-lg font-bold">Let's set up your first AI WhatsApp Agent.</p>
      </div>

      {/* --- SHOW EXISTING AGENTS --- */}
      {agents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Your Active Agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{agent.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${agent.tier === 'simple' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {agent.tier === 'simple' ? '3-Day Trial' : '7-Day Trial'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{agent.system_prompt}</p>
                <div className="text-xs text-gray-400">
                  Trial ends: {new Date(agent.trial_ends_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- CREATE NEW AGENT FORM --- */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Create a New Agent</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setSelectedTier('simple')}
            className={`p-6 rounded-2xl border-2 text-left transition-all ${
              selectedTier === 'simple' 
                ? 'border-[#25D366] bg-green-50/50 shadow-lg' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900 mb-1">Quick Start</div>
            <div className="text-[#25D366] font-bold mb-3">3-Day Free Trial</div>
            <p className="text-gray-400 text-sm font-bold">Perfect for simple text messaging.</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTier('advanced')}
            className={`p-6 rounded-2xl border-2 text-left transition-all ${
              selectedTier === 'advanced' 
                ? 'border-[#E5C158] bg-yellow-50/50 shadow-lg' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900 mb-1">Growth Engine</div>
            <div className="text-[#E5C158] font-bold mb-3">7-Day Free Trial</div>
            <p className="text-gray-400 text-sm font-bold">Includes Web Scraping & Docs.</p>
          </button>
        </div>

        {selectedTier && (
          <form onSubmit={handleCreateAgent} className="space-y-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
              <input
                type="text"
                placeholder="e.g., Imraan's Support Bot"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
              <textarea
                placeholder="e.g., You are a friendly assistant..."
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none transition-all resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-lg transition-all shadow-lg shadow-green-500/20 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create My AI Agent'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}