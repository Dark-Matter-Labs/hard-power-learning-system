'use client';

interface FilterBarProps {
  readonly activeTypes: readonly string[];
  readonly onToggleType: (type: string) => void;
  readonly nodeTypes: ReadonlyArray<{ readonly id: string; readonly label: string; readonly color: string | null }>;
}

export function FilterBar({ activeTypes, onToggleType, nodeTypes }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 flex-wrap">
      <span className="text-xs text-gray-600 uppercase">Filter:</span>
      {nodeTypes.map(type => {
        const isActive = activeTypes.includes(type.id);
        return (
          <button
            key={type.id}
            onClick={() => onToggleType(type.id)}
            className="text-xs px-2.5 py-0.5 rounded-full transition-colors"
            style={{
              backgroundColor: isActive ? (type.color ?? '#888') : '#1f2937',
              color: isActive ? '#fff' : '#6b7280',
            }}
          >
            {type.label}
          </button>
        );
      })}
    </div>
  );
}
