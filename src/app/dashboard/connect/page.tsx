'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ConnectPage() {
  const [phone, setPhone] = useState('')
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const setupProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) {
        await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || null,
            },
          ])
      }
      
      setLoading(false)
    }
    setupProfile()
  }, [router, supabase])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setSubmitting(false)
      return
    }

    // Check if agent already exists, if so update it
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let error;
    if (existingAgent) {
      // Update existing
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          phone_number: phone,
          twilio_account_sid: accountSid,
          twilio_auth_token: authToken,
          openai_api_key: openaiKey,
          status: 'active',
        })
        .eq('id', existingAgent.id)
      error = updateError
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('agents')
        .insert([
          {
            user_id: user.id,
            phone_number: phone,
            twilio_account_sid: accountSid,
            twilio_auth_token: authToken,
            openai_api_key: openaiKey,
            status: 'active',
          },
        ])
      error = insertError
    }

    if (error) {
      setError(error.message)
      setSubmitting(false)
    } else {
      router.push('/dashboard')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect WhatsApp</CardTitle>
          <CardDescription>
            Enter your credentials to activate your AI agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp Phone Number</Label>
              <Input
                id="phone"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sid">Twilio Account SID</Label>
              <Input
                id="sid"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">Twilio Auth Token</Label>
              <Input
                id="token"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai">OpenAI API Key</Label>
              <Input
                id="openai"
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Connecting...' : 'Connect Agent'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}