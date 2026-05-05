import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAfter = vi.fn((fn: () => Promise<void>) => { void fn(); });
const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  from: mockFrom,
};

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: mockAfter };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock('@/lib/correction/agent', () => ({
  applyCorrection: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('returns 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no user') });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', feedback_text: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing feedback_text)', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid source_type', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'invalid', source_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', feedback_text: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when source record not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', feedback_text: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('inserts feedback and returns 201 for newsletter source', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'n1', content: 'newsletter content', node_refs: ['node-a'] },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'fb-1', created_at: '2026-05-05T00:00:00Z' },
          error: null,
        }),
      });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', feedback_text: 'wrong info' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string };
    expect(body.id).toBe('fb-1');
  });

  it('calls after() to schedule background correction', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'n1', content: 'newsletter content', node_refs: [] },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'fb-1', created_at: '2026-05-05T00:00:00Z' },
          error: null,
        }),
      });
    const { POST } = await import('../route');
    const req = new Request('http://test/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ source_type: 'newsletter', source_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', feedback_text: 'something is wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(req);
    expect(mockAfter).toHaveBeenCalledOnce();
  });
});
