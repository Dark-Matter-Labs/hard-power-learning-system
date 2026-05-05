'use client';

import { useState } from 'react';

const NETWORK_ERROR_MSG = 'Network error — please try again';

type FeedbackState = 'idle' | 'open' | 'submitting' | 'done' | 'error';

interface FeedbackWidgetProps {
  readonly sourceType: 'reflection' | 'query' | 'newsletter';
  readonly sourceId: string;
}

export function FeedbackWidget({ sourceType, sourceId }: FeedbackWidgetProps) {
  const [state, setState] = useState<FeedbackState>('idle');
  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit() {
    if (!text.trim()) return;
    setState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: sourceType, source_id: sourceId, feedback_text: text.trim() }),
      });
      const body = await res.json() as { id?: string; error?: string };
      if (!res.ok) {
        setErrorMsg(body.error ?? 'Failed to submit feedback');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setErrorMsg(NETWORK_ERROR_MSG);
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <p className="mt-3 text-xs text-cof-text-tertiary">
        Feedback received — corrections applying in the background.
      </p>
    );
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setState('open')}
        className="mt-3 text-xs text-cof-text-tertiary hover:text-cof-text-secondary transition-colors"
      >
        Something wrong? Give feedback
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        aria-label="Describe what's incorrect or missing"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe what's incorrect or missing…"
        rows={3}
        className="w-full text-sm bg-cof-bg-elevated border border-cof-border rounded-md px-3 py-2 text-cof-text-primary placeholder-cof-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-node-hunch"
      />
      {state === 'error' && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={state === 'submitting' || !text.trim()}
          className="px-3 py-1 text-xs bg-node-hunch text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {state === 'submitting' ? 'Submitting…' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={() => { setState('idle'); setText(''); setErrorMsg(''); }}
          className="px-3 py-1 text-xs text-cof-text-tertiary hover:text-cof-text-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
