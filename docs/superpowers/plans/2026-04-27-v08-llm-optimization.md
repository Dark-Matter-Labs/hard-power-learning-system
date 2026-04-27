# LLM Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce LLM cost by 60–80% through response caching, model routing (Haiku for high-volume agents), and usage monitoring — without changing any user-facing behaviour.

**Architecture:** Wrap `callLLM` in `src/lib/llm/index.ts` with a cache-check-before-call / log-after-call pattern. Cache stored in a new `llm_cache` Supabase table. Usage stored in `llm_usage`. Agent default models updated to use Haiku for extraction, review, and process agents. A settings tab surfaces cost metrics.

**Tech Stack:** Next.js 16, Supabase (server client), Node.js `crypto` module for SHA-256 cache keys, Vitest.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/v0.8-llm-cache.sql` | Create | `llm_cache` table migration |
| `supabase/v0.8-llm-usage.sql` | Create | `llm_usage` table migration |
| `src/lib/llm/cache.ts` | Create | `getCached`, `setCached` functions |
| `src/lib/llm/usage.ts` | Create | `logUsage` function |
| `src/lib/llm/index.ts` | Modify | Update AgentName, model defaults, wrap callLLM with cache + logging |
| `src/app/api/settings/usage/route.ts` | Create | GET endpoint returning usage stats |
| `src/app/settings/UsageTab.tsx` | Create | Settings tab showing cost metrics |
| `src/app/settings/page.tsx` | Modify | Add Usage tab |
| `src/lib/llm/__tests__/cache.test.ts` | Create | Unit tests for cache helpers |
| `src/lib/llm/__tests__/usage.test.ts` | Create | Unit tests for usage logging |

---

### Task 1: Database migrations

**Context:** Two new tables. `llm_cache` stores LLM responses keyed by SHA-256 hash of (agent + systemPrompt + userMessage). `llm_usage` logs every LLM call for cost monitoring. Both run standard RLS.

**Files:**
- Create: `supabase/v0.8-llm-cache.sql`
- Create: `supabase/v0.8-llm-usage.sql`

- [ ] **Step 1: Write the cache table migration**

```sql
-- supabase/v0.8-llm-cache.sql
-- LLM response cache to avoid duplicate calls
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS llm_cache (
  cache_key    TEXT PRIMARY KEY,
  agent        TEXT NOT NULL,
  model        TEXT NOT NULL,
  response     JSONB NOT NULL,          -- serialised LLMResponse
  input_tokens INT,
  output_tokens INT,
  expires_at   TIMESTAMPTZ,            -- NULL means never expire
  hit_count    INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_agent ON llm_cache(agent);
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_cache(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE llm_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read llm_cache"
  ON llm_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage llm_cache"
  ON llm_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Write the usage table migration**

```sql
-- supabase/v0.8-llm-usage.sql
-- Per-call LLM usage log for cost monitoring
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS llm_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent         TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cached        BOOLEAN NOT NULL DEFAULT false,
  user_id       UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_agent ON llm_usage(agent);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user ON llm_usage(user_id);

ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read llm_usage"
  ON llm_usage FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert llm_usage"
  ON llm_usage FOR INSERT TO authenticated WITH CHECK (true);
```

- [ ] **Step 3: Run both migrations in Supabase SQL Editor**

Open Supabase → SQL Editor → paste and run `supabase/v0.8-llm-cache.sql`, then `supabase/v0.8-llm-usage.sql`.

Expected: no errors, tables appear in the Table Editor.

- [ ] **Step 4: Commit migration files**

```bash
git add supabase/v0.8-llm-cache.sql supabase/v0.8-llm-usage.sql
git commit -m "feat: add llm_cache and llm_usage tables for cost optimisation"
```

---

### Task 2: LLM cache module

**Context:** `getCached` checks for a non-expired cache entry by SHA-256 key. `setCached` stores a response. Both dynamically import the Supabase server client (so they work in API route context without being imported at module load time — avoids issues with Next.js cookie context). Failures are non-fatal: a cache miss is always safe.

The cache key is `SHA-256(agent + ":" + systemPrompt + ":" + userMessage)` — deterministic, collision-resistant, cheap.

**Files:**
- Create: `src/lib/llm/cache.ts`
- Create: `src/lib/llm/__tests__/cache.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/llm/__tests__/cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashRequest, isExpired } from '../cache';

describe('hashRequest', () => {
  it('returns a 64-character hex string', () => {
    const key = hashRequest('extraction', 'sys prompt', 'user message');
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[a-f0-9]+$/);
  });

  it('returns the same key for the same inputs', () => {
    const a = hashRequest('extraction', 'sys', 'msg');
    const b = hashRequest('extraction', 'sys', 'msg');
    expect(a).toBe(b);
  });

  it('returns different keys for different agents', () => {
    const a = hashRequest('extraction', 'sys', 'msg');
    const b = hashRequest('review', 'sys', 'msg');
    expect(a).not.toBe(b);
  });

  it('returns different keys for different messages', () => {
    const a = hashRequest('extraction', 'sys', 'msg1');
    const b = hashRequest('extraction', 'sys', 'msg2');
    expect(a).not.toBe(b);
  });
});

describe('isExpired', () => {
  it('returns false for null expiresAt (never expires)', () => {
    expect(isExpired(null)).toBe(false);
  });

  it('returns true for past date', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it('returns false for future date', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isExpired(future)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/llm/__tests__/cache.test.ts
```

Expected: FAIL with "Cannot find module '../cache'"

- [ ] **Step 3: Write the cache module**

```typescript
// src/lib/llm/cache.ts
import { createHash } from 'crypto';
import type { LLMResponse } from './index';

export interface CacheEntry {
  readonly response: LLMResponse;
  readonly expires_at: string | null;
  readonly hit_count: number;
}

// TTL per agent in milliseconds. null = never expire.
const CACHE_TTL_MS: Record<string, number | null> = {
  extraction: null,
  review: null,
  process: null,
  reflection: 7 * 24 * 60 * 60 * 1000,
  create: 24 * 60 * 60 * 1000,
  setup: 24 * 60 * 60 * 1000,
  query: 24 * 60 * 60 * 1000,
};

// Agents that should have responses cached
const CACHED_AGENTS = new Set(['extraction', 'review', 'process', 'reflection', 'setup']);

export function hashRequest(agent: string, systemPrompt: string, userMessage: string): string {
  return createHash('sha256')
    .update(`${agent}:${systemPrompt}:${userMessage}`)
    .digest('hex');
}

export function isExpired(expiresAt: string | null): boolean {
  if (expiresAt === null) return false;
  return new Date(expiresAt) < new Date();
}

export function shouldCache(agent: string): boolean {
  return CACHED_AGENTS.has(agent);
}

export function computeExpiresAt(agent: string): string | null {
  const ttlMs = CACHE_TTL_MS[agent] ?? null;
  if (ttlMs === null) return null;
  return new Date(Date.now() + ttlMs).toISOString();
}

export async function getCached(cacheKey: string): Promise<LLMResponse | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('llm_cache')
      .select('response, expires_at')
      .eq('cache_key', cacheKey)
      .single();
    if (error || !data) return null;
    if (isExpired(data.expires_at as string | null)) return null;
    // Increment hit count fire-and-forget
    supabase.from('llm_cache').update({ hit_count: (data as { hit_count?: number }).hit_count ?? 0 + 1 }).eq('cache_key', cacheKey).then(() => {});
    return data.response as LLMResponse;
  } catch {
    return null;
  }
}

export async function setCached(cacheKey: string, agent: string, model: string, response: LLMResponse): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    await supabase.from('llm_cache').upsert({
      cache_key: cacheKey,
      agent,
      model,
      response,
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
      expires_at: computeExpiresAt(agent),
      hit_count: 0,
    });
  } catch {
    // non-fatal: cache write failure doesn't break the LLM call
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/llm/__tests__/cache.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/cache.ts src/lib/llm/__tests__/cache.test.ts
git commit -m "feat: add LLM cache module with SHA-256 keying and per-agent TTL"
```

---

### Task 3: LLM usage logging module

**Context:** Logs every LLM call (agent, model, tokens, whether it was a cache hit) to the `llm_usage` table. Non-fatal — a logging failure must never break the LLM call. User ID comes from the Supabase auth context.

**Files:**
- Create: `src/lib/llm/usage.ts`
- Create: `src/lib/llm/__tests__/usage.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/llm/__tests__/usage.test.ts
import { describe, it, expect } from 'vitest';
import { estimateCostMicroCents } from '../usage';

describe('estimateCostMicroCents', () => {
  it('estimates cost for Haiku model', () => {
    // Haiku: $0.00025/1k input, $0.00125/1k output
    // 1000 input + 1000 output = $0.00025 + $0.00125 = $0.0015 = 150 micro-cents
    const cost = estimateCostMicroCents('claude-haiku-4-5-20251001', 1000, 1000);
    expect(cost).toBe(150);
  });

  it('estimates cost for Sonnet model', () => {
    // Sonnet: $0.003/1k input, $0.015/1k output
    // 1000 input + 1000 output = $0.003 + $0.015 = $0.018 = 1800 micro-cents
    const cost = estimateCostMicroCents('claude-sonnet-4-6', 1000, 1000);
    expect(cost).toBe(1800);
  });

  it('returns 0 for cached calls (no token cost)', () => {
    const cost = estimateCostMicroCents('claude-sonnet-4-6', 0, 0);
    expect(cost).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/llm/__tests__/usage.test.ts
```

Expected: FAIL with "Cannot find module '../usage'"

- [ ] **Step 3: Write the usage module**

```typescript
// src/lib/llm/usage.ts
import type { LLMResponse } from './index';

// Cost in micro-cents per 1k tokens (1 micro-cent = $0.00001)
const MODEL_COSTS: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'claude-haiku-4-5-20251001': { inputPer1k: 25, outputPer1k: 125 },  // $0.00025/$0.00125
  'claude-sonnet-4-6': { inputPer1k: 300, outputPer1k: 1500 },         // $0.003/$0.015
  'claude-sonnet-4-20250514': { inputPer1k: 300, outputPer1k: 1500 },
  'claude-opus-4-7': { inputPer1k: 1500, outputPer1k: 7500 },          // $0.015/$0.075
};

export function estimateCostMicroCents(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] ?? { inputPer1k: 300, outputPer1k: 1500 };
  return Math.round((inputTokens / 1000) * costs.inputPer1k + (outputTokens / 1000) * costs.outputPer1k);
}

export async function logUsage(
  agent: string,
  model: string,
  response: LLMResponse,
  cached: boolean
): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    await supabase.from('llm_usage').insert({
      agent,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cached,
      user_id: user?.id ?? null,
    });
  } catch {
    // non-fatal
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/llm/__tests__/usage.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/usage.ts src/lib/llm/__tests__/usage.test.ts
git commit -m "feat: add LLM usage logging with per-model cost estimation"
```

---

### Task 4: Update callLLM — model routing, cache, usage logging

**Context:** Modify `src/lib/llm/index.ts` to:
1. Add 'query' and 'digest' to `AgentName` union (needed by other parts of the system)
2. Add per-agent default model constants — Haiku for extraction/review/process, Sonnet for reflection/query/create/setup/digest
3. Before each LLM call: check cache (if agent is cacheable), return cached response if hit
4. After each LLM call: log to `llm_usage`

The streaming query in `/api/query/route.ts` calls Anthropic SDK directly (not via `callLLM`), so it won't be affected by these changes.

**Files:**
- Modify: `src/lib/llm/index.ts`

- [ ] **Step 1: Write the updated index.ts**

```typescript
// src/lib/llm/index.ts
import { hashRequest, getCached, setCached, shouldCache } from './cache';
import { logUsage } from './usage';

export interface LLMConfig {
  readonly provider: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
}

export interface LLMRequest {
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly pdfBase64?: string;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage?: { readonly input_tokens: number; readonly output_tokens: number };
}

// Default model per agent. All overridable via environment variables.
const AGENT_DEFAULT_MODELS: Record<string, string> = {
  extraction: 'claude-haiku-4-5-20251001',
  review: 'claude-haiku-4-5-20251001',
  process: 'claude-haiku-4-5-20251001',
  reflection: 'claude-sonnet-4-6',
  create: 'claude-sonnet-4-6',
  setup: 'claude-sonnet-4-6',
  query: 'claude-sonnet-4-6',
  digest: 'claude-sonnet-4-6',
};

export type AgentName = 'extraction' | 'review' | 'create' | 'reflection' | 'process' | 'setup' | 'query' | 'digest';

function getAgentConfig(agent: AgentName): LLMConfig {
  const prefix = agent.toUpperCase();
  return {
    provider: process.env[`${prefix}_LLM_PROVIDER`] ?? 'anthropic',
    model: process.env[`${prefix}_LLM_MODEL`] ?? AGENT_DEFAULT_MODELS[agent] ?? 'claude-sonnet-4-6',
    apiKey: process.env[`${prefix}_LLM_API_KEY`] ?? process.env.ANTHROPIC_API_KEY,
    baseUrl: process.env[`${prefix}_LLM_BASE_URL`],
  };
}

async function callProvider(config: LLMConfig, request: LLMRequest): Promise<LLMResponse> {
  switch (config.provider) {
    case 'anthropic': {
      const { callAnthropic } = await import('./providers/anthropic');
      return callAnthropic(config, request);
    }
    default: {
      const { callStub } = await import('./providers/stub');
      return callStub(config, request);
    }
  }
}

export async function callLLM(agent: AgentName, request: LLMRequest): Promise<LLMResponse> {
  const config = getAgentConfig(agent);

  if (shouldCache(agent)) {
    const cacheKey = hashRequest(agent, request.systemPrompt, request.userMessage);
    const cached = await getCached(cacheKey);
    if (cached) {
      await logUsage(agent, config.model, cached, true);
      return cached;
    }

    const response = await callProvider(config, request);
    await Promise.all([
      setCached(cacheKey, agent, config.model, response),
      logUsage(agent, config.model, response, false),
    ]);
    return response;
  }

  const response = await callProvider(config, request);
  await logUsage(agent, config.model, response, false);
  return response;
}
```

- [ ] **Step 2: Run existing LLM tests**

```bash
npx vitest run src/lib/llm/__tests__/
```

Expected: PASS (existing tests pass — the function signature hasn't changed)

- [ ] **Step 3: Run the full setup agent tests to verify extraction agent still works**

```bash
npx vitest run src/lib/agents/__tests__/setup.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/llm/index.ts
git commit -m "feat: add model routing and cache/usage wrapping to callLLM — extraction/review/process now default to Haiku"
```

---

### Task 5: Settings usage API route

**Context:** `GET /api/settings/usage` returns aggregate LLM usage stats for the current month. Used by the Settings Usage tab. Queries the `llm_usage` table.

**Files:**
- Create: `src/app/api/settings/usage/route.ts`
- Create: `src/app/api/settings/usage/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/settings/usage/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    from: mockFrom,
  }),
}));

describe('GET /api/settings/usage', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({
          data: [
            { agent: 'extraction', model: 'claude-haiku-4-5-20251001', input_tokens: 500, output_tokens: 200, cached: false },
            { agent: 'extraction', model: 'claude-haiku-4-5-20251001', input_tokens: 0, output_tokens: 0, cached: true },
          ],
          error: null,
        }),
      }),
    });
  });

  it('returns 200 with usage data', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { totalCalls: number; cachedCalls: number } };
    expect(body.data.totalCalls).toBe(2);
    expect(body.data.cachedCalls).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/settings/usage/__tests__/route.test.ts
```

Expected: FAIL with "Cannot find module '../route'"

- [ ] **Step 3: Write the route**

```typescript
// src/app/api/settings/usage/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { estimateCostMicroCents } from '@/lib/llm/usage';

interface UsageRow {
  agent: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached: boolean;
}

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data, error } = await supabase
    .from('llm_usage')
    .select('agent, model, input_tokens, output_tokens, cached')
    .gte('created_at', monthStart);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as UsageRow[];
  const totalCalls = rows.length;
  const cachedCalls = rows.filter(r => r.cached).length;
  const totalInputTokens = rows.reduce((sum, r) => sum + r.input_tokens, 0);
  const totalOutputTokens = rows.reduce((sum, r) => sum + r.output_tokens, 0);
  const estimatedCostMicroCents = rows.reduce((sum, r) => sum + estimateCostMicroCents(r.model, r.input_tokens, r.output_tokens), 0);

  const byAgent: Record<string, { calls: number; inputTokens: number; outputTokens: number; cachedCalls: number }> = {};
  for (const row of rows) {
    if (!byAgent[row.agent]) byAgent[row.agent] = { calls: 0, inputTokens: 0, outputTokens: 0, cachedCalls: 0 };
    byAgent[row.agent].calls += 1;
    byAgent[row.agent].inputTokens += row.input_tokens;
    byAgent[row.agent].outputTokens += row.output_tokens;
    if (row.cached) byAgent[row.agent].cachedCalls += 1;
  }

  return NextResponse.json({
    data: {
      totalCalls,
      cachedCalls,
      cacheHitRate: totalCalls > 0 ? Math.round((cachedCalls / totalCalls) * 100) : 0,
      totalInputTokens,
      totalOutputTokens,
      estimatedCostCents: Math.round(estimatedCostMicroCents / 100),
      byAgent,
    },
  });
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/app/api/settings/usage/__tests__/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/usage/route.ts src/app/api/settings/usage/__tests__/route.test.ts
git commit -m "feat: add /api/settings/usage endpoint for LLM cost monitoring"
```

---

### Task 6: Settings usage tab component

**Context:** Add a "Usage" tab to the existing settings page. Shows this month's LLM call count, token totals, estimated cost in $, cache hit rate, and a breakdown by agent. Fetches from `/api/settings/usage` on mount.

Read `src/app/settings/page.tsx` before editing to understand its current structure.

**Files:**
- Create: `src/app/settings/UsageTab.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Write UsageTab component**

```typescript
// src/app/settings/UsageTab.tsx
'use client';

import { useState, useEffect } from 'react';

interface AgentStats {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedCalls: number;
}

interface UsageData {
  totalCalls: number;
  cachedCalls: number;
  cacheHitRate: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostCents: number;
  byAgent: Record<string, AgentStats>;
}

export function UsageTab() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/usage')
      .then(r => r.json() as Promise<{ data?: UsageData; error?: string }>)
      .then(body => {
        if (body.data) setData(body.data);
        else setError(body.error ?? 'Failed to load usage data');
      })
      .catch(() => setError('Failed to load usage data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading usage data…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-red-500">{error ?? 'No data'}</p>;
  }

  const costDollars = (data.estimatedCostCents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">This month</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total calls', value: data.totalCalls.toLocaleString() },
            { label: 'Cache hit rate', value: `${data.cacheHitRate}%` },
            { label: 'Tokens used', value: (data.totalInputTokens + data.totalOutputTokens).toLocaleString() },
            { label: 'Estimated cost', value: `$${costDollars}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-gray-800 dark:text-gray-200">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By agent</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500 text-left border-b border-gray-100 dark:border-gray-800">
              <th className="pb-2 font-medium">Agent</th>
              <th className="pb-2 font-medium text-right">Calls</th>
              <th className="pb-2 font-medium text-right">Cache hits</th>
              <th className="pb-2 font-medium text-right">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {Object.entries(data.byAgent)
              .sort(([, a], [, b]) => b.calls - a.calls)
              .map(([agent, stats]) => (
                <tr key={agent}>
                  <td className="py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">{agent}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">{stats.calls}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">{stats.cachedCalls}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">
                    {(stats.inputTokens + stats.outputTokens).toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the Usage tab to settings/page.tsx**

Read `src/app/settings/page.tsx` first to understand the current tab structure.

The settings page likely has tabs or sections. Add a "Usage" tab/section that renders `<UsageTab />`. Exactly where depends on the current structure — find the section list or tab component and append:

```typescript
// Import at top of settings/page.tsx:
import { UsageTab } from './UsageTab';

// Add to the tabs/sections list wherever the other settings sections are:
// The exact location depends on what's already there. Add a new tab entry for "Usage"
// and render <UsageTab /> when that tab is active.
```

If the settings page is a simple list of sections (not a tabbed UI), add at the bottom:

```tsx
<section>
  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">LLM Usage</h2>
  <UsageTab />
</section>
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "settings|UsageTab|usage"
```

Expected: no output (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/UsageTab.tsx src/app/settings/page.tsx
git commit -m "feat: add LLM usage tab to settings — cost monitoring for this month"
```
