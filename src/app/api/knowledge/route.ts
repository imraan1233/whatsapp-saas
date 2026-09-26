import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { agentId, manualText } = await request.json();

    // 1. Check if a knowledge base already exists for this agent
    const { data: existing } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('agent_id', agentId)
      .single();

    let error;

    if (existing) {
      // 2. Update existing record
      const res = await supabase
        .from('knowledge_bases')
        .update({ manual_text: manualText })
        .eq('id', existing.id);
      error = res.error;
    } else {
      // 3. Insert new record
      const res = await supabase
        .from('knowledge_bases')
        .insert([{ agent_id: agentId, manual_text: manualText }]);
      error = res.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Knowledge API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}