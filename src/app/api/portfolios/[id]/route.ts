import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['in_progress', 'complete', 'paused', 'archived']).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: portfolio, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .eq('author_id', user.id)
    .single();

  if (error || !portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('portfolio_steps')
    .select('*')
    .eq('portfolio_id', id)
    .order('step_number', { ascending: true });

  return NextResponse.json({ data: { ...portfolio, steps: steps ?? [] } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { data, error } = await supabase
    .from('portfolios')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found or update failed' }, { status: 404 });

  return NextResponse.json({ data });
}
