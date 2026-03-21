'use client';

import { useState } from 'react';

type FieldAction = 'accepted' | 'rejected' | 'edited';

interface ExtractionFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onAction: (action: FieldAction, finalValue: string) => void;
  readonly currentAction?: FieldAction;
}

export function ExtractionField({ label, value, onAction, currentAction }: ExtractionFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSaveEdit = () => {
    setIsEditing(false);
    onAction('edited', editValue);
  };

  const borderColor = currentAction === 'accepted'
    ? 'border-l-green-500'
    : currentAction === 'rejected'
    ? 'border-l-red-500'
    : currentAction === 'edited'
    ? 'border-l-node-hunch'
    : 'border-l-gray-700';

  return (
    <div className={`bg-gray-900 rounded-lg p-3 border-l-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-node-hunch"
              />
              <button
                onClick={handleSaveEdit}
                className="bg-node-hunch text-white text-xs px-2 py-1 rounded"
                aria-label="Save edit"
              >
                Save
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditValue(value); }}
                className="text-gray-500 text-xs px-2 py-1"
                aria-label="Cancel edit"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-300">{value}</div>
          )}
        </div>
        {!isEditing && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => onAction('accepted', value)}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                currentAction === 'accepted' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-green-400'
              }`}
              aria-label="Accept"
            >
              ✓
            </button>
            <button
              onClick={() => { setIsEditing(true); setEditValue(value); }}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                currentAction === 'edited' ? 'bg-node-hunch text-white' : 'bg-gray-800 text-gray-500 hover:text-node-hunch'
              }`}
              aria-label="Edit"
            >
              ✎
            </button>
            <button
              onClick={() => onAction('rejected', value)}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                currentAction === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-red-400'
              }`}
              aria-label="Reject"
            >
              ✗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
