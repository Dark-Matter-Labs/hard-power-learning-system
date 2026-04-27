# Automated Signal Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate signal discovery from two sources — web search for seeded topics, and DML's MCP integrations (Slack, Google Drive, Notion) — with hard governance limits and human review gates before signals reach the graph.

**Architecture:** All auto-generated signals enter the graph with `status = 'flagged_for_review'`. A hard cap of 20 signals/day prevents flooding. Pre-filtering (keyword match against active topics) runs before any LLM call. A settings tab lets users enable/disable sources and configure which channels/folders/databases to monitor.

**DEPENDENCY:** This plan requires the LLM Optimization plan (`2026-04-27-v08-llm-optimization.md`) to be fully implemented first — specifically the cache layer and model routing. Without that, every batch extraction call will be expensive.

**Tech Stack:** Next.js 16, Supabase, Brave Search API (web scanner), MCP SDK (Slack/Drive/Notion), Vitest.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/v0.8-auto-signals.sql` | Create | `auto_signal_sources` + `seen_external_urls` tables |
| `src/lib/signals/relevanceFilter.ts` | Create | Keyword pre-filter — runs before any LLM call |
| `src/lib/signals/webScanner.ts` | Create | Web search for seeded topics via Brave Search API |
| `src/lib/signals/mcpScanner.ts` | Create | Slack/Drive/Notion content ingestion via MCP |
| `src/lib/signals/signalIngestor.ts` | Create | Shared ingestion pipeline: pre-filter → batch LLM → create nodes |
| `src/app/api/signals/scan/route.ts` | Create | POST — trigger a scan run (called by cron or manually) |
| `src/app/api/signals/sources/route.ts` | Create | GET/POST/PATCH — manage auto_signal_sources |
| `src/app/settings/AutoSignalsTab.tsx` | Create | Settings UI for configuring signal sources |
| `src/lib/signals/__tests__/relevanceFilter.test.ts` | Create | Tests for keyword matching |
| `src/lib/signals/__tests__/signalIngestor.test.ts` | Create | Tests for deduplication + governance cap |

---

### Task 1: Database migrations

**Context:** `auto_signal_sources` records which topics to monitor and which source (web, slack, drive, notion). `seen_external_urls` deduplicates web content so the same article isn't processed twice.

**Files:**
- Create: `supabase/v0.8-auto-signals.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/v0.8-auto-signals.sql
-- Automated signal ingestion infrastructure
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS auto_signal_sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type    TEXT NOT NULL CHECK (source_type IN ('web', 'slack', 'drive', 'notion', 'rss')),
  topic_node_id  UUID REFERENCES nodes(id) ON DELETE CASCADE,
  config         JSONB NOT NULL DEFAULT '{}',
  -- For web: { "search_query": "...", "keywords": ["..."] }
  -- For slack: { "channel_id": "...", "channel_name": "#..." }
  -- For drive: { "folder_id": "...", "folder_name": "..." }
  -- For notion: { "database_id": "...", "database_name": "..." }
  enabled        BOOLEAN NOT NULL DEFAULT true,
  last_run_at    TIMESTAMPTZ,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_signal_sources_topic ON auto_signal_sources(topic_node_id);
CREATE INDEX IF NOT EXISTS idx_auto_signal_sources_enabled ON auto_signal_sources(enabled) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS seen_external_urls (
  url             TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL,
  topic_node_id   UUID REFERENCES nodes(id) ON DELETE SET NULL,
  signal_node_id  UUID REFERENCES nodes(id) ON DELETE SET NULL,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seen_urls_topic ON seen_external_urls(topic_node_id);

-- Daily auto-signal quota tracking
CREATE TABLE IF NOT EXISTS auto_signal_quota (
  quota_date     DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  signals_created INT NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE auto_signal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_external_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_signal_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage auto_signal_sources"
  ON auto_signal_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read seen_external_urls"
  ON seen_external_urls FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert seen_external_urls"
  ON seen_external_urls FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can manage auto_signal_quota"
  ON auto_signal_quota FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Expected: no errors. Confirm three new tables appear.

- [ ] **Step 3: Commit**

```bash
git add supabase/v0.8-auto-signals.sql
git commit -m "feat: add auto_signal_sources, seen_external_urls, auto_signal_quota tables"
```

---

### Task 2: Relevance pre-filter

**Context:** Before sending any content to an LLM, check if it's relevant to at least one active topic using keyword matching. This is the primary cost-control mechanism — irrelevant content never reaches the LLM. Topics come from active `goal_space`, `option`, and `site` node titles.

**Files:**
- Create: `src/lib/signals/relevanceFilter.ts`
- Create: `src/lib/signals/__tests__/relevanceFilter.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/signals/__tests__/relevanceFilter.test.ts
import { describe, it, expect } from 'vitest';
import { extractKeywords, isRelevant, scoreRelevance } from '../relevanceFilter';

describe('extractKeywords', () => {
  it('splits title into lowercase words, filters short words', () => {
    const keywords = extractKeywords('Formation Capital Strategy');
    expect(keywords).toContain('formation');
    expect(keywords).toContain('capital');
    expect(keywords).toContain('strategy');
    expect(keywords).not.toContain('of'); // too short
  });

  it('handles multiple topics', () => {
    const keywords = extractKeywords('Dartmoor Rewilding Project', 'Natural Assets Fund');
    expect(keywords).toContain('dartmoor');
    expect(keywords).toContain('rewilding');
    expect(keywords).toContain('natural');
    expect(keywords).toContain('assets');
  });
});

describe('isRelevant', () => {
  const keywords = ['formation', 'capital', 'rewilding', 'dartmoor'];

  it('returns true when content contains a keyword', () => {
    expect(isRelevant('New formation capital fund announced', keywords)).toBe(true);
  });

  it('returns false when no keywords match', () => {
    expect(isRelevant('Football scores for the weekend', keywords)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isRelevant('DARTMOOR national park', keywords)).toBe(true);
  });

  it('returns false for empty content', () => {
    expect(isRelevant('', keywords)).toBe(false);
  });
});

describe('scoreRelevance', () => {
  it('returns 0 for no matches', () => {
    expect(scoreRelevance('unrelated content', ['formation', 'capital'])).toBe(0);
  });

  it('returns higher score for more keyword matches', () => {
    const score1 = scoreRelevance('formation fund', ['formation', 'capital', 'fund']);
    const score2 = scoreRelevance('formation capital fund', ['formation', 'capital', 'fund']);
    expect(score2).toBeGreaterThan(score1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/signals/__tests__/relevanceFilter.test.ts
```

Expected: FAIL with "Cannot find module '../relevanceFilter'"

- [ ] **Step 3: Write the module**

```typescript
// src/lib/signals/relevanceFilter.ts

const MIN_KEYWORD_LENGTH = 4;

export function extractKeywords(...titles: string[]): string[] {
  return [...new Set(
    titles
      .join(' ')
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length >= MIN_KEYWORD_LENGTH)
  )];
}

export function isRelevant(content: string, keywords: string[]): boolean {
  if (!content || keywords.length === 0) return false;
  const lower = content.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export function scoreRelevance(content: string, keywords: string[]): number {
  if (!content || keywords.length === 0) return 0;
  const lower = content.toLowerCase();
  return keywords.filter(kw => lower.includes(kw)).length;
}

export function filterRelevant<T>(
  items: ReadonlyArray<T>,
  getText: (item: T) => string,
  keywords: string[],
  limit: number
): T[] {
  return items
    .map(item => ({ item, score: scoreRelevance(getText(item), keywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/signals/__tests__/relevanceFilter.test.ts
```

Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/signals/relevanceFilter.ts src/lib/signals/__tests__/relevanceFilter.test.ts
git commit -m "feat: add keyword relevance pre-filter for signal ingestion cost control"
```

---

### Task 3: Shared signal ingestor — deduplication, governance cap, node creation

**Context:** The ingestor is called by both the web scanner and MCP scanner. It handles: (1) deduplication against `seen_external_urls`, (2) the 20-signal daily cap checked against `auto_signal_quota`, (3) creating signal nodes with `status = 'flagged_for_review'` and a source attribution stored in `content` JSONB.

**Files:**
- Create: `src/lib/signals/signalIngestor.ts`
- Create: `src/lib/signals/__tests__/signalIngestor.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/signals/__tests__/signalIngestor.test.ts
import { describe, it, expect } from 'vitest';
import { checkDailyQuota, buildSignalNode } from '../signalIngestor';

describe('checkDailyQuota', () => {
  it('allows signals when under the cap', () => {
    expect(checkDailyQuota(15, 20)).toBe(true);
  });

  it('blocks signals when at or over the cap', () => {
    expect(checkDailyQuota(20, 20)).toBe(false);
    expect(checkDailyQuota(25, 20)).toBe(false);
  });
});

describe('buildSignalNode', () => {
  it('creates a node with flagged_for_review status', () => {
    const node = buildSignalNode({
      title: 'Rewilding news',
      summary: 'New study on rewilding impacts',
      sourceType: 'web',
      sourceAttribution: 'https://example.com/article',
      topicNodeId: 'topic-1',
      authorId: 'user-1',
    });
    expect(node.status).toBe('flagged_for_review');
    expect(node.node_type).toBe('signal');
    expect((node.content as { source_attribution: string }).source_attribution).toBe('https://example.com/article');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/signals/__tests__/signalIngestor.test.ts
```

Expected: FAIL with "Cannot find module '../signalIngestor'"

- [ ] **Step 3: Write the module**

```typescript
// src/lib/signals/signalIngestor.ts

const DAILY_CAP = 20;

export interface SignalInput {
  readonly title: string;
  readonly summary: string;
  readonly sourceType: 'web' | 'slack' | 'drive' | 'notion';
  readonly sourceAttribution: string;
  readonly topicNodeId: string;
  readonly authorId: string;
}

export interface SignalNodeRow {
  readonly node_type: 'signal';
  readonly title: string;
  readonly description: string;
  readonly status: 'flagged_for_review';
  readonly confidence_level: 2;
  readonly confidence_basis: 'observation';
  readonly hunch_type: 'external_validation';
  readonly author_id: string;
  readonly content: {
    readonly source_type: string;
    readonly source_attribution: string;
    readonly topic_node_id: string;
    readonly auto_generated: true;
  };
}

export function checkDailyQuota(currentCount: number, cap = DAILY_CAP): boolean {
  return currentCount < cap;
}

export function buildSignalNode(input: SignalInput): SignalNodeRow {
  return {
    node_type: 'signal',
    title: input.title,
    description: input.summary,
    status: 'flagged_for_review',
    confidence_level: 2,
    confidence_basis: 'observation',
    hunch_type: 'external_validation',
    author_id: input.authorId,
    content: {
      source_type: input.sourceType,
      source_attribution: input.sourceAttribution,
      topic_node_id: input.topicNodeId,
      auto_generated: true,
    },
  };
}

// Called by web/MCP scanners to persist signal nodes with governance checks.
export async function ingestSignals(signals: SignalInput[]): Promise<{ created: number; skipped: number }> {
  if (signals.length === 0) return { created: 0, skipped: 0 };

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  // Check daily quota
  const today = new Date().toISOString().slice(0, 10);
  const { data: quotaRow } = await supabase
    .from('auto_signal_quota')
    .select('signals_created')
    .eq('quota_date', today)
    .single();

  const currentCount = quotaRow?.signals_created ?? 0;
  const remaining = DAILY_CAP - currentCount;

  if (remaining <= 0) return { created: 0, skipped: signals.length };

  const toProcess = signals.slice(0, remaining);
  const nodes = toProcess.map(buildSignalNode);

  const { error } = await supabase.from('nodes').insert(nodes);
  if (error) return { created: 0, skipped: signals.length };

  // Update quota
  await supabase.from('auto_signal_quota').upsert({
    quota_date: today,
    signals_created: currentCount + toProcess.length,
  });

  return { created: toProcess.length, skipped: signals.length - toProcess.length };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/signals/__tests__/signalIngestor.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/signals/signalIngestor.ts src/lib/signals/__tests__/signalIngestor.test.ts
git commit -m "feat: add signal ingestor with daily quota cap and flagged_for_review status"
```

---

### Task 4: Web scanner

**Context:** Searches the web for active topics using the Brave Search API (`BRAVE_SEARCH_API_KEY` env var). Deduplicates against `seen_external_urls`. Runs keyword pre-filter before LLM. Sends passing articles in batches of 5 to the extraction agent (which now uses Haiku after the LLM optimization plan).

Brave Search API endpoint: `https://api.search.brave.com/res/v1/web/search?q={query}&count=10`
Authorization header: `X-Subscription-Token: {BRAVE_SEARCH_API_KEY}`

**Files:**
- Create: `src/lib/signals/webScanner.ts`

- [ ] **Step 1: Write webScanner.ts**

```typescript
// src/lib/signals/webScanner.ts
import { extractKeywords, filterRelevant } from './relevanceFilter';
import { ingestSignals, type SignalInput } from './signalIngestor';
import { callLLM } from '@/lib/llm';

interface BraveResult {
  readonly title: string;
  readonly url: string;
  readonly description: string;
}

interface BraveResponse {
  readonly web?: {
    readonly results?: BraveResult[];
  };
}

interface ActiveTopic {
  readonly id: string;
  readonly title: string;
  readonly node_type: string;
}

export async function scanWebForTopics(userId: string): Promise<{ created: number; skipped: number; errors: string[] }> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return { created: 0, skipped: 0, errors: ['BRAVE_SEARCH_API_KEY not configured'] };
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  // Get active topics from enabled web sources
  const { data: sources } = await supabase
    .from('auto_signal_sources')
    .select('id, topic_node_id, config')
    .eq('source_type', 'web')
    .eq('enabled', true);

  if (!sources?.length) return { created: 0, skipped: 0, errors: [] };

  const topicIds = sources.map(s => s.topic_node_id as string).filter(Boolean);
  const { data: topicNodes } = await supabase
    .from('nodes')
    .select('id, title, node_type')
    .in('id', topicIds)
    .neq('status', 'archived');

  const topics = (topicNodes ?? []) as ActiveTopic[];
  const keywords = extractKeywords(...topics.map(t => t.title));

  const allSignals: SignalInput[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    const config = source.config as { search_query?: string };
    const query = config.search_query ?? topics.find(t => t.id === source.topic_node_id)?.title ?? '';
    if (!query) continue;

    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
        { headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' } }
      );
      if (!res.ok) { errors.push(`Brave search failed for "${query}": ${res.status}`); continue; }

      const data = await res.json() as BraveResponse;
      const results = data.web?.results ?? [];

      // Deduplicate against seen URLs
      const unseenResults: BraveResult[] = [];
      for (const result of results) {
        const { data: seen } = await supabase
          .from('seen_external_urls')
          .select('url')
          .eq('url', result.url)
          .single();
        if (!seen) unseenResults.push(result);
      }

      // Pre-filter by relevance
      const relevant = filterRelevant(unseenResults, r => `${r.title} ${r.description}`, keywords, 5);
      if (!relevant.length) continue;

      // Record as seen
      await supabase.from('seen_external_urls').insert(
        relevant.map(r => ({ url: r.url, source_type: 'web', topic_node_id: source.topic_node_id }))
      );

      // Batch extraction: one LLM call for up to 5 articles
      const batchContent = relevant.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`).join('\n\n');
      const extractionResult = await callLLM('extraction', {
        systemPrompt: 'Extract relevant signals from these web articles. For each article, output JSON: {"signals": [{"title": "...", "summary": "..."}]}. Focus on concrete findings, data, or developments relevant to the query topic. Skip articles without clear substance.',
        userMessage: `Topic: "${query}"\n\nArticles:\n${batchContent}`,
        maxTokens: 1024,
      });

      type ExtractionOutput = { signals?: { title: string; summary: string }[] };
      let extracted: { title: string; summary: string }[] = [];
      try {
        const parsed = JSON.parse(extractionResult.content) as ExtractionOutput;
        extracted = parsed.signals ?? [];
      } catch {
        // non-fatal: malformed JSON from LLM
      }

      for (const e of extracted) {
        allSignals.push({
          title: e.title,
          summary: e.summary,
          sourceType: 'web',
          sourceAttribution: relevant[0]?.url ?? query,
          topicNodeId: source.topic_node_id as string,
          authorId: userId,
        });
      }
    } catch (err) {
      errors.push(`Web scan error for "${query}": ${String(err)}`);
    }

    // Update last_run_at
    await supabase.from('auto_signal_sources').update({ last_run_at: new Date().toISOString() }).eq('id', source.id);
  }

  const result = await ingestSignals(allSignals);
  return { ...result, errors };
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "webScanner"
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/lib/signals/webScanner.ts
git commit -m "feat: add web scanner — Brave Search API with pre-filter and batched LLM extraction"
```

---

### Task 5: Scan API route and Settings UI

**Context:** `POST /api/signals/scan` triggers a scan run. The settings `AutoSignalsTab` lets users enable/disable sources and add new ones (pointing to specific Slack channels, Drive folders, or Notion databases). For the MVP, MCP scanning is a stub that returns empty — the infrastructure is in place, users can configure sources, but live MCP reads require actual MCP server connections that depend on the deployment environment.

**Files:**
- Create: `src/app/api/signals/scan/route.ts`
- Create: `src/app/api/signals/sources/route.ts`
- Create: `src/app/settings/AutoSignalsTab.tsx`

- [ ] **Step 1: Write the scan route**

```typescript
// src/app/api/signals/scan/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { scanWebForTopics } from '@/lib/signals/webScanner';

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await scanWebForTopics(user.id);
  return NextResponse.json({ data: result });
}
```

- [ ] **Step 2: Write the sources route**

```typescript
// src/app/api/signals/sources/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createSchema = z.object({
  source_type: z.enum(['web', 'slack', 'drive', 'notion']),
  topic_node_id: z.string().uuid(),
  config: z.record(z.unknown()),
});

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('auto_signal_sources')
    .select('id, source_type, topic_node_id, config, enabled, last_run_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { data, error } = await supabase.from('auto_signal_sources').insert({
    ...parsed.data,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, enabled } = body as { id?: string; enabled?: boolean };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase.from('auto_signal_sources')
    .update({ enabled: enabled ?? true }).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

- [ ] **Step 3: Write AutoSignalsTab**

```typescript
// src/app/settings/AutoSignalsTab.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface SignalSource {
  id: string;
  source_type: string;
  topic_node_id: string;
  config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
}

export function AutoSignalsTab() {
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{ created: number; skipped: number } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/signals/sources')
      .then(r => r.json() as Promise<{ data?: SignalSource[] }>)
      .then(body => setSources(body.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSource = (id: string, enabled: boolean) => {
    fetch('/api/signals/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    }).then(() => load());
  };

  const runScan = () => {
    setScanning(true);
    fetch('/api/signals/scan', { method: 'POST' })
      .then(r => r.json() as Promise<{ data?: { created: number; skipped: number } }>)
      .then(body => setLastScanResult(body.data ?? null))
      .finally(() => setScanning(false));
  };

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Auto-signals</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Maximum 20 signals/day. All auto-signals require human review before joining the graph.
          </p>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          className="px-3 py-1.5 text-xs bg-node-hunch text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {scanning ? 'Scanning…' : 'Run scan now'}
        </button>
      </div>

      {lastScanResult && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
          Last scan: {lastScanResult.created} signal{lastScanResult.created === 1 ? '' : 's'} created,{' '}
          {lastScanResult.skipped} skipped (quota or duplicate)
        </div>
      )}

      {sources.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No auto-signal sources configured. Sources are added automatically when you enable web scanning for a topic node.
        </p>
      ) : (
        <ul className="space-y-2">
          {sources.map(source => (
            <li key={source.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {source.source_type} — {(source.config.search_query as string | undefined) ?? source.topic_node_id}
                </p>
                {source.last_run_at && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Last run: {new Date(source.last_run_at).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">{source.enabled ? 'On' : 'Off'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={source.enabled}
                  onClick={() => toggleSource(source.id, !source.enabled)}
                  className={`w-8 h-4 rounded-full transition-colors ${source.enabled ? 'bg-node-hunch' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`block w-3 h-3 bg-white rounded-full shadow transition-transform mx-0.5 ${source.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add AutoSignalsTab to settings/page.tsx**

Read `src/app/settings/page.tsx`. Import and add `<AutoSignalsTab />` in a new section:

```typescript
import { AutoSignalsTab } from './AutoSignalsTab';

// In the JSX, add a new section:
<section>
  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Auto-signals</h2>
  <AutoSignalsTab />
</section>
```

- [ ] **Step 5: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "signals|AutoSignals"
```

Expected: no output

- [ ] **Step 6: Commit**

```bash
git add src/app/api/signals/scan/route.ts src/app/api/signals/sources/route.ts src/app/settings/AutoSignalsTab.tsx src/app/settings/page.tsx
git commit -m "feat: add signal scan API route and auto-signals settings tab"
```
