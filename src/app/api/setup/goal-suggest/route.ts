import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { suggestGoal } from '@/lib/agents/setup';

const schema = z.object({ input: z.string().min(1) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input is required' }, { status: 400 });

  try {
    const suggestion = await suggestGoal(parsed.data.input);
    return NextResponse.json({ data: suggestion }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 });
  }
}
