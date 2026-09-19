'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function KnowledgeBasePage() {
  const [url, setUrl] = useState('')
  const [manualText, setManualText] = useState('')
  const [isTraining, setIsTraining] = useState(false)
  const [status, setStatus] = useState('')
  const [agentId, setAgentId] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()

  // 1. Load the user's agent ID when the page opens
  useEffect(() => {
    const loadAgent = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: agent, error } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (agent) {
        setAgentId(agent.id)
      }
    }
    loadAgent()
  }, [router, supabase])

  const handleTrain = async () => {
    if (!url && !manualText) {
      setStatus('⚠️ Please add at least a website URL or manual text.')
      return
    }
    
    if (!agentId) {
      setStatus('⚠️ Could not find your agent. Please try logging in again.')
      return
    }

    setIsTraining(true)
    setStatus('Scanning your website and saving to database... (This may take a few seconds)')
    
    let scrapedText = ''

    // 2. Scrape the website using Jina Reader
    if (url) {
      try {
        const cleanUrl = url.startsWith('http') ? url : `https://${url}`
        const response = await fetch(`https://r.jina.ai/${cleanUrl}`)
        scrapedText = await response.text()
      } catch (error) {
        console.error("Failed to scrape website:", error)
        scrapedText = "Failed to scrape website."
      }
    }

    // 3. Save directly to Supabase Database!
    const { error } = await supabase
      .from('knowledge_bases')
      .upsert({
        agent_id: agentId,
        website_url: url,
        scraped_text: scrapedText,
        manual_text: manualText,
      }, {
        onConflict: 'agent_id' // Updates existing record instead of creating duplicates
      })

    setIsTraining(false)

    if (error) {
      setStatus('❌ Error saving to database: ' + error.message)
    } else {
      setStatus('✅ Success! Your AI agent has learned your business data and is ready for WhatsApp.')
    }
  }

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Knowledge Base</h2>
      <p className="text-gray-500 mb-8">Teach your AI agent about your business.</p>
      
      <div className="bg-white p-8 rounded-lg shadow max-w-2xl space-y-6">
        
        {/* Option 1: Website URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Option 1: Your Website URL</label>
          <input 
            type="text" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.yourbusiness.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center space-x-4">
          <div className="h-px bg-gray-300 flex-1"></div>
          <span className="text-gray-400 text-sm">AND / OR</span>
          <div className="h-px bg-gray-300 flex-1"></div>
        </div>

        {/* Option 2: Manual Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Option 2: Describe Your Business / Prices / Hours</label>
          <textarea 
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Example: We are open 9am-5pm. We charge $50 for repairs. We sell Benoxyl Cream."
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>

        <button 
          onClick={handleTrain}
          disabled={isTraining}
          className={`w-full py-3 rounded-lg font-semibold text-white transition ${
            isTraining ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isTraining ? 'Training & Saving to Database...' : 'Train AI Agent'}
        </button>

        {status && (
          <div className={`p-4 rounded-lg ${status.includes('Success') ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}