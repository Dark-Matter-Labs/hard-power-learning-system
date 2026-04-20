# Filterable System Reflection — Design Spec

**Date:** 2026-04-20  
**Branch:** feature/cof-v06-pipeline  
**Priority:** v0.6 step 7 (after capture simplification + auto-promote)

---

## Overview

Replace the `/review` page entirely with a "System Health" page. The LLM handles routine decisions automatically — only genuine exceptions surface here. The centrepiece is a filterable reflection: Robyn can ask "What's the status of Madrid?" and get a scoped LLM synthesis.

---

## Architecture

`/review/page.tsx` stays a server component. It fetches all data and passes it to a new `SystemHealthClient.tsx` client component that owns reflection filter state and synthesis state. Sections 1, 2, and 4 are static — no client interactivity needed.

### Server fetches (replacing all existing fetches)

| Data | Query |
|------|-------|
| Flagged nodes | `nodes WHERE status = 'flagged_for_review' ORDER BY created_at ASC` |
| Tension alerts | `tension_alerts WHERE status = 'active' ORDER BY created_at DESC` |
| Unprocessed learnings | `nodes WHERE node_type IN ('learning','signal') AND status = 'promoted' ORDER BY created_at DESC` (Process Flow not yet built — shows all; will filter by processed edge once Process Flow ships) |
| Filter: sites | `nodes WHERE node_type = 'site' AND status != 'archived'` |
| Filter: options | `nodes WHERE node_type = 'option' AND status IN ('promoted','human_reviewed')` |
| Filter: goal spaces | `nodes WHERE node_type = 'goal_space' AND status != 'archived'` |

---

## Page Structure

Page title: **"System Health"** (was "Weekly Review")

### Section 1 — Flagged for review

Nodes with `status = 'flagged_for_review'`. These are items the LLM wasn't confident enough to auto-promote.

Each item (`FlaggedItem` component) shows:
- Node title + LLM extraction summary
- Flag reason (from `llm_extraction` maturity field: `watch_closely` | `needs_development` | `cluster_dependent`)
- Three actions: **Accept as-is** (promote), **Edit & promote** (open review form), **Archive**

If empty: show "Nothing flagged — system is running cleanly."

### Section 2 — Tension alerts

Active `tension_alerts`. Same display as current review page tension section. Actions: Acknowledge | Resolve | Investigate.

If empty: omit section entirely.

### Section 3 — System reflection *(filterable)*

Filter selector (grouped dropdown):
```
[Whole system]
── Sites ──        (site nodes — node_type = 'site')
── Options ──      (promoted option nodes, by title)
── Goal spaces ──  (active goal_space nodes, by title)
```

Below the selector: **"Run reflection"** button.

On submit → POST `/api/reflect/analyse` → show loading state → render synthesis inline.

Synthesis persists until filter changes or page reload.

### Section 4 — Unprocessed learnings

Learnings and signals that haven't been run through the Process Flow yet. Each shows title + date + a "Process this" link.

If empty: omit section entirely.

---

## Filterable Reflection API

**Route:** `POST /api/reflect/analyse`

**Request:**
```typescript
interface AnalyseRequest {
  type: 'system' | 'site' | 'option' | 'goal_space';
  value?: string;   // site name, or node ID for option/goal_space
  label: string;    // display name for prompt
}
```

**Node set assembly by filter type:**

| Type | How nodes are collected |
|------|------------------------|
| `system` | All promoted/human_reviewed nodes (existing full-context behaviour) |
| `site` | Start from site node + all nodes reachable via edges within 3 hops |
| `option` | Start node + all nodes reachable via edges within 3 hops |
| `goal_space` | Goal space node + its trigger_outcome children + all nodes connected to those outcomes |

**LLM prompt — filtered mode prefix:**
```
You are running a focused reflection on activity related to: "<label>"

Analyse only the nodes provided. Answer:
- What is the current state of work related to <label>?
- What assumptions are being tested? What results have we seen?
- What hunches are active but untested?
- What commitments exist and are they progressing?
- What tensions or contradictions exist in this space?
- What should be stopped, strengthened, or reframed?

Keep language clean and direct. 3-5 sentences per question maximum.
```

**Response:**
```typescript
interface AnalyseResponse {
  synthesis: string;
}
```

---

## Components

### New / Modified Files

| File | Change |
|------|--------|
| `src/app/review/page.tsx` | Replace all fetches + render with new 4-section structure, pass to SystemHealthClient |
| `src/app/review/SystemHealthClient.tsx` | New client component, owns filter + synthesis state |
| `src/components/review/ReflectionSection.tsx` | New — filter dropdown + Run button + synthesis display |
| `src/components/review/FlaggedItem.tsx` | New — single flagged node row with Accept/Edit/Archive actions |
| `src/app/api/reflect/analyse/route.ts` | New — scoped reflection API |
| `src/app/review/ReflectionPanel.tsx` | **Delete** — absorbed into ReflectionSection |

### API actions for FlaggedItem

- **Accept as-is** → PATCH `/api/nodes/[id]` with `{ status: 'promoted' }`
- **Archive** → PATCH `/api/nodes/[id]` with `{ status: 'archived' }`
- **Edit & promote** → navigate to `/capture/[id]/review`

---

## Error Handling

- Reflection API failure: show inline error message, keep "Run reflection" button active for retry
- Empty filter options (no sites/options/goals in system): show "No filters available yet — add more captures first"
- Flagged item action failure: show inline error on the item, do not remove it from list

---

## Testing

- Unit: `FlaggedItem` renders title, flag reason, three action buttons
- Unit: `ReflectionSection` shows filter dropdown with grouped options, disables button while loading
- Integration: `POST /api/reflect/analyse` with `type='site'` returns non-empty synthesis
- Integration: `POST /api/reflect/analyse` with `type='system'` calls existing reflection context path
- Integration: Accept action on flagged item promotes node and removes it from list
