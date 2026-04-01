---
plan: 10-01
phase: 10
status: complete
completed: 2026-04-01
---

# Plan 10-01: CAPTURE_TYPES Shared Config + Capture Page Rename

## Objective
Create a shared CAPTURE_TYPES configuration that both the capture page and the inline graph card consume, and rename the capture page title from "Capture a Hunch" to "Capture".

## What Was Built

### Task 1: Create CAPTURE_TYPES shared config
- Created `src/lib/config/captureTypes.ts` with typed entries for all 11 capture types (10 existing + `meeting_notes`)
- Exported `CAPTURE_TYPES` const array, `getCaptureType()`, `getInlineTypes()`, `getPageTypes()` helpers
- `meeting_notes` type has `multiNodeExtraction: true` and `fields: ['meeting_date', 'participants']`
- `getInlineTypes()` filters out multi-node types; `getPageTypes()` returns all

### Task 2: Wire shared config into components
- `src/components/graph/InlineCaptureCard.tsx` — now imports `getInlineTypes()` from `captureTypes.ts`, replaced local NODE_TYPES array
- `src/components/capture/QuickCaptureForm.tsx` — now imports `getPageTypes()` from `captureTypes.ts`
- `src/app/capture/page.tsx` — heading renamed from "Capture a Hunch" to "Capture" with proper dark mode classes preserved

## Key Files
- **Created:** `src/lib/config/captureTypes.ts`
- **Modified:** `src/components/graph/InlineCaptureCard.tsx`, `src/components/capture/QuickCaptureForm.tsx`, `src/app/capture/page.tsx`

## Decisions Made
- `getInlineTypes()` excludes `multiNodeExtraction: true` types — keeps inline card simple
- `getPageTypes()` returns all types — full capture page handles the meeting notes flow
- Dark mode classes preserved on heading rename (`text-gray-800 dark:text-gray-200`)

## Requirements Covered
- CAPT-05: Capture page title renamed to "Capture" ✓
- CAPT-06: Shared CAPTURE_TYPES config used by both capture page and inline graph card ✓

## Self-Check: PASSED
