---
phase: 13-edit-nodes-connections
plan: "02"
subsystem: graph-ui
tags: [connection-management, edge-api, node-search, tdd]
dependency_graph:
  requires: [EDIT-01, 13-01]
  provides: [EDIT-02, EDIT-03, delete-edge-api, node-search-all-types, NodeSearchAutocomplete]
  affects: [NodeDetailPanel, GraphOSSurface, nodes-search-route]
tech_stack:
  added: []
  patterns: [tdd-red-green, immutable-state-updates, optimistic-ui-updates]
key_files:
  created:
    - src/app/api/edges/[id]/route.ts
    - src/components/shared/NodeSearchAutocomplete.tsx
  modified:
    - src/app/api/nodes/search/route.ts
    - src/components/graph/NodeDetailPanel.tsx
    - src/components/graph/GraphOSSurface.tsx
    - src/components/graph/__tests__/NodeDetailPanel.test.tsx
decisions:
  - "Remove button uses opacity-0 group-hover:opacity-100 pattern — visible on hover only to reduce visual noise"
  - "addEdgeType state typed as string (not literal union) to allow select onChange assignment without type gymnastics"
  - "Direction toggle resets to addIsSourceFirst=true on edge type change to avoid stale direction state"
  - "Connection list rendered in view mode only (not edit mode) to keep edit form focused on node fields"
  - "Connections section always renders (no conditional on connections.length) in view mode to keep Add connection button always accessible"
metrics:
  duration: "18min"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 6
requirements_completed: [EDIT-02, EDIT-03]
---

# Phase 13 Plan 02: Connection Management in NodeDetailPanel Summary

**One-liner:** DELETE /api/edges/[id] route + NodeSearchAutocomplete (all node types) + NodeDetailPanel connection list with Remove buttons and Add connection form wired through GraphOSSurface edge state callbacks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | DELETE route + search fix + NodeSearchAutocomplete + failing tests | ac101c3 | src/app/api/edges/[id]/route.ts, src/app/api/nodes/search/route.ts, src/components/shared/NodeSearchAutocomplete.tsx, NodeDetailPanel.test.tsx |
| 2 (GREEN) | Implement connection list + add form in NodeDetailPanel + GraphOSSurface wiring | c895723 | NodeDetailPanel.tsx, GraphOSSurface.tsx |

## What Was Built

**DELETE /api/edges/[id]** (`src/app/api/edges/[id]/route.ts`):
- Auth-gated via `supabase.auth.getUser()`
- `params` awaited as `Promise<{ id: string }>` per Next.js 16 convention
- Deletes edge by id, returns 204 No Content on success

**Updated /api/nodes/search** (`src/app/api/nodes/search/route.ts`):
- `type` param is now truly optional — when absent, searches all node types
- When `type` provided, filters with `.eq('node_type', type)` as before
- PersonAutocomplete still works (passes `&type=person`)

**NodeSearchAutocomplete** (`src/components/shared/NodeSearchAutocomplete.tsx`):
- Single-select (not multi-select like PersonAutocomplete)
- Props: `selectedNode`, `onChange`, `excludeNodeId`, `placeholder`
- Fetches `/api/nodes/search?q=...` (no type — searches all node types)
- Filters out `excludeNodeId` from results (prevents self-connection)
- Shows `node_type` as subtle label next to each suggestion
- Identical Tailwind styling and dark mode support to PersonAutocomplete

**NodeDetailPanel connection management** (`src/components/graph/NodeDetailPanel.tsx`):
- `onEdgeAdded?: (edge: Edge) => void` and `onEdgeRemoved?: (edgeId: string) => void` props added
- EDGE_TYPES constant defined inline (16 types: supports, contradicts, requires, evolved_from, tested_by, produced, connected_to, works_at, authored_by, challenges, advances_goal, targets_outcome, indicates_progress, assigned_to_outcome, participated_in, mentioned_in)
- Connection list with hover Remove button (opacity-0 group-hover:opacity-100) — calls DELETE /api/edges/{id}
- Add connection form (inline, below connections list): NodeSearchAutocomplete + edge type select + direction toggle + Confirm/Cancel
- Direction toggle hidden when undirected type (connected_to) selected
- Duplicate edge error shows "This connection already exists"
- `+ Add connection` button always visible in view mode

**GraphOSSurface wiring** (`src/components/graph/GraphOSSurface.tsx`):
- `onEdgeAdded`: `edge => setEdges(prev => [...prev, edge])` — immutable append
- `onEdgeRemoved`: `edgeId => setEdges(prev => prev.filter(e => e.id !== edgeId))` — immutable filter

## Test Results

- NodeDetailPanel tests: 25/25 passing (16 from Plan 01 + 9 new connection management tests)
- Build: SUCCESS — /api/edges/[id] and /api/graph/edges both registered

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues

- `src/app/review/__tests__/ReviewPage.test.tsx` — 6 pre-existing failures from merged codebase (supabase mock missing `.limit()` chain after `.order()`). Out of scope for this plan.

## Self-Check: PASSED

- `src/app/api/edges/[id]/route.ts` — FOUND
- `src/components/shared/NodeSearchAutocomplete.tsx` — FOUND
- `src/app/api/nodes/search/route.ts` — FOUND (modified)
- `src/components/graph/NodeDetailPanel.tsx` — FOUND (modified)
- `src/components/graph/GraphOSSurface.tsx` — FOUND (modified)
- Commit ac101c3 — FOUND (RED: DELETE route + search fix + NodeSearchAutocomplete + failing tests)
- Commit c895723 — FOUND (GREEN: connection list + add form implementation)
