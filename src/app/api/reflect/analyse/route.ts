import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = (label: string) =>
  `You are a strategic analyst for the Civilization Options Fund (COF). ` +
  `You are running a focused knowledge graph reflection on: "${label}". ` +
  `Return a synthesis answering the provided questions. Be direct and specific. Use plain language.`;

const USER_PROMPT = (label: string, nodeLines: string) =>
  `You are reflecting on activity related to: "${label}"\n\n` +
  `Analyse only the nodes provided. Answer each in 3-5 sentences:\n` +
  `- What is the current state of work related to ${label}?\n` +
  `- What assumptions are being tested? What results have we seen?\n` +
  `- What hunches are active but untested?\n` +
  `- What commitments exist and are they progressing?\n` +
  `- What tensions or contradictions exist in this space?\n` +
  `- What should be stopped, strengthened, or reframed?\n\n` +
  `Nodes (${nodeLines.split('\n').length}):\n${nodeLines}`;

function bfsConnectedIds(
  startId: string,
  edges: ReadonlyArray<{ readonly source_id: string; readonly target_id: string }>,
  maxDepth: number,
): Set<string> {
  const visited = new Set<string>([startId]);
  let frontier = new Set<string>([startId]);
  for (let depth = 0; depth < maxDepth; depth++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const edge of edges) {
        if (edge.source_id === id && !visited.has(edge.target_id)) next.add(edge.target_id);
        if (edge.target_id === id && !visited.has(edge.source_id)) next.add(edge.source_id);
      }
    }
    if (next.size === 0) break;
    for (const id of next) visited.add(id);
    frontier = next;
  }
  return visited;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { type?: string; value?: string; label?: string };
  try {
    body = await request.json() as { type?: string; value?: string; label?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, value, label } = body;
  if (!type || !label) {
    return NextResponse.json({ error: 'type and label are required' }, { status: 400 });
  }
  if (type !== 'system' && !value) {
    return NextResponse.json({ error: 'value is required for non-system filters' }, { status: 400 });
  }

  type NodeRow = { id: string; title: string; node_type: string; description: string | null };
  let nodes: NodeRow[];

  if (type === 'system') {
    const { data } = await supabase
      .from('nodes')
      .select('id, title, node_type, description')
      .in('status', ['promoted', 'human_reviewed']);
    nodes = (data ?? []) as NodeRow[];
  } else {
    const [{ data: edgesData }, { data: startNode }] = await Promise.all([
      supabase.from('edges').select('source_id, target_id'),
      supabase.from('nodes').select('id, title, node_type, description').eq('id', value!).single(),
    ]);

    if (!startNode) {
      return NextResponse.json({ error: 'Filter node not found' }, { status: 404 });
    }

    const edges = (edgesData ?? []) as Array<{ source_id: string; target_id: string }>;
    const connectedIds = bfsConnectedIds(value!, edges, 3);

    const { data: connectedNodes } = await supabase
      .from('nodes')
      .select('id, title, node_type, description')
      .in('id', [...connectedIds]);
    nodes = (connectedNodes ?? []) as NodeRow[];
  }

  if (nodes.length === 0) {
    return NextResponse.json({ synthesis: `No nodes found connected to ${label} yet.` });
  }

  const nodeLines = nodes
    .map(n => `[${n.node_type}] ${n.title}${n.description ? ': ' + n.description : ''}`)
    .join('\n');

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: process.env.REFLECTION_LLM_MODEL ?? 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT(label),
      messages: [{ role: 'user', content: USER_PROMPT(label, nodeLines) }],
    });

    const synthesis = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return NextResponse.json({ synthesis });
  } catch {
    return NextResponse.json({ error: 'LLM call failed' }, { status: 500 });
  }
}
