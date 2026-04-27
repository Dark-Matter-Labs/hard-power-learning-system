import Link from 'next/link';
import type { RhythmData } from '@/lib/dashboard/queries';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F'] as const;

export function WeeklyRhythm({ rhythm }: { readonly rhythm: RhythmData }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
        This week's rhythm
      </p>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Daily capture</p>
          <div className="flex gap-2">
            {rhythm.dailyCaptures.map((done, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  data-day-dot
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs transition-colors
                    ${i === rhythm.todayIndex ? 'ring-2 ring-node-hunch/30' : ''}
                    ${done ? 'bg-node-hunch border-node-hunch text-white' : 'border-gray-200 dark:border-gray-700 text-transparent'}`}
                >
                  ✓
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {[
            { done: rhythm.weeklyReviewDone, label: 'Weekly review (Fri)', href: '/review' },
            { done: rhythm.monthlyReflectionDone, label: 'Monthly reflection', href: '/reflect' },
          ].map(({ done, label, href }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0
                ${done ? 'bg-node-hunch border-node-hunch text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                {done ? '✓' : ''}
              </span>
              <Link href={href} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                {label}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
