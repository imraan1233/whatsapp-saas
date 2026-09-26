import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, step, tier, previousAnswers } = await request.json();

    const totalSteps = tier === 'enterprise' ? 5 : (tier === 'pro' ? 4 : 3);
    let currentQuestion = "";

    if (step === 0) currentQuestion = "1. What is your business name and what do you do? (e.g., 'I run a pharmacy in Dubai')";
    else if (step === 1) currentQuestion = "2. What should we name your AI assistant? (Or type 'suggest')";
    else if (step === 2) currentQuestion = "3. What tone should it use? (e.g., friendly, professional, formal)";
    else if (step === 3 && (tier === 'pro' || tier === 'enterprise')) currentQuestion = "4. Paste any specific info (prices, FAQs, hours). (Or type 'skip')";
    else if (step === 4 && tier === 'enterprise') currentQuestion = "5. What is your website URL? (Or type 'skip')";

    if (step >= totalSteps) {
      const relevantAnswers = previousAnswers.slice(-totalSteps);

      const businessInfo = relevantAnswers[0] || '';
      let assistantName = relevantAnswers[1] || 'Assistant';
      const tone = relevantAnswers[2] || 'friendly';
      
      let knowledgeBase = '';
      if (tier === 'pro' || tier === 'enterprise') {
        knowledgeBase = relevantAnswers[3] || '';
        if (knowledgeBase.toLowerCase() === 'skip') knowledgeBase = '';
      }

      let websiteUrl = '';
      if (tier === 'enterprise') {
        websiteUrl = relevantAnswers[4] || '';
        if (websiteUrl.toLowerCase() === 'skip') websiteUrl = '';
      }

      if (assistantName.toLowerCase().includes('suggest')) {
        const nameCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: `Suggest a short, catchy name (max 2 words) for an AI assistant for this business: ${businessInfo}. Return ONLY the name.` }]
        });
        assistantName = nameCompletion.choices[0].message.content || 'Assistant';
      }

      // Ask AI to write the System Prompt AND the Greeting Message
      const promptCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ 
          role: 'system', 
          content: `You are an expert copywriter. Based on the following details, generate two things:
          1. A 2-sentence system prompt (personality).
          2. A short, friendly greeting message (max 20 words) that introduces the agent and mentions the business name. Example: "Hello! I am [Agent Name], your assistant at [Business Name]. How can I help you today?"

          Business: ${businessInfo}
          Agent Name: ${assistantName}
          Tone: ${tone}

          Return ONLY valid JSON with these exact keys:
          {
            "systemPrompt": "string",
            "greetingMessage": "string"
          }` 
        }]
      });
      
      const content = promptCompletion.choices[0].message.content || '{}';
      let parsedPrompt: any = {};
      try {
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsedPrompt = JSON.parse(jsonMatch[0]);
        else parsedPrompt = JSON.parse(cleanJson);
      } catch (e) { console.error(e); }

      const systemPrompt = parsedPrompt.systemPrompt || `You are a helpful assistant for ${businessInfo}.`;
      const greetingMessage = parsedPrompt.greetingMessage || `Hello! I am ${assistantName}. How can I help you today?`;

      return NextResponse.json({
        done: true,
        response: "✅ Excellent! I've filled in all the fields for you.",
        agentName: assistantName,
        systemPrompt: systemPrompt,
        greetingMessage: greetingMessage, // <-- New!
        knowledgeBase: knowledgeBase,
        websiteUrl: websiteUrl,
      });
    }

    return NextResponse.json({ done: false, response: currentQuestion, nextStep: step + 1 });

  } catch (error) {
    console.error('AI Assistant error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}