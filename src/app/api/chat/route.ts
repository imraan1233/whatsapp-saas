import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { message, systemPrompt, agentName, knowledgeBase } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key is missing.' }, { status: 500 });
    }

    // Build a super-smart system prompt
    const fullSystemPrompt = `
      You are ${agentName}, a helpful AI assistant for this business. 
      
      Here is the business information you MUST use to answer questions:
      ${knowledgeBase}

      General Instructions:
      ${systemPrompt}
      
      If the answer is not in the business information, politely say you don't know and suggest they contact the business directly.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: message },
      ],
    });

    const aiReply = completion.choices[0].message.content;
    return NextResponse.json({ reply: aiReply });
  } catch (error) {
    console.error('OpenAI Error:', error);
    return NextResponse.json({ error: 'Failed to get AI response.' }, { status: 500 });
  }
}