import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { buildCorrectionPrompt, parseCorrectionActions } from '../agent';
import type { CorrectionNode } from '../agent';

const mockNodes: CorrectionNode[] = [
  { id: 'node-1', node_type: 'hunch', title: 'AI will transform finance', description: 'This is happening' },
  { id: 'node-2', node_type: 'learning', title: 'Old learning', description: 'Outdated info' },
];

describe('buildCorrectionPrompt', () => {
  it('includes all node IDs in the prompt', () => {
    const prompt = buildCorrectionPrompt('Generated text here', mockNodes, 'node-1 is wrong');
    expect(prompt).toContain('node-1');
    expect(prompt).toContain('node-2');
  });

  it('includes the user feedback text', () => {
    const feedback = 'The description is completely incorrect';
    const prompt = buildCorrectionPrompt('Output', mockNodes, feedback);
    expect(prompt).toContain(feedback);
  });

  it('includes the generated text', () => {
    const generated = 'This was the AI output';
    const prompt = buildCorrectionPrompt(generated, mockNodes, 'wrong');
    expect(prompt).toContain(generated);
  });

  it('includes node titles and descriptions', () => {
    const prompt = buildCorrectionPrompt('Output', mockNodes, 'feedback');
    expect(prompt).toContain('AI will transform finance');
    expect(prompt).toContain('Outdated info');
  });
});

describe('parseCorrectionActions', () => {
  it('parses an update action', () => {
    const raw = JSON.stringify({
      reasoning: 'description was wrong',
      actions: [{ action: 'update', node_id: 'node-1', fields: { description: 'corrected' } }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.reasoning).toBe('description was wrong');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ action: 'update', node_id: 'node-1' });
  });

  it('parses an archive action', () => {
    const raw = JSON.stringify({
      reasoning: 'node was irreparably wrong',
      actions: [{ action: 'archive', node_id: 'node-2' }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.actions[0]).toMatchObject({ action: 'archive', node_id: 'node-2' });
  });

  it('parses a create action', () => {
    const raw = JSON.stringify({
      reasoning: 'missing information',
      actions: [{ action: 'create', node_type: 'learning', title: 'New node', description: 'Correct info' }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.actions[0]).toMatchObject({ action: 'create', node_type: 'learning', title: 'New node' });
  });

  it('returns empty actions on invalid JSON', () => {
    const result = parseCorrectionActions('not json {{{');
    expect(result.actions).toEqual([]);
    expect(result.reasoning).toBe('');
  });

  it('returns empty actions when actions field is missing', () => {
    const raw = JSON.stringify({ reasoning: 'something', no_actions: [] });
    const result = parseCorrectionActions(raw);
    expect(result.actions).toEqual([]);
  });
});
