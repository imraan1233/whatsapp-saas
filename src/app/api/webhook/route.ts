import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase (using anon key is fine for now since we opened read access)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 1. GET Request: Meta uses this to verify your webhook URL
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Replace 'your_verify_token' with a secret string you make up (e.g., 'my_saas_secret_123')
  if (mode === 'subscribe' && token === 'my_saas_secret_123') {
    return new NextResponse(challenge, { status: 200 })
  }
  
  return new NextResponse('Forbidden', { status: 403 })
}

// 2. POST Request: Meta sends this when a customer messages your WhatsApp
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('Webhook received:', JSON.stringify(body, null, 2))

    // Extract data from Meta's complex payload structure
    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    
    if (!value?.messages) {
      return new NextResponse('No messages', { status: 200 }) // Acknowledge receipt
    }

    const message = value.messages[0]
    const fromNumber = message.from // Customer's WhatsApp number
    const incomingText = message.text?.body

    if (!incomingText) {
      return new NextResponse('Not a text message', { status: 200 })
    }

    const phoneNumberId = value.metadata?.phone_number_id

    // 3. Look up the Agent in Supabase using the Phone Number ID
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

    // Fallback if no agent is found or phone ID isn't set yet
    const agentName = agent?.name || 'Assistant'
    const systemPrompt = agent?.system_prompt || 'You are a helpful assistant.'
    const knowledgeBase = agent?.knowledge_bases?.[0] 
      ? `Website Info: ${agent.knowledge_bases[0].scraped_text || ''}\nManual Info: ${agent.knowledge_bases[0].manual_text || ''}`
      : 'No specific knowledge base provided.'

    // 4. Call OpenAI with the Agent's specific brain
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${agentName}. ${systemPrompt}\n\nHere is the business information you MUST use to answer:\n${knowledgeBase}\n\nKeep responses concise, friendly, and directly answer the customer's question.`
        },
        {
          role: 'user',
          content: incomingText,
        },
      ],
    })

    const aiResponse = completion.choices[0].message.content || 'Sorry, I could not process that.'
    console.log('AI Response:', aiResponse)

    // 5. Send the reply back to WhatsApp via Meta API
    const whatsappToken = agent?.whatsapp_token || process.env.WHATSAPP_TEST_TOKEN // Fallback token
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

    // Always return 200 OK to Meta so they know we received it
    return new NextResponse('OK', { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}