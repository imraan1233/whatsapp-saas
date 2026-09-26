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

    const fromNumber = value.messages[0].from;
    const phoneNumberId = value.metadata?.phone_number_id;
    const whatsappToken = process.env.WHATSAPP_TEST_TOKEN;

    // Process ALL messages (image + text together)
    let incomingText = '';
    let imageBase64: string | null = null;
    let imageMimeType = 'image/jpeg';

    for (const message of value.messages) {
      const messageType = message.type;

      if (messageType === 'audio') {
        console.log('🎙️ Received Voice Note. Transcribing...');
        const mediaId = message.audio.id;
        
        const mediaInfoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
          headers: { 'Authorization': `Bearer ${whatsappToken}` }
        });
        const mediaInfo = await mediaInfoRes.json();
        
        const fileRes = await fetch(mediaInfo.url, { headers: { 'Authorization': `Bearer ${whatsappToken}` } });
        const arrayBuffer = await fileRes.arrayBuffer();
        const file = new File([new Blob([arrayBuffer])], "audio.ogg", { type: "audio/ogg" });

        const transcription = await openai.audio.transcriptions.create({ file: file, model: "whisper-1" });
        incomingText += (incomingText ? ' ' : '') + transcription.text;
        console.log(`✅ Transcribed Voice: "${transcription.text}"`);
      } 
      else if (messageType === 'text') {
        incomingText += (incomingText ? ' ' : '') + message.text?.body;
      } 
      else if (messageType === 'image') {
        console.log('🖼️ Received Image. Analyzing with Vision AI...');
        const mediaId = message.image.id;

        const mediaInfoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
          headers: { 'Authorization': `Bearer ${whatsappToken}` }
        });
        const mediaInfo = await mediaInfoRes.json();

        const fileRes = await fetch(mediaInfo.url, { headers: { 'Authorization': `Bearer ${whatsappToken}` } });
        const arrayBuffer = await fileRes.arrayBuffer();
        imageBase64 = Buffer.from(arrayBuffer).toString('base64');
        imageMimeType = mediaInfo.mime_type || 'image/jpeg';
        console.log('✅ Image downloaded and converted to base64');
      }
    }

    // If we have an image, analyze it with Vision AI
    if (imageBase64) {
      console.log('️ Analyzing image with GPT-4 Vision...');
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this image in detail. If it shows a product, identify the brand, name, and any visible text. Keep it under 3 sentences." },
              {
                type: "image_url",
                image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 300,
      });

      const imageDescription = visionResponse.choices[0].message.content;
      incomingText = `[User sent an image showing: ${imageDescription}] ${incomingText}`;
      console.log(`✅ Image analyzed: ${imageDescription}`);
    }

    if (!incomingText) {
      return new NextResponse('OK', { status: 200 });
    }

    console.log(`✅ Processing Message from ${fromNumber}: "${incomingText}"`);

    // Fetch Agent
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

    // Fetch Knowledge Base
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('manual_text, scraped_text, website_url')
      .eq('agent_id', agent.id)
      .single();

    const manualInfo = kb?.manual_text ? `\n\nBusiness Info:\n"${kb.manual_text}"` : '';
    const websiteInfo = kb?.scraped_text ? `\n\nWebsite Content:\n"${kb.scraped_text}"` : '';
    const websiteLink = kb?.website_url ? `\n\nOfficial Website URL: ${kb.website_url}` : '';

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${agent.name}. ${agent.system_prompt}${manualInfo}${websiteInfo}${websiteLink}

CRITICAL CONVERSATION RULES FOR WHATSAPP:
1. Be a friendly Concierge, NOT a search engine.
2. If a user asks "Do you have [Category]?", DO NOT list every product. Reply: "Yes, we have [Category] products. Are you looking for a specific one?"
3. ACTION RULE: If the user wants to order, buy, or checkout, YOU MUST provide the link. Say: "Great! You can place your order directly on our website here: ${kb?.website_url || 'our website'}"
4. FORMATTING RULE: NEVER use Markdown formatting like [Link](url). WhatsApp cannot read that. ALWAYS output the raw URL (e.g. https://chowhanspharmacy.com) so it becomes a clickable blue link.
5. Keep responses short and conversational (under 3 sentences).
6. If the user sent an image of a product, check if you have it in your knowledge base or website, and provide pricing/availability info.`,
        },
        { role: 'user', content: incomingText },
      ],
    });

    const aiResponse = completion.choices[0].message.content || 'Sorry, I could not process that.';

    // Send Reply
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