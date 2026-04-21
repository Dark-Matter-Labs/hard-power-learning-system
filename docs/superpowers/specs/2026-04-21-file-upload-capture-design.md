# File Upload Capture Design Spec

**Date:** 2026-04-21
**Branch:** main (worktree: cof-v06-pipeline)

---

## Overview

Add a "file" capture mode alongside "thought" and "call". Users drop or select a PDF, DOCX, or TXT file. The file is uploaded to Supabase Storage, a node is created with the attachment metadata, and the extraction pipeline reads the file content to auto-generate a title and full LLM extraction. No manual title entry required.

---

## Motivation

Users want to capture existing documents (reports, notes, transcripts) without retyping their content. The `Node.attachments` type is already defined in the schema — this feature wires up the upload plumbing and teaches the extraction pipeline to read file content.

---

## Scope

**In scope:** PDF, DOCX, TXT files up to 10MB. Auto-title from file content. Approach: server-side upload proxy.

**Out of scope:** Images, audio, video. File management (delete, replace). Public file URLs. Extraction from files that are supplementary to typed text (file IS the capture).

---

## Architecture

### Files

| Action | File |
|---|---|
| Create | `src/app/api/upload/route.ts` |
| Create | `src/components/capture/FileCaptureMode.tsx` |
| Create | `src/components/capture/__tests__/FileCaptureMode.test.tsx` |
| Create | `src/app/api/upload/__tests__/route.test.ts` |
| Modify | `src/components/capture/QuickCaptureForm.tsx` |
| Modify | `src/app/api/capture/route.ts` |
| Modify | `src/lib/agents/extraction.ts` |

### Upload flow

1. User selects/drops a file in the "file" tab of `QuickCaptureForm`
2. `FileCaptureMode` calls `onFileSelect(file)` — `QuickCaptureForm` stores the selected `File` in state
3. User clicks "Upload & capture" — `QuickCaptureForm` POSTs `multipart/form-data` to `/api/upload`
4. Server validates type and size, uploads to Supabase Storage bucket `attachments` at `{user_id}/{uuid}.{ext}` using service role key
5. Server returns `{ storage_path, filename, mime_type, size }`
6. `QuickCaptureForm` POSTs to `/api/capture` with `{ attachment, participant_ids, insight_date }` — no title
7. Node created with `status: 'raw'`, `attachments: [attachment]`, `title: ''`
8. Extraction pipeline triggered — reads file from storage, extracts text, calls Claude
9. Claude generates title and full extraction; node updated to `flagged_for_review` or `promoted`

---

## UI — `FileCaptureMode`

Replaces the textarea in the "file" tab. Two states:

**Empty state** — drop zone:
```
┌─────────────────────────────────────────────┐
│  Drop a file here, or click to browse       │
│       PDF · DOCX · TXT  ·  Max 10MB         │
└─────────────────────────────────────────────┘
```

**File selected** — confirmation row:
```
  📄 quarterly-report.pdf  (142 KB)   [×]
```

- `[×]` clears selection, returning to drop zone
- Submit button reads "Upload & capture"; shows "Uploading…" and is disabled during upload
- Inline error below file row on upload failure
- Date and participant fields remain visible (same as other modes)

### Props

```ts
interface FileCaptureModePros {
  readonly onFileSelect: (file: File | null) => void;
  readonly selectedFile: File | null;
  readonly isUploading: boolean;
  readonly uploadError: string | null;
}
```

`FileCaptureMode` is purely presentational — it displays the drop zone or selected file and calls `onFileSelect` when the user picks or clears a file. `QuickCaptureForm` owns all async operations: it uploads the file to `/api/upload` when the user clicks "Upload & capture", then POSTs to `/api/capture`. `isUploading` and `uploadError` are passed down from `QuickCaptureForm`'s state.

---

## API — `/api/upload`

**Method:** POST  
**Content-Type:** multipart/form-data  
**Field:** `file`

**Validation:**
- File must be present → 400 "No file provided"
- MIME type must be `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, or `text/plain` → 400 "Only PDF, DOCX, and TXT files are supported"
- Size must be ≤ 10MB (10 × 1024 × 1024 bytes) → 400 "File must be under 10MB"

**Storage path:** `{user_id}/{uuid}.{ext}` — where `ext` is derived from MIME type (`pdf`, `docx`, `txt`).

**Success response (200):**
```json
{
  "storage_path": "abc123/550e8400.pdf",
  "filename": "quarterly-report.pdf",
  "mime_type": "application/pdf",
  "size": 145231
}
```

**Error response:**
```json
{ "error": "Only PDF, DOCX, and TXT files are supported" }
```

**Authentication:** Requires authenticated Supabase session (same as all other API routes). Uses service role key for the storage upload.

---

## API — `/api/capture` changes

`title` is optional when `attachment` is present. The capture route accepts a new optional field:

```ts
attachment?: {
  storage_path: string;
  filename: string;
  mime_type: string;
  size: number;
}
```

Node is created with `title: ''` and `attachments: [attachment]` when no title is provided. Existing behaviour (title required, no attachment) is unchanged.

---

## Supabase Storage

Bucket name: `attachments`  
Access: **private** — no public URLs, authenticated reads only, service role for writes.

The bucket must be created before the upload route will work. Creation is a one-time manual step in the Supabase dashboard (or via migration). Not handled in code.

---

## Extraction pipeline changes (`lib/agents/extraction.ts`)

If `node.attachments.length > 0`, download the first attachment from Supabase Storage before building the Claude prompt.

**Per MIME type:**

| Type | Handling |
|---|---|
| `text/plain` | Read bytes as UTF-8 string, pass as text in prompt |
| `application/pdf` | Pass raw bytes as base64 `document` content block (Claude natively reads PDFs) |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Run `mammoth.extractRawText()`, pass resulting text string in prompt |

**Prompt addition:** A new instruction is prepended when a file is present: "Generate a concise title for this document based on its content." The extraction response's `title` field is written back to `node.title` after extraction completes.

**Dependency:** `mammoth` npm package for DOCX text extraction.

---

## Error handling

| Scenario | Behaviour |
|---|---|
| Wrong file type | 400 — "Only PDF, DOCX, and TXT files are supported" |
| File > 10MB | 400 — "File must be under 10MB" |
| Supabase Storage upload fails | 500 — form shows "Upload failed — try again" |
| Capture API fails after upload | Orphaned file in storage (acceptable for v1 — no cleanup) |
| Corrupt or unreadable file | Extraction fails gracefully; node stays `flagged_for_review` with no `llm_extraction` |
| DOCX mammoth parse error | Same as above |

---

## Testing

### `FileCaptureMode` unit tests
- Renders drop zone in empty state
- Shows file confirmation row after file selected
- Clears selection (back to drop zone) on × click
- Calls `onAttachment` with correct metadata after upload
- Shows "Uploading…" and disables submit while `isUploading` is true
- Shows error message when `error` is set

### `/api/upload` tests
- Returns 400 for unsupported MIME type
- Returns 400 for file over 10MB
- Calls Supabase storage with correct path format
- Returns correct metadata on success

### Extraction tests
- Reads `.txt` attachment content and passes as text
- Passes `.pdf` attachment as base64 document block
- Extracts `.docx` text via mammoth mock and passes as text
- Written title from extraction response is saved to `node.title`
