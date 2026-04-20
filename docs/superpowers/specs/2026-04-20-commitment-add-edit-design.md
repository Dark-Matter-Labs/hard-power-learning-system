# Commitment Add & Edit — Design Spec

**Date:** 2026-04-20
**Branch:** main (worktree: cof-v06-pipeline)

---

## Overview

The `/commitments` page is currently read-only. This feature adds an inline add form at the top of the page and inline editing on each `CommitmentCard`.

---

## Architecture

Two changes, all contained to the commitments feature:

1. **`CommitmentsClient`** — gains local `commitments` state (initialised from server props), `editingId: string | null`, and `isAdding: boolean`. All mutations are optimistic: update local state immediately, call API in background, revert on error.

2. **New `CommitmentCardEditor` component** — renders in place of `CommitmentCard` when `editingId === commitment.id`.

3. **Inline add form** — compact row at the top of the page with a text input and Add button.

**Files:**
- Create: `src/components/commitment/CommitmentCardEditor.tsx`
- Modify: `src/app/commitments/CommitmentsClient.tsx`
- Create: `src/components/commitment/__tests__/CommitmentCardEditor.test.tsx`

---

## CommitmentsClient Changes

### State

```ts
const [commitments, setCommitments] = useState<Node[]>(() => [...initialCommitments]);
const [editingId, setEditingId] = useState<string | null>(null);
const [addTitle, setAddTitle] = useState('');
const [addError, setAddError] = useState<string | null>(null);
```

### Add form

Sits above all hierarchy content. A single row: controlled text input (placeholder "New commitment…") + "Add" button.

On submit:
```ts
async function handleAdd() {
  const res = await fetch('/api/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: addTitle.trim(), node_type: 'commitment' }),
  });
  if (!res.ok) {
    setAddError('Failed to add commitment');
    return;
  }
  const { node } = await res.json();
  setCommitments(prev => [node, ...prev]);
  setAddTitle('');
  setAddError(null);
}
```

On error: show "Failed to add commitment" below the input. Keep `addTitle` so text is not lost.

### Edit

Each `CommitmentCard` renders with a pencil icon (visible on hover). Clicking it calls `setEditingId(c.id)`.

When `editingId === c.id`, render `CommitmentCardEditor` instead of `CommitmentCard`.

```ts
async function handleSave(id: string, updates: CommitmentUpdates) {
  const res = await fetch(`/api/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: updates.title,
      description: updates.description,
      content: updates.content,
    }),
  });
  if (!res.ok) throw new Error('Failed to save');
  const updated: Node = await res.json();
  setCommitments(prev => prev.map(c => c.id === id ? updated : c));
  setEditingId(null);
}
```

On error: `CommitmentCardEditor` catches the thrown error and shows "Failed to save" inline. Stays in edit mode.

Cancel: `setEditingId(null)` — no API call.

The hierarchy rebuild (edge traversal) already runs at render time from `commitments` state, so added/edited commitments flow into the correct goal-space section automatically.

### Props change

The `commitments` prop is renamed `initialCommitments` to make the initialisation pattern explicit:

```ts
interface CommitmentsClientProps {
  readonly goalSpaces: readonly Node[];
  readonly triggerOutcomes: readonly Node[];
  readonly initialCommitments: readonly Node[];  // was: commitments
  readonly allNodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly tensions: readonly TensionAlert[];
  readonly highlightId?: string;
}
```

`page.tsx` passes `initialCommitments={...}` instead of `commitments={...}`.

---

## CommitmentCardEditor Component

### Location

`src/components/commitment/CommitmentCardEditor.tsx`

### Props

```ts
interface CommitmentUpdates {
  readonly title: string;
  readonly description: string | null;
  readonly content: {
    readonly status: string;
    readonly resource_allocation: number | null;
  };
}

interface CommitmentCardEditorProps {
  readonly commitment: Node;
  readonly onSave: (id: string, updates: CommitmentUpdates) => Promise<void>;
  readonly onCancel: () => void;
}
```

### Behaviour

- Initialised from current commitment values so the user sees existing data
- Auto-focuses the title input on mount
- Matches `CommitmentCard` outer div dimensions and padding so layout does not shift when switching modes
- Save button shows loading state while request is in flight; disabled to prevent double-submit
- On save error: shows "Failed to save" inline below buttons, stays in edit mode
- On save success: `onSave` resolves, parent clears `editingId`
- Cancel: calls `onCancel`, no API call

### Fields

| Field | Input | Notes |
|---|---|---|
| Title | `<input type="text">` full width | Required, auto-focused |
| Description | `<textarea>` 3 rows | Optional |
| Status | `<select>` | Options: active, proposed, achieved, abandoned |
| Resource allocation | `<input type="number">` 0–100 | Optional, rendered with `%` suffix |

### Status options

Sourced from the existing `CommitmentCard` colour map: `active`, `proposed`, `achieved`, `abandoned`.

---

## Edit icon on CommitmentCard

`CommitmentCard` gains a pencil icon button in the top-right corner (alongside the existing author avatar). The button is hidden by default and visible on group hover (`group-hover:opacity-100`). The card's outer div must carry the `group` class (add it if not already present). It receives an `onEdit?: () => void` optional prop; if absent the icon is not rendered (preserves backward compatibility with non-editable uses of the card).

## GoalSpaceSection changes

`GoalSpaceSection` renders `CommitmentCard` internally for commitments under trigger outcomes and for goal-space-only unlinked commitments. It must accept and forward `onEdit` to each card:

```ts
// Add to GoalSpaceSectionProps:
readonly onEdit?: (id: string) => void;
```

Pass `onEdit={onEdit ? () => onEdit(c.id) : undefined}` to each `CommitmentCard` inside `GoalSpaceSection`.

`CommitmentsClient` passes `onEdit={(id) => setEditingId(id)}` to both `GoalSpaceSection` and the unlinked `CommitmentCard` instances directly.

**Files additionally modified:**
- `src/components/commitment/GoalSpaceSection.tsx`

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Add fails (network / API error) | Show "Failed to add commitment" below input; keep input value |
| Edit save fails | Show "Failed to save" below editor buttons; stay in edit mode |
| Optimistic state: none | No optimistic update — wait for API response before updating state (simpler, avoids rollback logic given low latency) |

---

## API

- **Add:** `POST /api/capture` `{ title, node_type: 'commitment' }` → returns `{ node }`
- **Edit:** `PATCH /api/nodes/[id]` `{ title, description, content: { status, resource_allocation } }` → returns updated node

No new API routes needed.

---

## Testing

### `CommitmentCardEditor` unit tests

- Renders with existing commitment values pre-filled in all fields
- Save button calls `onSave` with correct shape `{ title, description, content: { status, resource_allocation } }`
- Cancel button calls `onCancel`
- Save button is disabled while saving (loading state)
- Shows "Failed to save" when `onSave` rejects

### `CommitmentsClient` unit tests

- Add form: submitting title calls `/api/capture` and prepends returned node to list
- Add form: on API error, shows "Failed to add commitment" and preserves input value
- Edit: clicking edit icon on a commitment card renders `CommitmentCardEditor`
- Edit: successful save replaces card with updated data and closes editor
- Edit: cancel closes editor without changing data
