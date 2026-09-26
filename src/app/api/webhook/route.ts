import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EXPECTED_TOKEN = "imraan123";

function fingerprint(value: string | null | undefined) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === EXPECTED_TOKEN && challenge !== null) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages) {
      return new NextResponse('OK', { status: 200 });
    }

    const message = value.messages[0];
    const fromNumber = message.from;
    const phoneNumberId = value.metadata?.phone_number_id;
    const whatsappToken = process.env.WHATSAPP_TEST_TOKEN;

    let incomingText = '';
    let messageType = message.type;

    // 🎙️ HANDLE VOICE MESSAGES
    if (messageType === 'audio') {
      console.log('🎙️ Received Voice Note. Transcribing...');
      const mediaId = message.audio.id;
      
      // 1. Get the media URL from Meta
      const mediaInfoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${whatsappToken}` }
      });
      const mediaInfo = await mediaInfoRes.json();
      
      // 2. Download the actual audio file
      const fileRes = await fetch(mediaInfo.url, {
        headers: { 'Authorization': `Bearer ${whatsappToken}` }
      });
      const arrayBuffer = await fileRes.arrayBuffer();
      const blob = new Blob([arrayBuffer]);
      const file = new File([blob], "audio.ogg", { type: "audio/ogg" });

      // 3. Transcribe using OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
      });
      incomingText = transcription.text;
      console.log(`✅ Transcribed Voice to Text: "${incomingText}"`);
    } 
    // 💬 HANDLE TEXT MESSAGES
    else if (messageType === 'text') {
      incomingText = message.text?.body;
    } 
    // 🖼️ HANDLE IMAGES (We will add this in the next step!)
    else if (messageType === 'image') {
      incomingText = "The user sent an image. (Image analysis coming in the next update!)";
    }

    if (!incomingText) {
      return new NextResponse('OK', { status: 200 });
    }

    console.log(`✅ Processing Message from ${fromNumber}: "${incomingText}"`);

    // 👇 FETCH AGENT FROM DATABASE 👇
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !agent) {
      console.error('❌ No agent found!', error);
      return new NextResponse('OK', { status: 200 });
    }

    // 👇 CALL OPENAI CHAT API 👇
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${agent.name}. ${agent.system_prompt}\n\nKeep responses concise, friendly, and helpful.`,
        },
        { role: 'user', content: incomingText },
      ],
    });

    const aiResponse = completion.choices[0].message.content || 'Sorry, I could not process that.';

    // 👇 SEND REPLY TO WHATSAPP 👇
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