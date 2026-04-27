import { describe, it, expect, vi } from 'vitest';

vi.mock('../providers/anthropic', () => ({
  callAnthropic: vi.fn().mockResolvedValue({
    content: 'ok',
    model: 'claude-test',
    usage: { input_tokens: 1, output_tokens: 1 },
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

import { callLLM } from '../index';

describe('callLLM', () => {
  it('accepts setup as a valid agent name', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const result = await callLLM('setup', {
      systemPrompt: 'You are a setup helper.',
      userMessage: 'Help me set up.',
    });
    expect(result.content).toBe('ok');
  });
});
