# Simplified Review Design Spec

**Date:** 2026-04-21
**Branch:** main (worktree: cof-v06-pipeline)

---

## Overview

Replace the per-field-tick-box `ReviewCard` with a lightweight `SimpleReviewClient` — read-only LLM summary, optional free-text note, and two buttons: Promote or Archive. The LLM's classifications are trusted without human override.

---

## Motivation

Robyn's feedback: "Kill type selector. Kill manual review tick-boxes. Auto-promote ready items, only flag uncertain ones." The LLM already auto-promotes `ready_to_promote` nodes. The friction is the `flagged_for_review` path, where `ReviewCard` presents per-field acceptance UI that the primary user doesn't want to interact with.

---

## Architecture

Two changes, all contained to the review feature:

1. **`/capture/[id]/review/page.tsx`** — simplified. Remove `handleSaveDraft`. Replace `handlePromote(review: HumanReview)` with `handlePromote(note: string)` which auto-accepts all LLM connections and goal relevance. Keep meeting notes list path unchanged.

2. **New `SimpleReviewClient` component** — replaces `ReviewCard` for single-node review. Receives the node and callbacks, renders the summary + note + buttons.

**Files:**
| Action | File |
|---|---|
| Modify | `src/lib/types/nodes.ts` |
| Modify | `src/app/capture/[id]/review/page.tsx` |
| Delete | `src/components/review/ReviewCard.tsx` |
| Create | `src/components/review/SimpleReviewClient.tsx` |
| Create | `src/components/review/__tests__/SimpleReviewClient.test.tsx` |

---

## `HumanReview` Type Change

Add an optional `note` field to the existing `HumanReview` interface:

```ts
export interface HumanReview {
  readonly reviewed_at: string;
  readonly reviewer_id: string;
  readonly note?: string;                    // human amendment — supplements LLM summary
  readonly fields: Readonly<Record<string, {
    readonly action: 'accepted' | 'rejected' | 'edited';
    readonly original: unknown;
    readonly final: unknown;
  }>>;
  readonly connections_accepted: ReadonlyArray<{
    readonly target_node_id: string;
    readonly target_title: string;
    readonly edge_type: string;
  }>;
  readonly connections_rejected: readonly string[];
  readonly connections_added: ReadonlyArray<{
    readonly target_node_id: string;
    readonly edge_type: string;
  }>;
}
```

No database migration needed — `human_review` column is already `JSONB`.

---

## `page.tsx` Changes

The page stays a client component (uses `useParams`, `useRouter`, Supabase client).

### Remove
- `handleSaveDraft` — "Save as Draft" path is eliminated
- The `HumanReview` import from `@/lib/types/nodes` (replaced by simpler inline object)

### Replace `handlePromote(review: HumanReview)` with `handlePromote(note: string)`

```ts
const handlePromote = async (note: string) => {
  setIsSubmitting(true);
  try {
    const supabase = createClient();
    const nodeId = params.id as string;

    const humanReview: HumanReview = {
      reviewed_at: new Date().toISOString(),
      reviewer_id: node.author_id ?? '',
      note: note.trim() || undefined,
      fields: {},
      connections_accepted: [],
      connections_rejected: [],
      connections_added: [],
    };

    await supabase
      .from('nodes')
      .update({ human_review: humanReview, status: 'promoted' })
      .eq('id', nodeId);

    // Auto-accept all LLM-suggested connections
    const suggested = node.llm_extraction?.suggested_connections ?? [];
    if (suggested.length > 0) {
      const { data: allNodes } = await supabase
        .from('nodes')
        .select('id, title')
        .in('status', ['promoted', 'human_reviewed'])
        .neq('id', nodeId);

      if (allNodes && allNodes.length > 0) {
        const edges = suggested
          .map(conn => {
            const target = findBestMatch(conn.target_title, allNodes);
            if (!target) return null;
            return { source_id: nodeId, target_id: target.id, edge_type: conn.edge_type, weight: 1 };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);

        if (edges.length > 0) {
          await supabase.from('edges').insert(edges);
        }
      }
    }

    // Auto-accept all goal relevance suggestions
    const goalRelevance = node.llm_extraction?.goal_relevance ?? [];
    if (goalRelevance.length > 0) {
      const goalEdges = goalRelevance.map(gr => ({
        source_id: nodeId,
        target_id: gr.outcome_id,
        edge_type: 'targets_outcome',
        weight: 1,
      }));
      await supabase.from('edges').insert(goalEdges);
    }

    await supabase.from('activity_log').insert({
      action: 'promoted',
      target_node_id: nodeId,
      details: { from_status: node.status },
    });

    router.push('/capture');
  } finally {
    setIsSubmitting(false);
  }
};
```

### Keep
- `handleArchive` — unchanged (updates status to `'archived'`, logs, redirects)
- Meeting notes list path — unchanged (links to child node review pages)
- `findBestMatch` and `STOP_WORDS` helpers — still used for auto-connection

### Updated render (non-meeting-notes path)

Replace `<ReviewCard ... />` with:

```tsx
<SimpleReviewClient
  node={node}
  onPromote={handlePromote}
  onArchive={handleArchive}
  isSubmitting={isSubmitting}
/>
```

### Already-actioned state

Add before the main render. Only `promoted` and `archived` are terminal — `human_reviewed` nodes (previously saved as draft) should still go through the promote/archive flow normally:

```tsx
if (node.status === 'promoted' || node.status === 'archived') {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center">
      <p className="text-gray-400">
        This entry has already been {node.status}.
      </p>
      <Link href="/capture" className="text-sm text-[#185FA5] mt-2 inline-block">
        Back to capture
      </Link>
    </div>
  );
}
```

---

## `SimpleReviewClient` Component

### Location
`src/components/review/SimpleReviewClient.tsx`

### Props
```ts
interface SimpleReviewClientProps {
  readonly node: Node;
  readonly onPromote: (note: string) => Promise<void>;
  readonly onArchive: () => Promise<void>;
  readonly isSubmitting: boolean;
}
```

### Layout

Single card, four sections top to bottom:

**1. Type + maturity badge row**

Display `node.node_type` as a human label and `llm_extraction.maturity` as a small muted badge:

| `node_type` | Label |
|---|---|
| `hunch` | Hunch |
| `assumption_background` | Background Assumption |
| `assumption_foreground` | Active Assumption |
| `test` | Test |
| `signal` | Signal |
| `learning` | Learning |
| `option` | Option |
| anything else | capitalise and display as-is |

| `maturity` | Badge text |
|---|---|
| `watch_closely` | Watch closely |
| `needs_development` | Needs development |
| `cluster_dependent` | Cluster dependent |
| anything else | omit badge |

**2. LLM summary fields (read-only)**

- **Title** — `node.title` (semibold, larger)
- **Summary** — `llm_extraction.summary` (muted paragraph)
- **Structured claim** — if `llm_extraction.structured_claim` is present, show `if / then / because` as three labelled lines
- **Confidence** — `llm_extraction.confidence_assessment.level` displayed as `1–5` with basis label (e.g. "3 / 5 · intuition")
- **Domain tags** — `llm_extraction.domain_tags` as small badges

**3. Note field**

```tsx
<textarea
  value={note}
  onChange={e => setNote(e.target.value)}
  placeholder="Add a note to supplement this entry (optional)"
  rows={3}
  className="w-full ..."
/>
```

Local `note` state, initialised to `''`.

**4. Action buttons**

```tsx
<button onClick={() => onPromote(note)} disabled={isSubmitting}>
  {isSubmitting ? 'Saving…' : 'Promote'}
</button>
<button onClick={onArchive} disabled={isSubmitting}>
  Archive
</button>
```

Error state: if `onPromote` or `onArchive` throws, show `"Failed — try again"` below buttons. Both buttons re-enabled.

Since `isSubmitting` is managed by the parent page, `SimpleReviewClient` additionally tracks a local `error: string | null` state for the failure message.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Node still processing (`raw`/`processing`) | "This entry is still being processed" message with back link |
| Node already actioned (`promoted`/`archived`) | Read-only notice with back link |
| Promote API fails | Inline "Failed — try again" below buttons; buttons re-enabled |
| Archive API fails | Same inline error |
| No LLM connections found to auto-accept | Silent — no edges inserted, promotion succeeds |

---

## Deleted files

The following files are deleted — all are only imported by `ReviewCard.tsx` (or their own test files):

| File | Reason |
|---|---|
| `src/components/review/ReviewCard.tsx` | Replaced by SimpleReviewClient |
| `src/components/review/ConfidenceSlider.tsx` | ReviewCard-only sub-component |
| `src/components/review/ConnectionSuggestion.tsx` | ReviewCard-only sub-component |
| `src/components/review/DomainTagEditor.tsx` | ReviewCard-only sub-component |
| `src/components/review/ExtractionField.tsx` | ReviewCard-only sub-component |
| `src/components/review/GoalRelevanceField.tsx` | ReviewCard-only sub-component |
| `src/components/review/__tests__/ReviewCard.test.tsx` | Tests for deleted component |
| `src/components/review/__tests__/GoalRelevanceField.test.tsx` | Tests for deleted component |

`FlaggedItem.tsx` and `ReflectionSection.tsx` are **kept** — they are used by the System Health page, not by ReviewCard.

---

## Testing

### `SimpleReviewClient` unit tests

- Renders node type label, maturity badge, summary, structured claim, confidence, domain tags from node data
- Note textarea accepts and stores input
- Promote button calls `onPromote` with the note string
- Archive button calls `onArchive`
- Both buttons show disabled + "Saving…" while `isSubmitting` is true
- Shows "Failed — try again" when `onPromote` rejects
- Shows "Failed — try again" when `onArchive` rejects

### `page.tsx` integration

The existing page tests (if any) should be updated to replace `ReviewCard` mock with `SimpleReviewClient` mock.

---

## Out of Scope

- Changing the auto-promotion logic for `ready_to_promote` nodes (already works)
- Meeting notes review path (unchanged)
- The `/api/nodes/[id]` PATCH endpoint (unchanged)
- Any capture form changes (type selector already absent)
