import { callLLM } from '@/lib/llm';
import { STEP_AGENTS, STEP_NAMES } from './agents';

interface PortfolioSummary {
  readonly title: string;
  readonly description: string | null;
}

interface StepSummary {
  readonly step_number: number;
  readonly step_name: string;
  readonly content: Record<string, unknown>;
  readonly status: string;
}

export function buildStepContext(portfolio: PortfolioSummary, completedSteps: StepSummary[]): string {
  const lines: string[] = [
    `Portfolio: ${portfolio.title}`,
    portfolio.description ? `Description: ${portfolio.description}` : '',
    '',
  ];

  const complete = completedSteps.filter(s => s.status === 'complete');
  if (complete.length > 0) {
    lines.push('## Prior steps (completed)');
    for (const step of complete) {
      const text = typeof step.content.text === 'string' ? step.content.text : JSON.stringify(step.content);
      lines.push(`\n### Step ${step.step_number}: ${step.step_name}`);
      lines.push(text);
    }
  }

  return lines.filter(l => l !== null).join('\n');
}

export async function generateStepContent(portfolioId: string, stepNumber: number): Promise<string> {
  const agent = STEP_AGENTS[stepNumber];
  if (!agent?.implemented) {
    throw new Error(`Step ${stepNumber} agent not yet implemented`);
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('title, description')
    .eq('id', portfolioId)
    .single();

  if (!portfolio) throw new Error(`Portfolio ${portfolioId} not found`);

  const { data: steps } = await supabase
    .from('portfolio_steps')
    .select('step_number, step_name, content, status')
    .eq('portfolio_id', portfolioId)
    .lt('step_number', stepNumber)
    .order('step_number', { ascending: true });

  const context = buildStepContext(
    { title: portfolio.title as string, description: portfolio.description as string | null },
    (steps ?? []) as StepSummary[]
  );

  const userMessage = `${context}\n\n---\nNow complete Step ${stepNumber}: ${STEP_NAMES[stepNumber]}`;

  const response = await callLLM('portfolio', {
    systemPrompt: agent.systemPrompt,
    userMessage,
    maxTokens: 2048,
  });

  return response.content;
}
