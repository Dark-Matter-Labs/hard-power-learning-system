'use client';

interface ConfidenceSliderProps {
  readonly aiLevel: number;
  readonly humanLevel: number;
  readonly onChange: (level: number) => void;
}

export function ConfidenceSlider({ aiLevel, humanLevel, onChange }: ConfidenceSliderProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 border-l-4 border-l-node-option">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Confidence</div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">AI:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(level => (
              <div
                key={level}
                className={`w-3 h-3 rounded-full ${
                  level <= aiLevel ? 'bg-node-option opacity-50' : 'border border-gray-600 opacity-50'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-200 font-medium">You:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(level => (
              <button
                key={level}
                onClick={() => onChange(level)}
                className={`w-4 h-4 rounded-full transition-colors ${
                  level <= humanLevel ? 'bg-node-option' : 'border border-gray-600 hover:border-gray-500'
                }`}
                aria-label={`Set confidence to ${level}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
