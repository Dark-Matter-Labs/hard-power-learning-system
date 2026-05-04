import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateStepContent } from '@/lib/portfolio/generate';
import { STEP_AGENTS } from '@/lib/portfolio/agents';

type Params = { id: string; step: string };

export async function POST(_req: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, step } = await params;
  const stepNumber = parseInt(step, 10);
  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 13) {
    return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
  }

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', id)
    .eq('author_id', user.id)
    .single();
  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!STEP_AGENTS[stepNumber]?.implemented) {
    return NextResponse.json({ error: 'This step agent is not yet implemented' }, { status: 422 });
  }

  try {
    const content = await generateStepContent(id, stepNumber);

    await supabase.from('portfolio_steps')
      .update({
        ai_suggestions: { text: content, generated_at: new Date().toISOString() },
        status: 'ai_drafted',
        updated_at: new Date().toISOString(),
      })
      .eq('portfolio_id', id)
      .eq('step_number', stepNumber);

    return NextResponse.json({ data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
