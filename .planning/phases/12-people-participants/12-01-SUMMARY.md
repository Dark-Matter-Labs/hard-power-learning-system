---
phase: 12-people-participants
plan: 01
subsystem: ui, api
tags: [autocomplete, person-nodes, edges, supabase, react, next.js]

# Dependency graph
requires:
  - phase: 11-date-timeline
    provides: "Person node type already in DB schema"
provides:
  - "GET /api/nodes/search — debounced person search endpoint"
  - "PersonAutocomplete component — chip-based autocomplete for person nodes"
  - "participated_in edges created automatically on capture save"
  - "EDGE_COLORS updated with participated_in and mentioned_in"
affects: [12-02-people-participants, future capture UX phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Debounced fetch in useEffect with debounceRef for cleanup"
    - "Click-outside detection via containerRef + mousedown listener"
    - "Chip-based multi-select: ReadonlyArray of {id, title} with immutable onChange"

key-files:
  created:
    - src/app/api/nodes/search/route.ts
    - src/components/capture/PersonAutocomplete.tsx
  modified:
    - src/components/graph/GraphCanvas.tsx
    - src/components/capture/QuickCaptureForm.tsx
    - src/app/capture/page.tsx
    - src/app/api/capture/route.ts

key-decisions:
  - "Kept existing participants plain-text field as comma-joined titles fallback — backward compat with content.participants"
  - "Edge creation happens synchronously before fire-and-forget extraction to ensure graph is connected immediately"
  - "Suggestions filtered client-side to exclude already-selected people before rendering dropdown"

patterns-established:
  - "PersonAutocomplete: ReadonlyArray props + immutable onChange pattern — no internal mutation"
  - "Search route: q param required (400 if missing), type param optional defaulting to person"

requirements-completed: [PEOP-01, PEOP-02]

# Metrics
duration: 20min
completed: 2026-04-01
---

# Phase 12 Plan 01: People Participants Summary

**PersonAutocomplete component with debounced /api/nodes/search and automatic participated_in edge creation on capture save**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-01T09:33:00Z
- **Completed:** 2026-04-01T09:53:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created GET /api/nodes/search with auth check, ilike query, and type filter defaulting to person
- Built PersonAutocomplete React component: 300ms debounced fetch, suggestions dropdown, removable chips, click-outside close
- Updated EDGE_COLORS in GraphCanvas with participated_in and mentioned_in (grey, same as authored_by)
- Wired PersonAutocomplete into QuickCaptureForm replacing the plain text participants input
- Capture POST handler creates participated_in edges synchronously for all selected person IDs before LLM extraction fires

## Task Commits

Each task was committed atomically:

1. **Task 1: Person search API + PersonAutocomplete component + EDGE_COLORS update** - `c31e1af` (feat)
2. **Task 2: Wire autocomplete into capture form + create edges on save** - `44c042a` (feat)

**Plan metadata:** committed in final docs commit

## Files Created/Modified
- `src/app/api/nodes/search/route.ts` - GET search endpoint: q + type params, auth, ilike, limit 10
- `src/components/capture/PersonAutocomplete.tsx` - Chip-based autocomplete with debounced fetch and click-outside
- `src/components/graph/GraphCanvas.tsx` - Added participated_in and mentioned_in to EDGE_COLORS
- `src/components/capture/QuickCaptureForm.tsx` - Replaced plain text participants input with PersonAutocomplete; added participant_ids to CaptureFormData
- `src/app/capture/page.tsx` - Extract participant_ids from formData and pass to API body
- `src/app/api/capture/route.ts` - Destructure participant_ids, insert participated_in edges per selected person

## Decisions Made
- Kept backward compat: participants field still receives comma-joined titles for content.participants storage; participant_ids carries the IDs for edge creation
- Edges created before fire-and-forget extraction so graph connections are immediate and don't depend on LLM completion
- Suggestions filtered client-side to exclude already-selected people (no server-side exclusion needed given small limit)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in test files (missing vitest types in tsconfig). These are out-of-scope and unrelated to this plan's changes. No errors in production code.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- PEOP-01 and PEOP-02 complete: participants autocomplete and edge creation fully wired
- Phase 12-02 can now build on participated_in edges and the mentioned_in edge type (already in EDGE_COLORS) for the extraction agent people tagging feature

## Self-Check: PASSED

- FOUND: src/app/api/nodes/search/route.ts
- FOUND: src/components/capture/PersonAutocomplete.tsx
- FOUND: .planning/phases/12-people-participants/12-01-SUMMARY.md
- FOUND: commit c31e1af (Task 1)
- FOUND: commit 44c042a (Task 2)

---
*Phase: 12-people-participants*
*Completed: 2026-04-01*
