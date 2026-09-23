import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use the environment variable, with a fallback just in case
const EXPECTED_TOKEN = "imraan123";

function fingerprint(value: string | null | undefined) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

// GET Request: Meta uses this to verify your webhook URL
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  console.log('Webhook verification', {
    mode,
    tokenPresent: token !== null,
    tokenLength: token?.length ?? null,
    expectedLength: EXPECTED_TOKEN.length,
    tokenFingerprint: fingerprint(token),
    expectedFingerprint: fingerprint(EXPECTED_TOKEN),
    hasChallenge: challenge !== null,
    host: request.headers.get('host'),
    pathname: request.nextUrl.pathname,
  });

  if (mode === 'subscribe' && token === EXPECTED_TOKEN && challenge !== null) {
    console.log('✅ Webhook verification succeeded');
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.error('❌ Webhook verification failed');
  return new NextResponse('Forbidden', { status: 403 });
}

// POST Request: Meta sends this when a customer messages your WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // 🚨 Breadcrumb 1: If it's just a status update (double ticks), we log it and stop
    if (!value?.messages) {
      console.log('⚠️ IGNORED: This was a status update (like double ticks), not a text message.');
      return new NextResponse('OK', { status: 200 });
    }

    const message = value.messages[0];
    const fromNumber = message.from;
    const incomingText = message.text?.body;
    const phoneNumberId = value.metadata?.phone_number_id;

    // 🚨 Breadcrumb 2: We successfully extracted the text!
    console.log(`✅ REAL MESSAGE! From: ${fromNumber} | Text: "${incomingText}" | PhoneID: ${phoneNumberId}`);

    if (!incomingText) {
      console.log('⚠️ IGNORED: Message has no text body (maybe an image or sticker).');
      return new NextResponse('OK', { status: 200 });
    }

    // 👇 LOOKUP AGENT IN SUPABASE 👇
    console.log(`🔍 Looking up agent with whatsapp_phone_id: ${phoneNumberId}`);

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
      .single();

    if (agentError || !agent) {
      console.error('❌ SUPABASE ERROR: No agent found or query failed!', {
        error: agentError?.message,
        phoneNumberId,
        agentFound: !!agent,
      });
      return new NextResponse('OK', { status: 200 });
    }

    console.log('✅ Agent found!', {
      agentName: agent.name,
      hasKnowledgeBase: !!agent.knowledge_bases?.length,
    });

    const agentName = agent?.name || 'Assistant';
    const systemPrompt = agent?.system_prompt || 'You are a helpful assistant.';
    const knowledgeBase = agent?.knowledge_bases?.[0] 
      ? `Website Info: ${agent.knowledge_bases[0].scraped_text || ''}\nManual Info: ${agent.knowledge_bases[0].manual_text || ''}`
      : 'No specific knowledge base provided.';

    // 👇 CALL OPENAI 👇
    console.log('🤖 Calling OpenAI...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${agentName}. ${systemPrompt}\n\nHere is the business information:\n${knowledgeBase}\n\nKeep responses concise and friendly.`,
        },
        {
          role: 'user',
          content: incomingText,
        },
      ],
    });

    const aiResponse = completion.choices[0].message.content || 'Sorry, I could not process that.';
    console.log(`✅ OpenAI responded: "${aiResponse.substring(0, 100)}..."`);

    // 👇 SEND REPLY TO WHATSAPP 👇
    const whatsappToken = agent?.whatsapp_token || process.env.WHATSAPP_TEST_TOKEN;
    const replyUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    console.log('📤 Sending reply to WhatsApp...', {
      replyUrl,
      hasToken: !!whatsappToken,
      tokenPreview: whatsappToken ? `${whatsappToken.substring(0, 10)}...` : 'MISSING',
      to: fromNumber,
    });

    if (!whatsappToken) {
      console.error('❌ NO WHATSAPP TOKEN! Agent has no whatsapp_token and WHATSAPP_TEST_TOKEN env var is missing!');
      return new NextResponse('OK', { status: 200 });
    }

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

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('❌ META REJECTED THE REPLY!', {
        status: metaResponse.status,
        error: metaResult,
      });
    } else {
      console.log('✅ Reply sent successfully to Meta!', { metaResult });
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('💥 WEBHOOK CRASHED:', error);
    return new NextResponse('Error', { status: 500 });
  }
}