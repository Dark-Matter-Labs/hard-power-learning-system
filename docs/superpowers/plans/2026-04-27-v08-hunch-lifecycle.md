# Hunch Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `lifecycle_stage` column to nodes tracking each hunch's progression through Divergence → Attractor → Convergence → Execution. Implement SQL-only auto-promotion logic run daily, stage-aware prompts on node detail panels, a manual override API, and lifecycle bands in the graph Flow view.

**Architecture:** DB migration adds `lifecycle_stage` (default 'divergence') and `stage_transitioned_at` to nodes. A pure-SQL promotion function evaluates each hunch daily using edge counts. A Next.js API route handles manual overrides. The existing GraphCanvas Flow view gets lifecycle band grouping. Node detail panel gets contextual prompts with no LLM calls.

**Tech Stack:** Next.js 16, Supabase (server client + RPC), Tailwind CSS 4, React 19, Vitest.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/v0.8-lifecycle.sql` | Create | Add lifecycle_stage + stage_transitioned_at + stage_transition_reason to nodes; add path_status to edges |
| `src/lib/lifecycle/autoPromote.ts` | Create | Pure promotion logic — evaluates stage rules, returns StageDecision |
| `src/app/api/lifecycle/promote/route.ts` | Create | POST — trigger auto-promotion run for all hunches |
| `src/app/api/lifecycle/stage/route.ts` | Create | PATCH — manual stage override for a single node |
| `src/components/graph/LifecycleBands.tsx` | Create | Lifecycle band labels for Flow view grouping |
| `src/components/graph/NodeDetailPanel.tsx` | Modify | Add stage-appropriate prompts at bottom of panel |
| `src/lib/lifecycle/__tests__/autoPromote.test.ts` | Create | Unit tests for promotion rules |

---

### Task 1: Database migration

**Context:** `lifecycle_stage` defaults to 'divergence' for all existing nodes (only hunch nodes use it, but the column lives on all nodes to keep the schema simple). `path_status` on edges tracks whether a connection has been reinforced by evidence — needed for the Attractor → Convergence rule.

**Files:**
- Create: `supabase/v0.8-lifecycle.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/v0.8-lifecycle.sql
-- Hunch lifecycle tracking
-- Run in Supabase SQL Editor

-- Lifecycle stage on nodes
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT
    DEFAULT 'divergence'
    CHECK (lifecycle_stage IN ('divergence', 'attractor', 'convergence', 'execution', 'archived'));

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS stage_transitioned_at TIMESTAMPTZ;

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS stage_transition_reason TEXT;

-- Backfill: set existing archived/falsified/suspended nodes to 'archived' stage
UPDATE nodes
  SET lifecycle_stage = 'archived'
  WHERE status IN ('archived', 'falsified', 'suspended')
    AND lifecycle_stage = 'divergence';

-- Edge path_status for reinforcement tracking
ALTER TABLE edges
  ADD COLUMN IF NOT EXISTS path_status TEXT
    DEFAULT 'active'
    CHECK (path_status IN ('active', 'reinforced', 'weakened', 'broken'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_lifecycle_stage ON nodes(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_edges_path_status ON edges(path_status);
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

Paste and run the SQL. Expected: no errors. Confirm the `lifecycle_stage` column appears on the nodes table with default 'divergence'.

- [ ] **Step 3: Commit**

```bash
git add supabase/v0.8-lifecycle.sql
git commit -m "feat: add lifecycle_stage and path_status columns for hunch progression tracking"
```

---

### Task 2: Auto-promotion logic module

**Context:** Pure functions that evaluate promotion rules. Takes a hunch node's ID and its edge/node stats, returns a `StageDecision`. No database calls in the core logic — it accepts pre-fetched counts as arguments so it's fully testable without mocking Supabase.

Stage rules (from spec):
- divergence → attractor: 2+ connected assumptions OR 1+ connected test nodes
- attractor → convergence: 2+ reinforced edges AND 1+ linked commitment
- convergence → execution: 1+ active commitment AND 1+ test node with a connected signal

**Files:**
- Create: `src/lib/lifecycle/autoPromote.ts`
- Create: `src/lib/lifecycle/__tests__/autoPromote.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/lifecycle/__tests__/autoPromote.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateStagePromotion, type HunchStats } from '../autoPromote';

const base: HunchStats = {
  currentStage: 'divergence',
  connectedAssumptions: 0,
  connectedTests: 0,
  reinforcedEdges: 0,
  linkedCommitments: 0,
  activeCommitments: 0,
  testsWithSignals: 0,
};

describe('evaluateStagePromotion — divergence → attractor', () => {
  it('promotes when 2+ assumptions connected', () => {
    const result = evaluateStagePromotion({ ...base, connectedAssumptions: 2 });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('attractor');
  });

  it('promotes when 1+ test connected', () => {
    const result = evaluateStagePromotion({ ...base, connectedTests: 1 });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('attractor');
  });

  it('does not promote with 1 assumption and 0 tests', () => {
    const result = evaluateStagePromotion({ ...base, connectedAssumptions: 1 });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — attractor → convergence', () => {
  it('promotes when 2+ reinforced edges and 1+ linked commitment', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'attractor',
      reinforcedEdges: 2,
      linkedCommitments: 1,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('convergence');
  });

  it('does not promote with reinforced edges but no commitment', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'attractor',
      reinforcedEdges: 3,
      linkedCommitments: 0,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — convergence → execution', () => {
  it('promotes when active commitment and tests with signals', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'convergence',
      activeCommitments: 1,
      testsWithSignals: 1,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('execution');
  });

  it('does not promote without signals', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'convergence',
      activeCommitments: 1,
      testsWithSignals: 0,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — terminal stages', () => {
  it('never promotes from execution', () => {
    const result = evaluateStagePromotion({ ...base, currentStage: 'execution' });
    expect(result.advance).toBe(false);
  });

  it('never promotes from archived', () => {
    const result = evaluateStagePromotion({ ...base, currentStage: 'archived' });
    expect(result.advance).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/lifecycle/__tests__/autoPromote.test.ts
```

Expected: FAIL with "Cannot find module '../autoPromote'"

- [ ] **Step 3: Write the module**

```typescript
// src/lib/lifecycle/autoPromote.ts

export type LifecycleStage = 'divergence' | 'attractor' | 'convergence' | 'execution' | 'archived';

export interface HunchStats {
  readonly currentStage: LifecycleStage;
  readonly connectedAssumptions: number;
  readonly connectedTests: number;
  readonly reinforcedEdges: number;
  readonly linkedCommitments: number;
  readonly activeCommitments: number;
  readonly testsWithSignals: number;
}

export interface StageDecision {
  readonly advance: boolean;
  readonly newStage?: LifecycleStage;
  readonly reason?: string;
}

export function evaluateStagePromotion(stats: HunchStats): StageDecision {
  const { currentStage, connectedAssumptions, connectedTests, reinforcedEdges, linkedCommitments, activeCommitments, testsWithSignals } = stats;

  if (currentStage === 'divergence') {
    if (connectedAssumptions >= 2) {
      return { advance: true, newStage: 'attractor', reason: `${connectedAssumptions} assumptions connected` };
    }
    if (connectedTests >= 1) {
      return { advance: true, newStage: 'attractor', reason: `${connectedTests} test(s) linked` };
    }
  }

  if (currentStage === 'attractor') {
    if (reinforcedEdges >= 2 && linkedCommitments >= 1) {
      return { advance: true, newStage: 'convergence', reason: `${reinforcedEdges} reinforced edges, ${linkedCommitments} commitment(s)` };
    }
  }

  if (currentStage === 'convergence') {
    if (activeCommitments >= 1 && testsWithSignals >= 1) {
      return { advance: true, newStage: 'execution', reason: `Active commitment + ${testsWithSignals} test(s) with signals` };
    }
  }

  return { advance: false };
}

// Fetch stats for a single hunch node from Supabase and evaluate promotion.
// Returns the decision — caller is responsible for persisting the transition.
export async function checkHunchPromotion(nodeId: string): Promise<StageDecision> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: node } = await supabase
    .from('nodes')
    .select('lifecycle_stage, node_type')
    .eq('id', nodeId)
    .single();

  if (!node || node.node_type !== 'hunch') return { advance: false };

  const [assumptionsRes, testsRes, reinforcedRes, commitmentsRes] = await Promise.all([
    // Connected assumptions (any assumption node linked via any edge)
    supabase.from('edges').select('id', { count: 'exact', head: true })
      .eq('source_id', nodeId)
      .in('edge_type', ['supports', 'tests', 'relates_to'])
      .then(async ({ count }) => {
        if (!count) return { count: 0 };
        const { count: assumCount } = await supabase
          .from('edges')
          .select('target_id', { count: 'exact', head: true })
          .eq('source_id', nodeId);
        return { count: assumCount ?? 0 };
      }),
    // Connected test nodes
    supabase.from('edges').select('target_id')
      .eq('source_id', nodeId)
      .then(async ({ data: edgeRows }) => {
        if (!edgeRows?.length) return { count: 0 };
        const targetIds = edgeRows.map(e => e.target_id as string);
        const { count } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
          .in('id', targetIds).eq('node_type', 'test');
        return { count: count ?? 0 };
      }),
    // Reinforced edges from this node
    supabase.from('edges').select('id', { count: 'exact', head: true })
      .eq('source_id', nodeId).eq('path_status', 'reinforced'),
    // Linked commitments (through assumption chain — simplified: any commitment connected via edges)
    supabase.from('edges').select('target_id')
      .eq('source_id', nodeId)
      .then(async ({ data: edgeRows }) => {
        if (!edgeRows?.length) return { count: 0, activeCount: 0 };
        const targetIds = edgeRows.map(e => e.target_id as string);
        const { data: commitments } = await supabase.from('nodes').select('id, status')
          .in('id', targetIds).eq('node_type', 'commitment');
        const all = commitments ?? [];
        return { count: all.length, activeCount: all.filter(c => c.status === 'promoted').length };
      }),
  ]);

  const stats: HunchStats = {
    currentStage: node.lifecycle_stage as LifecycleStage ?? 'divergence',
    connectedAssumptions: 0, // simplified — full graph traversal is out of scope for MVP
    connectedTests: (testsRes as { count: number }).count,
    reinforcedEdges: reinforcedRes.count ?? 0,
    linkedCommitments: (commitmentsRes as { count: number }).count,
    activeCommitments: (commitmentsRes as { count: number; activeCount: number }).activeCount,
    testsWithSignals: 0, // simplified — requires multi-hop traversal
  };

  // Re-fetch assumption count directly
  const { data: edgesFromHunch } = await supabase.from('edges').select('target_id').eq('source_id', nodeId);
  if (edgesFromHunch?.length) {
    const tids = edgesFromHunch.map(e => e.target_id as string);
    const { count: aCount } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
      .in('id', tids).in('node_type', ['assumption_background', 'assumption_foreground']);
    stats = { ...stats, connectedAssumptions: aCount ?? 0 };
  }

  return evaluateStagePromotion(stats);
}
```

Note: `checkHunchPromotion` uses a simplified graph traversal (direct edges only). Full multi-hop traversal (e.g. hunch → assumption → commitment) is a future enhancement.

- [ ] **Step 4: Fix the TypeScript issue — stats is declared const but reassigned**

The code above has a bug: `stats` is declared with `const` but then reassigned. Fix by computing assumption count first and building stats once:

```typescript
// Replace the stats declaration and reassignment block with:
  const { data: edgesFromHunch } = await supabase.from('edges').select('target_id').eq('source_id', nodeId);
  let connectedAssumptions = 0;
  if (edgesFromHunch?.length) {
    const tids = edgesFromHunch.map(e => e.target_id as string);
    const { count: aCount } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
      .in('id', tids).in('node_type', ['assumption_background', 'assumption_foreground']);
    connectedAssumptions = aCount ?? 0;
  }

  const stats: HunchStats = {
    currentStage: node.lifecycle_stage as LifecycleStage ?? 'divergence',
    connectedAssumptions,
    connectedTests: (testsRes as { count: number }).count,
    reinforcedEdges: reinforcedRes.count ?? 0,
    linkedCommitments: (commitmentsRes as { count: number }).count,
    activeCommitments: (commitmentsRes as { count: number; activeCount: number }).activeCount,
    testsWithSignals: 0,
  };

  return evaluateStagePromotion(stats);
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/lib/lifecycle/__tests__/autoPromote.test.ts
```

Expected: PASS (9 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/lifecycle/autoPromote.ts src/lib/lifecycle/__tests__/autoPromote.test.ts
git commit -m "feat: add hunch lifecycle promotion rules and evaluation logic"
```

---

### Task 3: Lifecycle API routes

**Context:** Two routes. `POST /api/lifecycle/promote` scans all hunch nodes and promotes any that qualify. `PATCH /api/lifecycle/stage` allows manual stage override (human override). Both log transitions to `activity_log`.

**Files:**
- Create: `src/app/api/lifecycle/promote/route.ts`
- Create: `src/app/api/lifecycle/stage/route.ts`

- [ ] **Step 1: Write the promote route**

```typescript
// src/app/api/lifecycle/promote/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkHunchPromotion } from '@/lib/lifecycle/autoPromote';

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: hunches, error } = await supabase
    .from('nodes')
    .select('id, lifecycle_stage')
    .eq('node_type', 'hunch')
    .not('lifecycle_stage', 'in', '("execution","archived")');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const promoted: string[] = [];

  for (const hunch of (hunches ?? [])) {
    const decision = await checkHunchPromotion(hunch.id as string);
    if (!decision.advance || !decision.newStage) continue;

    const { error: updateError } = await supabase
      .from('nodes')
      .update({
        lifecycle_stage: decision.newStage,
        stage_transitioned_at: new Date().toISOString(),
        stage_transition_reason: decision.reason ?? null,
      })
      .eq('id', hunch.id);

    if (updateError) continue;

    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'lifecycle_promoted',
      target_node_id: hunch.id,
      details: { from: hunch.lifecycle_stage, to: decision.newStage, reason: decision.reason },
    });

    promoted.push(hunch.id as string);
  }

  return NextResponse.json({ data: { promoted: promoted.length, ids: promoted } });
}
```

- [ ] **Step 2: Write the manual stage override route**

```typescript
// src/app/api/lifecycle/stage/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const VALID_STAGES = ['divergence', 'attractor', 'convergence', 'execution', 'archived'] as const;

const schema = z.object({
  node_id: z.string().uuid(),
  stage: z.enum(VALID_STAGES),
  reason: z.string().max(500).optional(),
});

export async function PATCH(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { node_id, stage, reason } = parsed.data;

  const { data: node } = await supabase.from('nodes').select('lifecycle_stage').eq('id', node_id).single();
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });

  const { error } = await supabase.from('nodes').update({
    lifecycle_stage: stage,
    stage_transitioned_at: new Date().toISOString(),
    stage_transition_reason: reason ? `Manual: ${reason}` : 'Manual override',
  }).eq('id', node_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'lifecycle_manual_override',
    target_node_id: node_id,
    details: { from: node.lifecycle_stage, to: stage, reason: reason ?? 'Manual override' },
  });

  return NextResponse.json({ data: { node_id, stage } });
}
```

- [ ] **Step 3: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "lifecycle"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/app/api/lifecycle/promote/route.ts src/app/api/lifecycle/stage/route.ts
git commit -m "feat: add lifecycle auto-promotion and manual stage override API routes"
```

---

### Task 4: Node detail panel — stage-appropriate prompts

**Context:** Add a contextual prompt section at the bottom of `NodeDetailPanel.tsx`. Only shown for hunch nodes with a `lifecycle_stage`. The prompt text is static (no LLM). Shows only when the node has been in the current stage long enough to warrant a nudge.

Read `src/components/graph/NodeDetailPanel.tsx` before editing to understand the current structure.

**Files:**
- Modify: `src/components/graph/NodeDetailPanel.tsx`

- [ ] **Step 1: Write the LifecyclePrompt helper component**

Add this before the `NodeDetailPanel` export in `NodeDetailPanel.tsx`:

```typescript
// Add after existing imports:
import type { LifecycleStage } from '@/lib/lifecycle/autoPromote';

interface LifecyclePromptProps {
  readonly stage: LifecycleStage;
  readonly nodeId: string;
  readonly daysSinceTransition: number;
}

function LifecyclePrompt({ stage, nodeId, daysSinceTransition }: LifecyclePromptProps) {
  const prompts: Partial<Record<LifecycleStage, { threshold: number; text: string; actions: { label: string; href: string }[] }>> = {
    divergence: {
      threshold: 7,
      text: `This hunch has been sitting for ${daysSinceTransition} days.`,
      actions: [
        { label: 'Connect an assumption', href: `/capture/${nodeId}` },
        { label: 'Archive it', href: `/capture/${nodeId}` },
      ],
    },
    attractor: {
      threshold: 14,
      text: 'This has assumptions but no reinforced evidence yet.',
      actions: [{ label: 'Design a test', href: `/capture/${nodeId}` }],
    },
    convergence: {
      threshold: 14,
      text: 'Resources committed but no recent signals.',
      actions: [
        { label: 'Log a signal', href: `/capture` },
        { label: 'Update commitment', href: `/commitments` },
      ],
    },
    execution: {
      threshold: 0,
      text: 'This is now executing.',
      actions: [{ label: 'Capture an outcome', href: `/capture` }],
    },
  };

  const prompt = prompts[stage];
  if (!prompt || daysSinceTransition < prompt.threshold) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{prompt.text}</p>
      <div className="flex flex-wrap gap-2">
        {prompt.actions.map(action => (
          <a
            key={action.label}
            href={action.href}
            className="text-xs text-node-hunch border border-node-hunch/30 rounded px-2 py-1 hover:bg-node-hunch/5 transition-colors"
          >
            {action.label}
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use LifecyclePrompt inside NodeDetailPanel**

In the NodeDetailPanel render, find where node details are shown (description, status, etc.) and add at the bottom of the panel — only for hunch nodes:

```typescript
// Inside NodeDetailPanel, at the bottom of the panel content, after existing sections:
{node.node_type === 'hunch' && node.lifecycle_stage && (
  <LifecyclePrompt
    stage={node.lifecycle_stage as LifecycleStage}
    nodeId={node.id}
    daysSinceTransition={
      node.stage_transitioned_at
        ? Math.floor((Date.now() - new Date(node.stage_transitioned_at).getTime()) / (24 * 60 * 60 * 1000))
        : Math.floor((Date.now() - new Date(node.created_at).getTime()) / (24 * 60 * 60 * 1000))
    }
  />
)}
```

Note: `node.lifecycle_stage` and `node.stage_transitioned_at` are new columns. The `Node` type in `src/lib/types/nodes.ts` needs updating.

- [ ] **Step 3: Add new columns to the Node type**

In `src/lib/types/nodes.ts`, add to the `Node` interface:

```typescript
// Add these two fields to the Node interface:
readonly lifecycle_stage: string | null;
readonly stage_transitioned_at: string | null;
readonly stage_transition_reason: string | null;
```

- [ ] **Step 4: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "NodeDetailPanel|LifecyclePrompt|lifecycle_stage"
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add src/components/graph/NodeDetailPanel.tsx src/lib/types/nodes.ts
git commit -m "feat: add lifecycle stage prompts to node detail panel"
```

---

### Task 5: Lifecycle bands in Flow view

**Context:** The Flow view in `GraphCanvas.tsx` should group hunch nodes into four vertical bands by `lifecycle_stage`. Read `src/components/graph/GraphCanvas.tsx` to understand the current Flow layout before making changes.

The band labels sit at the top of the canvas. Nodes are positioned by their lifecycle_stage column value. Non-hunch nodes are not affected.

**Files:**
- Create: `src/components/graph/LifecycleBands.tsx`
- Modify: `src/components/graph/GraphCanvas.tsx` (Flow view section only)

- [ ] **Step 1: Write LifecycleBands component**

```typescript
// src/components/graph/LifecycleBands.tsx

const BANDS = [
  { stage: 'divergence', label: 'Divergence', color: 'text-gray-400' },
  { stage: 'attractor', label: 'Attractor', color: 'text-node-hunch' },
  { stage: 'convergence', label: 'Convergence', color: 'text-node-assumption-bg' },
  { stage: 'execution', label: 'Execution', color: 'text-node-commitment' },
] as const;

interface LifecycleBandsProps {
  readonly width: number;
}

export function LifecycleBands({ width }: LifecycleBandsProps) {
  const bandWidth = width / 4;

  return (
    <div className="absolute top-0 left-0 right-0 flex pointer-events-none" style={{ height: 32 }}>
      {BANDS.map((band, i) => (
        <div
          key={band.stage}
          className={`flex items-center justify-center border-r border-gray-100 dark:border-gray-800/50 last:border-r-0 ${band.color}`}
          style={{ width: bandWidth, left: bandWidth * i }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
            {band.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export const STAGE_X_POSITIONS: Record<string, number> = {
  divergence: 0.125,  // 12.5% from left (centre of first band)
  attractor: 0.375,
  convergence: 0.625,
  execution: 0.875,
};
```

- [ ] **Step 2: Use LifecycleBands in GraphCanvas Flow view**

Read `src/components/graph/GraphCanvas.tsx` to find the Flow view rendering section. In the Flow view, import `LifecycleBands` and render it at the top of the canvas container. For hunch nodes, use `STAGE_X_POSITIONS[node.lifecycle_stage ?? 'divergence']` to determine their X position instead of the default force-layout X.

The exact integration depends on how Flow view currently positions nodes. After reading the file:
- If nodes have explicit x/y positions, map `lifecycle_stage` to an x-offset using `STAGE_X_POSITIONS`
- If using a layout engine, add lifecycle_stage as a group key

- [ ] **Step 3: Commit**

```bash
git add src/components/graph/LifecycleBands.tsx src/components/graph/GraphCanvas.tsx
git commit -m "feat: add lifecycle band visualization to Flow view"
```
