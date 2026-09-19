'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    agentName: 'Assistant', 
    greetingMessage: 'Hello! How can I help you today?',
    whatsappPhoneId: '',
    whatsappToken: '',
    language: 'English',
    systemPrompt: 'You are a helpful, friendly, and professional customer support agent.',
  })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [agentId, setAgentId] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()

  // 1. Load existing settings from Supabase when page opens
  useEffect(() => {
    const loadSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: agent, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (agent) {
        setAgentId(agent.id)
        setFormData({
          agentName: agent.name || 'Assistant',
          greetingMessage: agent.greeting_message || 'Hello! How can I help you today?',
          whatsappPhoneId: agent.whatsapp_phone_id || '',
          whatsappToken: agent.whatsapp_token || '',
          language: agent.language || 'English',
          systemPrompt: agent.system_prompt || 'You are a helpful assistant.',
        })
      }
      setLoading(false)
    }
    loadSettings()
  }, [router, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setSaved(false)
  }

  const handleSave = async () => {
    if (!agentId) return

    setLoading(true)
    
    // 2. Save directly to Supabase Database!
    const { error } = await supabase
      .from('agents')
      .update({
        name: formData.agentName,
        greeting_message: formData.greetingMessage,
        whatsapp_phone_id: formData.whatsappPhoneId,
        whatsapp_token: formData.whatsappToken,
        language: formData.language,
        system_prompt: formData.systemPrompt,
      })
      .eq('id', agentId)

    setLoading(false)

    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const languages = ['English', 'Arabic', 'French', 'Spanish', 'Urdu', 'Chinese', 'Hindi', 'German', 'Turkish', 'Russian']

  if (loading && !agentId) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>
  }

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Settings</h2>
      <p className="text-gray-500 mb-8">Configure your WhatsApp connection and AI behavior.</p>
      
      <div className="bg-white p-8 rounded-lg shadow max-w-3xl space-y-8">
        
        {/* WhatsApp Section */}
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">WhatsApp Business Connection</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
              <input 
                type="text" 
                name="whatsappPhoneId"
                value={formData.whatsappPhoneId}
                onChange={handleChange}
                placeholder="123456789012345"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Found in your Meta Developer Portal.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <input 
                type="password" 
                name="whatsappToken"
                value={formData.whatsappToken}
                onChange={handleChange}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Temporary or Permanent token from Meta.</p>
            </div>
          </div>
        </div>

        {/* AI Configuration Section */}
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">AI Agent Configuration</h3>
          <div className="space-y-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
              <input 
                type="text" 
                name="agentName"
                value={formData.agentName}
                onChange={handleChange}
                placeholder="e.g., Sara, Ahmed, Rajpal"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Greeting Message</label>
              <textarea 
                name="greetingMessage"
                value={formData.greetingMessage}
                onChange={handleChange}
                rows={3}
                placeholder="e.g., I am Sara, your virtual assistant. How can I help you today?"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Language</label>
              <select 
                name="language"
                value={formData.language}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {languages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Personality (System Prompt)</label>
              <textarea 
                name="systemPrompt"
                value={formData.systemPrompt}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t flex items-center justify-between">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
          
          {saved && (
            <span className="text-green-600 font-medium animate-pulse">
              ✅ Settings saved to database!
            </span>
          )}
        </div>

      </div>
    </div>
  )
}