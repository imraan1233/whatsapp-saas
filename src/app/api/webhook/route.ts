import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase (Using the public keys for now)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EXPECTED_TOKEN = "imraan123"; // Your webhook verify token

function fingerprint(value: string | null | undefined) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

// GET Request: Meta uses this to verify your webhook URL
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === EXPECTED_TOKEN && challenge !== null) {
    console.log('✅ Webhook verification succeeded');
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// POST Request: Meta sends this when a customer messages your WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore status updates (double ticks)
    if (!value?.messages) {
      return new NextResponse('OK', { status: 200 });
    }

    const message = value.messages[0];
    const fromNumber = message.from;
    const incomingText = message.text?.body;
    const phoneNumberId = value.metadata?.phone_number_id;

    if (!incomingText) return new NextResponse('OK', { status: 200 });

    console.log(`✅ Message from ${fromNumber}: "${incomingText}"`);

    // 👇 SMART LOOKUP: Get the latest active agent from your database 👇
    console.log('🔍 Fetching latest agent from database...');
    
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !agent) {
      console.error('❌ No agent found in database!', error);
      return new NextResponse('OK', { status: 200 });
    }

    console.log(`🤖 Using Agent: "${agent.name}"`);

    // 👇 CALL OPENAI WITH THE AGENT'S PERSONALITY 👇
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${agent.name}. ${agent.system_prompt}\n\nKeep responses concise, friendly, and helpful.`,
        },
        {
          role: 'user',
          content: incomingText,
        },
      ],
    });

    const aiResponse = completion.choices[0].message.content || 'Sorry, I could not process that.';

    // 👇 SEND REPLY TO WHATSAPP 
    // We use the permanent token we saved in Vercel
    const whatsappToken = process.env.WHATSAPP_TEST_TOKEN; 
    const replyUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const metaResponse = await fetch(replyUrl, {
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
    });

    if (!metaResponse.ok) {
      console.error('❌ Meta rejected the reply!', await metaResponse.json());
    } else {
      console.log('✅ Reply sent successfully!');
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('💥 WEBHOOK CRASHED:', error);
    return new NextResponse('Error', { status: 500 });
  }
}