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

export async function POST(request: NextRequest) {
  try {
    const { agentId, message, chatHistory } = await request.json();

    const { data: agent, error } = await supabase.from('agents').select('*').eq('id', agentId).single();
    if (error || !agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    // Fetch knowledge base AND the website URL
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('manual_text, scraped_text, website_url')
      .eq('agent_id', agentId)
      .single();

    const manualInfo = kb?.manual_text ? `\n\nBusiness Info provided by owner:\n"${kb.manual_text}"` : '';
    const websiteInfo = kb?.scraped_text ? `\n\nContent scraped from their website:\n"${kb.scraped_text}"` : '';
    const websiteLink = kb?.website_url ? `\n\nOfficial Website URL: ${kb.website_url}` : '';

    const messages: any[] = [
      {
        role: 'system',
        content: `You are ${agent.name}. ${agent.system_prompt}${manualInfo}${websiteInfo}${websiteLink}

CRITICAL CONVERSATION RULES FOR WHATSAPP:
1. Be a friendly Concierge, NOT a search engine.
2. If a user asks "Do you have [Category]?", DO NOT list every product. Reply: "Yes, we have [Category] products. Are you looking for a specific one?"
3. ONLY list specific items if the user explicitly asks for a list.
4. Keep responses short and conversational (under 3 sentences).
5. ACTION RULE: If the user wants to order, buy, or checkout, YOU MUST provide the link. 
6. FORMATTING RULE: NEVER use Markdown formatting like [Link](url). WhatsApp cannot read that. ALWAYS output the raw URL (e.g. https://chowhanspharmacy.com) so it becomes a clickable blue link.
7. When listing items, use this format: 1/ Item name, 2/ Item name.`,
      },
      ...(chatHistory || []),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages });
    return NextResponse.json({ response: completion.choices[0].message.content || 'Sorry, I could not process that.' });

  } catch (error) {
    console.error('💥 Chat API Crashed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}