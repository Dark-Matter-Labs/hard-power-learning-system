'use client';

import { useState } from 'react';

interface DomainTagEditorProps {
  readonly tags: readonly string[];
  readonly onChange: (tags: readonly string[]) => void;
}

export function DomainTagEditor({ tags, onChange }: DomainTagEditorProps) {
  const [newTag, setNewTag] = useState('');

  const handleRemove = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleAdd = () => {
    const trimmed = newTag.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setNewTag('');
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-3 border-l-4 border-l-node-site">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Domain Tags</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 bg-node-site text-white text-xs px-2 py-0.5 rounded-full">
            {tag}
            <button
              onClick={() => handleRemove(tag)}
              className="hover:text-red-300 ml-0.5"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <div className="flex gap-1">
          <input
            type="text"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder="+ add"
            className="bg-transparent border border-dashed border-node-site rounded-full text-xs text-node-site px-2 py-0.5 w-20 focus:outline-none placeholder-node-site/50"
          />
        </div>
      </div>
    </div>
  );
}
