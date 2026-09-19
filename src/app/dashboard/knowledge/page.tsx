'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function KnowledgeBasePage() {
  const [url, setUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [manualText, setManualText] = useState('')
  const [isTraining, setIsTraining] = useState(false)
  const [status, setStatus] = useState('')
  const [agentId, setAgentId] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleTrain = async () => {
    if (!url && files.length === 0 && !manualText) {
      setStatus('⚠️ Please add at least one source of information.')
      return
    }
    
    if (!agentId) {
      setStatus('️ Could not find your agent. Please try logging in again.')
      return
    }

    setIsTraining(true)
    setStatus('Processing your knowledge base...')
    
    let scrapedText = ''

    // 1. Scrape website if URL provided
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

    // 2. For now, we'll note that files were uploaded (PDF processing coming next)
    let fileNote = ''
    if (files.length > 0) {
      fileNote = `\n\nUPLOADED FILES: ${files.map(f => f.name).join(', ')}\n(Note: PDF processing will be implemented next)`
    }

    // 3. Check if knowledge base already exists for this agent
    const { data: existing } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('agent_id', agentId)
      .single()

    let error

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('knowledge_bases')
        .update({
          website_url: url || null,
          scraped_text: scrapedText || null,
          manual_text: manualText + fileNote || null,
        })
        .eq('agent_id', agentId)
      
      error = updateError
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('knowledge_bases')
        .insert({
          agent_id: agentId,
          website_url: url || null,
          scraped_text: scrapedText || null,
          manual_text: manualText + fileNote || null,
        })
      
      error = insertError
    }

    setIsTraining(false)

    if (error) {
      setStatus('❌ Error saving to database: ' + error.message)
    } else {
      setStatus('✅ Success! Your AI agent has learned your business data.')
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

        {/* Option 2: File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Option 2: Upload Documents (PDF, TXT)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition">
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              multiple 
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileChange} 
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <p className="text-blue-600 font-semibold"> Click to upload files</p>
              <p className="text-xs text-gray-400 mt-1">PDF, TXT, DOC, DOCX supported</p>
            </label>
          </div>
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                  <button onClick={() => removeFile(index)} className="ml-4 text-red-600 text-sm font-medium">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="h-px bg-gray-300 flex-1"></div>
          <span className="text-gray-400 text-sm">AND / OR</span>
          <div className="h-px bg-gray-300 flex-1"></div>
        </div>

        {/* Option 3: Manual Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Option 3: Describe Your Business / Prices / Hours</label>
          <textarea 
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Example: We are open 9am-5pm. We charge $50 for repairs. We sell Benoxyl Cream, Skin-A Cream, etc."
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
          <div className={`p-4 rounded-lg ${status.includes('Success') ? 'bg-green-50 text-green-700' : status.includes('⚠️') ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}