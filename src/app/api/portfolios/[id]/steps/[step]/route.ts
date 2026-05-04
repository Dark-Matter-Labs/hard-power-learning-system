import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const patchSchema = z.object({
  content: z.record(z.string(), z.unknown()).optional(),
  human_input: z.string().max(10000).optional(),
  status: z.enum(['not_started', 'ai_drafted', 'in_review', 'complete']).optional(),
});

type Params = { id: string; step: string };

async function getPortfolioForUser(supabase: Awaited<ReturnType<typeof createClient>>, portfolioId: string, userId: string) {
  const { data } = await supabase
    .from('portfolios')
    .select('id, current_step')
    .eq('id', portfolioId)
    .eq('author_id', userId)
    .single();
  return data;
}

export async function GET(_req: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, step } = await params;
  const stepNumber = parseInt(step, 10);
  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 13) {
    return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
  }

  const portfolio = await getPortfolioForUser(supabase, id, user.id);
  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: stepData, error } = await supabase
    .from('portfolio_steps')
    .select('*')
    .eq('portfolio_id', id)
    .eq('step_number', stepNumber)
    .single();

  if (error || !stepData) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

  return NextResponse.json({ data: stepData });
}

export async function PATCH(request: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, step } = await params;
  const stepNumber = parseInt(step, 10);
  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 13) {
    return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const portfolio = await getPortfolioForUser(supabase, id, user.id);
  if (!portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.status === 'complete') {
    update.completed_at = new Date().toISOString();
  }

  const { data: stepData, error } = await supabase
    .from('portfolio_steps')
    .update(update)
    .eq('portfolio_id', id)
    .eq('step_number', stepNumber)
    .select()
    .single();

  if (error || !stepData) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  if (parsed.data.status === 'complete' && stepNumber === portfolio.current_step && stepNumber < 13) {
    await supabase.from('portfolios')
      .update({ current_step: stepNumber + 1, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('author_id', user.id);
  }

  return NextResponse.json({ data: stepData });
}
