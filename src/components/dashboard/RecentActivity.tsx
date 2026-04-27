import Link from 'next/link';
import type { RecentActivityGroup } from '@/lib/dashboard/queries';

const TYPE_LABEL: Record<string, string> = {
  hunch: 'hunch',
  assumption_background: 'assumption',
  assumption_foreground: 'assumption',
  learning: 'learning',
  signal: 'signal',
  commitment: 'commitment',
  option: 'option',
  site: 'site',
  person: 'person',
  goal_space: 'goal',
};

export function RecentActivity({ groups }: { readonly groups: readonly RecentActivityGroup[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
        Recent activity
      </p>
      {groups.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No recent activity yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">{group.label}</p>
              <ul className="space-y-1.5">
                {group.items.map(item => (
                  <li key={item.id} className="flex items-baseline gap-2">
                    <span className="text-[10px] text-gray-300 dark:text-gray-600 uppercase tracking-wide flex-shrink-0 w-16 truncate">
                      {TYPE_LABEL[item.node_type] ?? item.node_type}
                    </span>
                    <Link href={`/capture/${item.id}`} className="text-sm text-gray-700 dark:text-gray-300 hover:text-node-hunch transition-colors truncate">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Link href="/log" className="mt-4 block text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
        Open log →
      </Link>
    </div>
  );
}
