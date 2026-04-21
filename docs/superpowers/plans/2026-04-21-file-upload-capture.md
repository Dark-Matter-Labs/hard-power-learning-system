# File Upload Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "file" capture mode where users upload PDF, DOCX, or TXT files; the file is stored in Supabase Storage and the extraction pipeline auto-generates a title and full LLM extraction from the file content.

**Architecture:** Server-side upload proxy (`/api/upload`) stores files in Supabase Storage; `FileCaptureMode` is a presentational file picker; `QuickCaptureForm` owns upload state and calls `/api/upload` on submit; `/api/capture` accepts an optional `attachment` field; the extraction pipeline downloads the file and passes content to Claude.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase Storage (service role), Vitest + React Testing Library, mammoth (DOCX → text), Anthropic SDK (PDF document blocks)

---

## File map

| Action | File |
|---|---|
| Install | `mammoth` npm package |
| Create | `src/lib/supabase/admin.ts` |
| Create | `src/app/api/upload/route.ts` |
| Create | `src/app/api/upload/__tests__/route.test.ts` |
| Create | `src/components/capture/FileCaptureMode.tsx` |
| Create | `src/components/capture/__tests__/FileCaptureMode.test.tsx` |
| Modify | `src/components/capture/QuickCaptureForm.tsx` |
| Modify | `src/app/capture/page.tsx` |
| Modify | `src/app/api/capture/route.ts` |
| Modify | `src/lib/llm/index.ts` |
| Modify | `src/lib/llm/providers/anthropic.ts` |
| Modify | `src/lib/agents/extraction.ts` |
| Modify | `src/app/api/capture/process/route.ts` |

---

## Task 1: Install mammoth and create Supabase admin client

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/lib/supabase/admin.ts`

- [ ] **Step 1: Install mammoth**

```bash
cd /Users/gurden/Documents/code/cof-learning-system/.worktrees/cof-v06-pipeline
npm install mammoth
npm install --save-dev @types/mammoth
```

Expected: `mammoth` appears in `package.json` dependencies.

- [ ] **Step 2: Create the Supabase admin client**

Create `src/lib/supabase/admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/supabase/admin.ts
git commit -m "feat(upload): install mammoth, add Supabase admin client"
```

---

## Task 2: `/api/upload` route + tests

**Files:**
- Create: `src/app/api/upload/__tests__/route.test.ts`
- Create: `src/app/api/upload/route.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/upload/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

const mockUpload = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({ upload: mockUpload })),
    },
  })),
}));

function makeRequest(file: File | null): Request {
  const formData = new FormData();
  if (file) formData.append('file', file);
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockUpload.mockResolvedValue({ error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST(makeRequest(new File(['x'], 'x.txt', { type: 'text/plain' })));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('No file provided');
  });

  it('returns 400 for unsupported MIME type', async () => {
    const file = new File(['x'], 'img.png', { type: 'image/png' });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Only PDF, DOCX, and TXT files are supported');
  });

  it('returns 400 for file over 10MB', async () => {
    const largeContent = 'x'.repeat(10 * 1024 * 1024 + 1);
    const file = new File([largeContent], 'big.txt', { type: 'text/plain' });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('File must be under 10MB');
  });

  it('uploads to Supabase with correct path format', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await POST(makeRequest(file));
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/[0-9a-f-]+\.txt$/),
      expect.any(ArrayBuffer),
      { contentType: 'text/plain', upsert: false },
    );
  });

  it('returns metadata on success', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json() as { storage_path: string; filename: string; mime_type: string; size: number };
    expect(body.storage_path).toMatch(/^user-1\/[0-9a-f-]+\.txt$/);
    expect(body.filename).toBe('notes.txt');
    expect(body.mime_type).toBe('text/plain');
    expect(body.size).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/upload/__tests__/route.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Create the upload route**

Create `src/app/api/upload/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const MAX_SIZE = 10 * 1024 * 1024;

const EXT_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only PDF, DOCX, and TXT files are supported' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 });
  }

  const ext = EXT_MAP[file.type];
  const storage_path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from('attachments')
    .upload(storage_path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  return NextResponse.json({
    storage_path,
    filename: file.name,
    mime_type: file.type,
    size: file.size,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/upload/__tests__/route.test.ts --reporter=verbose
```

Expected: 6 tests PASS.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/upload/route.ts src/app/api/upload/__tests__/route.test.ts
git commit -m "feat(upload): /api/upload route — validate, store in Supabase Storage"
```

---

## Task 3: `FileCaptureMode` component + tests

**Files:**
- Create: `src/components/capture/__tests__/FileCaptureMode.test.tsx`
- Create: `src/components/capture/FileCaptureMode.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/capture/__tests__/FileCaptureMode.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FileCaptureMode } from '../FileCaptureMode';

describe('FileCaptureMode', () => {
  it('renders drop zone when no file selected', () => {
    render(
      <FileCaptureMode onFileSelect={vi.fn()} selectedFile={null} isUploading={false} uploadError={null} />,
    );
    expect(screen.getByText('Drop a file here, or click to browse')).toBeInTheDocument();
    expect(screen.getByText('PDF · DOCX · TXT · Max 10MB')).toBeInTheDocument();
  });

  it('shows file name when file is selected', () => {
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    render(
      <FileCaptureMode onFileSelect={vi.fn()} selectedFile={file} isUploading={false} uploadError={null} />,
    );
    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
  });

  it('calls onFileSelect(null) when clear button clicked', () => {
    const onFileSelect = vi.fn();
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    render(
      <FileCaptureMode onFileSelect={onFileSelect} selectedFile={file} isUploading={false} uploadError={null} />,
    );
    fireEvent.click(screen.getByLabelText('Clear file'));
    expect(onFileSelect).toHaveBeenCalledWith(null);
  });

  it('calls onFileSelect with file when input changes', () => {
    const onFileSelect = vi.fn();
    render(
      <FileCaptureMode onFileSelect={onFileSelect} selectedFile={null} isUploading={false} uploadError={null} />,
    );
    const file = new File(['content'], 'notes.txt', { type: 'text/plain' });
    const input = screen.getByTestId('file-input');
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('hides clear button when isUploading is true', () => {
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    render(
      <FileCaptureMode onFileSelect={vi.fn()} selectedFile={file} isUploading={true} uploadError={null} />,
    );
    expect(screen.queryByLabelText('Clear file')).not.toBeInTheDocument();
  });

  it('shows error message when uploadError is set', () => {
    render(
      <FileCaptureMode onFileSelect={vi.fn()} selectedFile={null} isUploading={false} uploadError="Upload failed — try again" />,
    );
    expect(screen.getByText('Upload failed — try again')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/capture/__tests__/FileCaptureMode.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../FileCaptureMode'`

- [ ] **Step 3: Create `FileCaptureMode.tsx`**

Create `src/components/capture/FileCaptureMode.tsx`:

```tsx
'use client';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileCaptureModePros {
  readonly onFileSelect: (file: File | null) => void;
  readonly selectedFile: File | null;
  readonly isUploading: boolean;
  readonly uploadError: string | null;
}

export function FileCaptureMode({ onFileSelect, selectedFile, isUploading, uploadError }: FileCaptureModePros) {
  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onFileSelect(files[0]);
  }

  return (
    <div>
      {selectedFile ? (
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
            {selectedFile.name} ({formatBytes(selectedFile.size)})
          </span>
          {!isUploading && (
            <button
              type="button"
              onClick={() => onFileSelect(null)}
              aria-label="Clear file"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <label
          className="block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={e => handleFiles(e.target.files)}
            data-testid="file-input"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">Drop a file here, or click to browse</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF · DOCX · TXT · Max 10MB</p>
        </label>
      )}
      {uploadError && <p className="mt-2 text-sm text-red-400">{uploadError}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/capture/__tests__/FileCaptureMode.test.tsx --reporter=verbose
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/capture/FileCaptureMode.tsx src/components/capture/__tests__/FileCaptureMode.test.tsx
git commit -m "feat(upload): FileCaptureMode — file drop zone component"
```

---

## Task 4: Wire file mode into `QuickCaptureForm` and capture page

**Files:**
- Modify: `src/components/capture/QuickCaptureForm.tsx`
- Modify: `src/app/capture/page.tsx`

- [ ] **Step 1: Rewrite `QuickCaptureForm.tsx`**

Replace the entire contents of `src/components/capture/QuickCaptureForm.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { PersonAutocomplete, type PersonOption } from './PersonAutocomplete';
import { FileCaptureMode } from './FileCaptureMode';
import type { Attachment } from '@/lib/types/nodes';

export interface CaptureFormData {
  readonly title: string;
  readonly description: string;
  readonly date?: string;
  readonly participant_ids?: readonly string[];
  readonly external_link_url?: string;
  readonly external_link_label?: string;
  readonly attachment?: Attachment;
}

export type EntryMode = 'thought' | 'call' | 'file' | null;

interface QuickCaptureFormProps {
  readonly onSubmit: (data: CaptureFormData) => void;
  readonly isSubmitting?: boolean;
  readonly entryMode?: EntryMode;
}

export function QuickCaptureForm({ onSubmit, isSubmitting = false, entryMode = null }: QuickCaptureFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedPeople, setSelectedPeople] = useState<ReadonlyArray<PersonOption>>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isFileMode = entryMode === 'file';
  const canSubmit = isFileMode
    ? selectedFile !== null && !isUploading && !isSubmitting
    : title.trim().length > 0 && !isSubmitting;

  const descriptionRows = entryMode === 'call' ? 10 : 5;
  const descriptionPlaceholder = entryMode === 'call'
    ? 'Paste the transcript or meeting notes here...'
    : 'Paste a transcript, drop some notes, or write a thought.';

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (isFileMode && selectedFile) {
      setIsUploading(true);
      setUploadError(null);
      try {
        const fd = new FormData();
        fd.append('file', selectedFile);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? 'Upload failed');
        }
        const attachment = await res.json() as Attachment;
        setIsUploading(false);
        onSubmit({
          title: '',
          description: '',
          date: date || undefined,
          participant_ids: selectedPeople.length > 0 ? selectedPeople.map(p => p.id) : undefined,
          attachment,
        });
        setSelectedFile(null);
        setDate(new Date().toISOString().slice(0, 10));
        setSelectedPeople([]);
      } catch (err) {
        setIsUploading(false);
        setUploadError(err instanceof Error ? err.message : 'Upload failed — try again');
      }
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      date: date || undefined,
      participant_ids: selectedPeople.length > 0 ? selectedPeople.map(p => p.id) : undefined,
      ...(linkUrl.trim() ? { external_link_url: linkUrl.trim(), external_link_label: linkLabel.trim() || linkUrl.trim() } : {}),
    });

    setTitle('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setSelectedPeople([]);
    setLinkUrl('');
    setLinkLabel('');
  };

  const submitLabel = isFileMode
    ? (isUploading ? 'Uploading…' : isSubmitting ? 'Capturing…' : 'Upload & capture')
    : (isSubmitting ? 'Capturing...' : 'Capture');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isFileMode ? (
        <FileCaptureMode
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          isUploading={isUploading}
          uploadError={uploadError}
        />
      ) : (
        <>
          <div>
            <label htmlFor="title" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={descriptionPlaceholder}
              rows={descriptionRows}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch resize-none"
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="capture-date" className="block text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
          When did this happen?
        </label>
        <input
          id="capture-date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-node-hunch"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
          People involved
        </label>
        <PersonAutocomplete
          selectedPeople={selectedPeople}
          onChange={setSelectedPeople}
        />
      </div>

      {!isFileMode && (
        <details className="group">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
            + Add external link
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
            />
            <input
              type="text"
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              placeholder="Label"
              className="w-32 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
            />
          </div>
        </details>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-node-assumption-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Update `capture/page.tsx`**

In `src/app/capture/page.tsx`, make two changes:

**Change 1** — replace the disabled "Upload a file" `<div>` (lines 101–104) with an active button:

```tsx
<button
  type="button"
  onClick={() => setEntryMode(entryMode === 'file' ? null : 'file')}
  className={`rounded-xl border p-4 text-left transition-colors ${
    entryMode === 'file'
      ? 'border-node-hunch bg-node-hunch/10 dark:bg-node-hunch/10'
      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
  }`}
>
  <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Upload a file</div>
  <div className="text-xs text-gray-500 dark:text-gray-400">PDF · DOCX · TXT</div>
</button>
```

**Change 2** — in `handleSubmit`, include `attachment` in the POST body. Replace the `body: JSON.stringify({...})` call with:

```ts
body: JSON.stringify({
  title: formData.title || undefined,
  description: formData.description,
  insight_date: formData.date ? new Date(formData.date + 'T00:00:00').toISOString() : undefined,
  participant_ids: formData.participant_ids,
  external_link: formData.external_link_url
    ? { url: formData.external_link_url, label: formData.external_link_label ?? formData.external_link_url }
    : undefined,
  attachment: formData.attachment,
}),
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all existing tests pass, FAIL 0.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/capture/QuickCaptureForm.tsx src/app/capture/page.tsx
git commit -m "feat(upload): wire file mode into QuickCaptureForm and capture page"
```

---

## Task 5: Update `/api/capture` to accept attachment

**Files:**
- Modify: `src/app/api/capture/route.ts`

- [ ] **Step 1: Update the capture route**

Replace the entire contents of `src/app/api/capture/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    node_type = 'hunch',
    description,
    hunch_type,
    confidence_level,
    external_link,
    content,
    insight_date,
    participant_ids,
    attachment,
  } = body;

  const hasAttachment = attachment && typeof attachment.storage_path === 'string';
  if (!hasAttachment && (!title || typeof title !== 'string' || title.trim().length === 0)) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const externalLinks = external_link?.url
    ? [{ url: external_link.url, label: external_link.label || external_link.url, added_at: new Date().toISOString() }]
    : [];

  const { data: node, error } = await supabase
    .from('nodes')
    .insert({
      node_type,
      title: title?.trim() || '',
      description: description?.trim() || null,
      hunch_type: hunch_type || 'new',
      confidence_level: confidence_level || 3,
      confidence_basis: 'intuition',
      status: 'raw',
      author_id: user.id,
      external_links: externalLinks,
      content: content ?? null,
      insight_date: insight_date ?? null,
      attachments: attachment ? [attachment] : [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'created_hunch',
    target_node_id: node.id,
    details: { title: node.title, hunch_type: node.hunch_type },
  });

  if (participant_ids && Array.isArray(participant_ids) && participant_ids.length > 0) {
    const participantEdges = (participant_ids as string[]).map((personId: string) => ({
      source_id: node.id,
      target_id: personId,
      edge_type: 'participated_in',
      weight: 1,
      author_id: user.id,
    }));
    await supabase.from('edges').insert(participantEdges);
  }

  if (node_type === 'signal') {
    const signalUrl = new URL('/api/signals', request.url);
    fetch(signalUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ node_id: node.id }),
    }).catch(() => {});
  }

  const processUrl = new URL('/api/capture/process', request.url);
  fetch(processUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({ node_id: node.id }),
  }).catch(() => {});

  return NextResponse.json({ data: node }, { status: 201 });
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass, FAIL 0.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/capture/route.ts
git commit -m "feat(upload): /api/capture — accept optional attachment, title optional when attachment present"
```

---

## Task 6: Extend LLM layer and extraction for file content

**Files:**
- Modify: `src/lib/llm/index.ts`
- Modify: `src/lib/llm/providers/anthropic.ts`
- Modify: `src/lib/agents/extraction.ts`
- Create: `src/lib/agents/__tests__/extraction-file.test.ts`

- [ ] **Step 1: Write failing extraction tests**

Create `src/lib/agents/__tests__/extraction-file.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildExtractionPrompt, runExtraction } from '../extraction';

const mockCallLLM = vi.fn();
vi.mock('@/lib/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

const VALID_EXTRACTION = JSON.stringify({
  node_type: 'learning',
  maturity: 'watch_closely',
  title: 'Quarterly targets missed',
  summary: 'The Q1 targets were not met.',
  structured_claim: null,
  assumption_type: null,
  entities: [],
  domain_tags: ['finance'],
  suggested_connections: [],
  confidence_assessment: { level: 3, basis: 'observation' },
  open_questions: [],
  commitment_relevance: null,
});

describe('buildExtractionPrompt with file content', () => {
  it('includes text file content in prompt when textFileContent provided', () => {
    const prompt = buildExtractionPrompt('', '', undefined, 'File body here');
    expect(prompt).toContain('File body here');
    expect(prompt).toContain('<document>');
  });

  it('includes title hint when title and text content provided', () => {
    const prompt = buildExtractionPrompt('My Doc', '', undefined, 'File body here');
    expect(prompt).toContain('My Doc');
    expect(prompt).toContain('File body here');
  });

  it('falls back to title/description when no text content', () => {
    const prompt = buildExtractionPrompt('A title', 'A description');
    expect(prompt).toBe('Title: A title\n\nDescription: A description');
  });
});

describe('runExtraction with AttachmentContent', () => {
  beforeEach(() => {
    mockCallLLM.mockResolvedValue({ content: VALID_EXTRACTION, model: 'test' });
  });

  it('passes text content via userMessage for text attachment', async () => {
    await runExtraction('', '', undefined, { type: 'text', textContent: 'Hello world' });
    expect(mockCallLLM).toHaveBeenCalledWith('extraction', expect.objectContaining({
      userMessage: expect.stringContaining('Hello world'),
      pdfBase64: undefined,
    }));
  });

  it('passes pdfBase64 for pdf attachment', async () => {
    await runExtraction('', '', undefined, { type: 'pdf', base64: 'abc123' });
    expect(mockCallLLM).toHaveBeenCalledWith('extraction', expect.objectContaining({
      pdfBase64: 'abc123',
    }));
  });

  it('uses normal title/description path when no attachment', async () => {
    await runExtraction('A title', 'A description');
    expect(mockCallLLM).toHaveBeenCalledWith('extraction', expect.objectContaining({
      userMessage: 'Title: A title\n\nDescription: A description',
      pdfBase64: undefined,
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/agents/__tests__/extraction-file.test.ts --reporter=verbose
```

Expected: FAIL — functions exist but new overloads/params not yet present.

- [ ] **Step 3: Update `src/lib/llm/index.ts` — add `pdfBase64`**

Add `readonly pdfBase64?: string;` to `LLMRequest`:

```ts
export interface LLMRequest {
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly pdfBase64?: string;
}
```

- [ ] **Step 4: Update `src/lib/llm/providers/anthropic.ts` — handle PDF document block**

Replace the entire file:

```ts
import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, LLMRequest, LLMResponse } from '../index';

export async function callAnthropic(config: LLMConfig, request: LLMRequest): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const userContent = request.pdfBase64
    ? [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: request.pdfBase64,
          },
        },
        { type: 'text' as const, text: request.userMessage },
      ]
    : request.userMessage;

  const message = await client.messages.create({
    model: config.model,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.3,
    system: request.systemPrompt,
    messages: [{ role: 'user', content: userContent as Parameters<typeof client.messages.create>[0]['messages'][0]['content'] }],
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Anthropic');
  }

  return {
    content: textBlock.text,
    model: message.model,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  };
}
```

- [ ] **Step 5: Update `src/lib/agents/extraction.ts` — add `AttachmentContent`, update `buildExtractionPrompt` and `runExtraction`**

Add the `AttachmentContent` interface and update the two functions. Insert after the `GoalContext` interface (after line 39):

```ts
export interface AttachmentContent {
  readonly type: 'text' | 'pdf';
  readonly textContent?: string;
  readonly base64?: string;
}
```

Replace `buildExtractionPrompt` with:

```ts
export function buildExtractionPrompt(
  title: string,
  description: string,
  goalContext?: GoalContext,
  textFileContent?: string,
): string {
  let base: string;
  if (textFileContent) {
    const docBlock = `<document>\n${textFileContent}\n</document>`;
    base = title ? `Title hint: ${title}\n\nGenerate a concise title for this document based on its content.\n\n${docBlock}` : `Generate a concise title for this document based on its content.\n\n${docBlock}`;
  } else {
    base = `Title: ${title}\n\nDescription: ${description}`;
  }

  if (!goalContext) return base;

  const { goalSpaces, triggerOutcomes, personNodes } = goalContext;
  const hasGoalSpaces = goalSpaces.length > 0;
  const hasTriggerOutcomes = triggerOutcomes.length > 0;
  const hasPersonNodes = personNodes.length > 0;

  if (!hasGoalSpaces && !hasTriggerOutcomes && !hasPersonNodes) return base;

  const sections: string[] = [base, ''];

  if (hasGoalSpaces) {
    sections.push('Active goal spaces:');
    for (const gs of goalSpaces) sections.push(`- ${gs.title} (id: ${gs.id})`);
  }

  if (hasTriggerOutcomes) {
    if (hasGoalSpaces) sections.push('');
    sections.push('Active trigger outcomes:');
    for (const to of triggerOutcomes) sections.push(`- ${to.title} (id: ${to.id})`);
  }

  if (hasTriggerOutcomes || hasGoalSpaces) {
    sections.push('');
    sections.push('If this node relates to any of the trigger outcomes above, include goal_relevance in your response using the exact outcome IDs provided.');
  }

  if (hasPersonNodes) {
    sections.push('');
    sections.push('Known persons in the system:');
    for (const p of personNodes) sections.push(`- ${p.title} (id: ${p.id})`);
    sections.push('');
    sections.push('If this text mentions any of the persons above, include a suggested_connection with edge_type "mentioned_in" and target_title matching the exact name from this list.');
  }

  return sections.join('\n');
}
```

Replace `runExtraction` with:

```ts
export async function runExtraction(
  title: string,
  description: string,
  goalContext?: GoalContext,
  attachmentContent?: AttachmentContent,
): Promise<LlmExtraction> {
  const promptText = attachmentContent?.type === 'text' && attachmentContent.textContent
    ? buildExtractionPrompt(title, '', goalContext, attachmentContent.textContent)
    : buildExtractionPrompt(title, description, goalContext);

  const response = await callLLM('extraction', {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: promptText,
    maxTokens: 2048,
    temperature: 0.3,
    pdfBase64: attachmentContent?.type === 'pdf' ? attachmentContent.base64 : undefined,
  });

  return parseExtractionResponse(response.content);
}
```

- [ ] **Step 6: Run the new extraction tests**

```bash
npx vitest run src/lib/agents/__tests__/extraction-file.test.ts --reporter=verbose
```

Expected: 6 tests PASS.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass, FAIL 0.

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/lib/llm/index.ts src/lib/llm/providers/anthropic.ts src/lib/agents/extraction.ts src/lib/agents/__tests__/extraction-file.test.ts
git commit -m "feat(upload): extend LLM layer and extraction for file content (PDF document blocks, text content)"
```

---

## Task 7: Update process route to read file attachment and write title back

**Files:**
- Modify: `src/app/api/capture/process/route.ts`

- [ ] **Step 1: Update `process/route.ts`**

Replace the entire contents of `src/app/api/capture/process/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runExtraction, runMeetingExtraction, type GoalContext, type AttachmentContent } from '@/lib/agents/extraction';
import { getCaptureType } from '@/lib/config/captureTypes';
import type { MeetingExtraction } from '@/lib/types/nodes';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { node_id } = await request.json();

  if (!node_id) {
    return NextResponse.json({ error: 'node_id is required' }, { status: 400 });
  }

  await supabase.from('nodes').update({ status: 'processing' }).eq('id', node_id);

  try {
    const [
      { data: node, error: fetchError },
      { data: goalSpacesData },
      { data: triggerOutcomesData },
      { data: personNodesData },
    ] = await Promise.all([
      supabase
        .from('nodes')
        .select('title, description, node_type, content, attachments')
        .eq('id', node_id)
        .single(),
      supabase.from('nodes').select('id, title').eq('node_type', 'goal_space').neq('status', 'archived'),
      supabase.from('nodes').select('id, title').eq('node_type', 'trigger_outcome').neq('status', 'archived'),
      supabase.from('nodes').select('id, title').eq('node_type', 'person').in('status', ['promoted', 'human_reviewed']),
    ]);

    if (fetchError || !node) {
      throw new Error(`Node not found: ${node_id}`);
    }

    const goalContext: GoalContext = {
      goalSpaces: goalSpacesData ?? [],
      triggerOutcomes: triggerOutcomesData ?? [],
      personNodes: personNodesData ?? [],
    };

    const captureConfig = getCaptureType(node.node_type as Parameters<typeof getCaptureType>[0]);

    if (captureConfig?.multiNodeExtraction) {
      const contentObj = (node.content ?? {}) as Record<string, unknown>;
      const meetingDate = contentObj.meeting_date as string | undefined;
      const participants = contentObj.participants as string[] | undefined;

      const meetingExtraction: MeetingExtraction = await runMeetingExtraction(
        node.title,
        node.description ?? '',
        meetingDate,
        participants,
        goalContext,
      );

      await supabase
        .from('nodes')
        .update({ llm_extraction: meetingExtraction as unknown as Record<string, unknown>, status: 'llm_reviewed' })
        .eq('id', node_id);

      const childInserts = meetingExtraction.extracted_nodes.map(extracted => ({
        node_type: extracted.node_type,
        title: extracted.title,
        description: extracted.summary,
        confidence_level: extracted.confidence_level,
        confidence_basis: 'observation' as const,
        status: 'llm_reviewed' as const,
        author_id: user.id,
        parent_node_id: node_id,
        domain_tags: extracted.domain_tags,
        content: { category: extracted.category, rationale: extracted.rationale, source_meeting: node_id },
        llm_extraction: {
          title: extracted.title,
          summary: extracted.summary,
          entities: [],
          domain_tags: extracted.domain_tags,
          suggested_connections: [],
          confidence_assessment: { level: extracted.confidence_level, basis: 'observation' },
          open_questions: [],
          structured_claim: null,
          assumption_type: null,
          commitment_relevance: null,
        },
      }));

      if (childInserts.length > 0) {
        await supabase.from('nodes').insert(childInserts);
      }

      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'reviewed',
        target_node_id: node_id,
        details: { type: 'meeting_extraction', model: 'extraction', child_count: childInserts.length },
      });

      return NextResponse.json({ data: { node_id, status: 'llm_reviewed', child_count: childInserts.length } });
    } else {
      // Read file attachment content if present
      let attachmentContent: AttachmentContent | undefined;
      const attachments = (node as unknown as { attachments?: Array<{ storage_path: string; mime_type: string }> }).attachments ?? [];

      if (attachments.length > 0) {
        const attachment = attachments[0];
        const adminClient = createAdminClient();
        const { data: fileData } = await adminClient.storage.from('attachments').download(attachment.storage_path);

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();

          if (attachment.mime_type === 'text/plain') {
            attachmentContent = { type: 'text', textContent: new TextDecoder().decode(arrayBuffer) };
          } else if (attachment.mime_type === 'application/pdf') {
            attachmentContent = { type: 'pdf', base64: Buffer.from(arrayBuffer).toString('base64') };
          } else if (attachment.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
            attachmentContent = { type: 'text', textContent: result.value };
          }
        }
      }

      const extraction = await runExtraction(node.title, node.description ?? '', goalContext, attachmentContent);

      const classifiedNodeType = extraction.node_type ?? node.node_type;
      const confidenceLevel = extraction.confidence_assessment.level;
      const confidenceBasis = extraction.confidence_assessment.basis;
      const maturity = extraction.maturity;
      const newStatus = maturity === 'ready_to_promote' ? 'promoted' : 'flagged_for_review';

      // Write title back when node was created without one (file upload path)
      const titleUpdate = node.title === '' ? { title: extraction.title } : {};

      await supabase
        .from('nodes')
        .update({
          ...titleUpdate,
          llm_extraction: extraction,
          status: newStatus,
          node_type: classifiedNodeType,
          confidence_level: confidenceLevel,
          confidence_basis: confidenceBasis,
          content: {
            ...((node.content as Record<string, unknown>) ?? {}),
            maturity,
            process_status: newStatus,
          },
        })
        .eq('id', node_id);

      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'reviewed',
        target_node_id: node_id,
        details: { type: 'llm_extraction', model: 'extraction', classified_type: classifiedNodeType, maturity },
      });

      return NextResponse.json({ data: { node_id, status: newStatus, node_type: classifiedNodeType, maturity } });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await supabase
      .from('nodes')
      .update({ status: 'error', llm_extraction: { error: errorMessage, failed_at: new Date().toISOString() } })
      .eq('id', node_id);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass, FAIL 0.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/capture/process/route.ts
git commit -m "feat(upload): process route reads file attachment, writes LLM-generated title back to node"
```

---

## Final check

```bash
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "__tests__" | head -10
git log --oneline -8
```

**Before running in production:** Create the `attachments` Supabase Storage bucket manually in the Supabase dashboard (Storage → New bucket → name: `attachments`, public: off). Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables.
