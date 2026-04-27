import Link from 'next/link';
import type { TrajectoryItem } from '@/lib/dashboard/queries';

function Delta({ direction, delta }: { readonly direction: TrajectoryItem['direction']; readonly delta: number }) {
  if (direction === 'up') return <span className="text-xs font-medium text-green-600 dark:text-green-400">{`↗ +${delta}`}</span>;
  if (direction === 'down') return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{`↘ −${Math.abs(delta)}`}</span>;
  return <span className="text-xs text-gray-400">→ 0</span>;
}

export function Trajectory({ items }: { readonly items: readonly TrajectoryItem[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
        Trajectory
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No goal spaces configured yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.goalSpaceId} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.goalSpaceTitle}</span>
              <Delta direction={item.direction} delta={item.delta} />
            </li>
          ))}
        </ul>
      )}
      <Link href="/reflect" className="mt-4 block text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
        Run reflection →
      </Link>
    </div>
  );
}
