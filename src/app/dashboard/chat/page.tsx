'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ChatPage() {
  const [agentName, setAgentName] = useState('Assistant')
  const [greeting, setGreeting] = useState('Hello! How can I help you today?')
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.')
  const [knowledgeBase, setKnowledgeBase] = useState('')
  
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  // 1. Load real data from Supabase when page opens
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Fetch Agent and Knowledge Base in one go
      const { data: agent, error } = await supabase
        .from('agents')
        .select(`
          *,
          knowledge_bases (
            scraped_text,
            manual_text
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (agent) {
        setAgentName(agent.name || 'Assistant')
        setGreeting(agent.greeting_message || 'Hello! How can I help you today?')
        setSystemPrompt(agent.system_prompt || 'You are a helpful assistant.')
        
        // Combine knowledge base texts
        const kb = agent.knowledge_bases?.[0]
        const combinedKnowledge = `Website Info: ${kb?.scraped_text || ''}\n\nManual Info: ${kb?.manual_text || ''}`
        setKnowledgeBase(combinedKnowledge)

        // Set initial greeting message
        setMessages([{ id: 1, text: agent.greeting_message || 'Hello! How can I help you today?', sender: 'ai' }])
      }
    }
    loadData()
  }, [router, supabase])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { id: Date.now(), text: input, sender: 'user' }
    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setIsLoading(true)

    try {
      // 2. Call our AI API route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          systemPrompt: systemPrompt,
          agentName: agentName,
          knowledgeBase: knowledgeBase,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const aiResponse = { id: Date.now() + 1, text: data.reply, sender: 'ai' }
        setMessages(prev => [...prev, aiResponse])
      } else {
        const errorMsg = { id: Date.now() + 1, text: "Error: " + (data.error || "Could not connect to AI."), sender: 'ai' }
        setMessages(prev => [...prev, errorMsg])
      }
    } catch (error) {
      const errorMsg = { id: Date.now() + 1, text: "Network error. Please try again.", sender: 'ai' }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-4">
      <div className="bg-white rounded-lg shadow-lg flex flex-col h-full overflow-hidden">
        <div className="bg-[#075E54] p-4 text-white flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold">{agentName.charAt(0)}</div>
          <div>
            <h3 className="font-semibold">{agentName}</h3>
            <p className="text-xs text-green-200">Online</p>
          </div>
        </div>

        <div className="flex-1 bg-[#ECE5DD] p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] p-3 rounded-lg shadow-sm ${msg.sender === 'user' ? 'bg-[#DCF8C6] text-gray-800' : 'bg-white text-gray-800'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white p-3 rounded-lg shadow-sm text-gray-500 italic">{agentName} is typing...</div>
            </div>
          )}
        </div>

        <div className="bg-[#F0F0F0] p-4 flex space-x-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Type a message..." disabled={isLoading} className="flex-1 px-4 py-2 rounded-full border-none outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-200" />
          <button onClick={handleSend} disabled={isLoading || !input.trim()} className={`px-6 py-2 rounded-full font-semibold transition text-white ${isLoading || !input.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#075E54] hover:bg-[#064c44]'}`}>
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}