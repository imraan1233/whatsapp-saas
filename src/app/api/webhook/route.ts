import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// GET Request: Meta uses this to verify your webhook URL
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    console.log('Meta verification:', { mode, token, challenge })

    if (mode === 'subscribe' && token === 'my_saas_secret_1234') {
      console.log('✅ Verification successful!')
      // Return ONLY the challenge string, nothing else
      return new Response(challenge, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    console.log('❌ Verification failed')
    return new Response('Forbidden', { status: 403 })
  } catch (error) {
    console.error('Verification error:', error)
    return new Response('Error', { status: 500 })
  }
}

// POST Request: Meta sends this when a customer messages your WhatsApp
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('Webhook received:', JSON.stringify(body, null, 2))

    // Extract data from Meta's complex payload structure
    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    
    if (!value?.messages) {
      return new Response('OK', { status: 200 })
    }

    const message = value.messages[0]
    const fromNumber = message.from
    const incomingText = message.text?.body

    if (!incomingText) {
      return new Response('OK', { status: 200 })
    }

    const phoneNumberId = value.metadata?.phone_number_id

    // Look up the Agent in Supabase
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select(`
        *,
        knowledge_bases (
          scraped_text,
          manual_text
        )
      `)
      .eq('whatsapp_phone_id', phoneNumberId)
      .single()

    const agentName = agent?.name || 'Assistant'
    const systemPrompt = agent?.system_prompt || 'You are a helpful assistant.'
    const knowledgeBase = agent?.knowledge_bases?.[0] 
      ? `Website Info: ${agent.knowledge_bases[0].scraped_text || ''}\nManual Info: ${agent.knowledge_bases[0].manual_text || ''}`
      : 'No specific knowledge base provided.'

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${agentName}. ${systemPrompt}\n\nHere is the business information:\n${knowledgeBase}\n\nKeep responses concise and friendly.`
        },
        {
          role: 'user',
          content: incomingText,
        },
      ],
    })

    const aiResponse = completion.choices[0].message.content || 'Sorry, I could not process that.'

    // Send reply back to WhatsApp
    const whatsappToken = agent?.whatsapp_token || process.env.WHATSAPP_TEST_TOKEN
    const replyUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

    await fetch(replyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: fromNumber,
        text: { body: aiResponse },
      }),
    })

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Error', { status: 500 })
  }
}