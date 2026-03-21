import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from('nodes')
    .select('*')
    .in('status', ['promoted', 'human_reviewed']);

  const nodeType = searchParams.get('node_type');
  if (nodeType) query = query.eq('node_type', nodeType);

  const authorId = searchParams.get('author_id');
  if (authorId) query = query.eq('author_id', authorId);

  const domain = searchParams.get('domain');
  if (domain) query = query.contains('domain_tags', [domain]);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from('nodes')
    .insert({ ...body, author_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
