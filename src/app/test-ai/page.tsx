'use client'

import { useState } from 'react'

export default function TestAIPage() {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const testAI = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('Body', message)
      formData.append('From', '+1234567890')

      const res = await fetch('/api/webhook', {
        method: 'POST',
        body: formData,
      })

      const text = await res.text()
      setResponse(text)
    } catch (error) {
      setResponse('Error: ' + error)
    }
    setLoading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test AI</h1>
      <input
        className="border p-2 w-full mb-4"
        placeholder="Type message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button 
        onClick={testAI} 
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? 'Sending...' : 'Send'}
      </button>
      {response && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p>{response}</p>
        </div>
      )}
    </div>
  )
}