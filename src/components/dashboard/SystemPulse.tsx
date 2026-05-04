import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { SystemPulseData } from '@/lib/dashboard/queries';

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SystemPulse({ data }: { readonly data: SystemPulseData }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-cof-text-tertiary mb-4">
        System pulse
      </p>
      <dl className="space-y-3">
        <div className="flex justify-between text-sm">
          <dt className="text-cof-text-secondary">Last capture</dt>
          <dd className="font-medium text-cof-text-primary">
            {data.lastCaptureAt ? formatTimeAgo(data.lastCaptureAt) : 'Never'}
          </dd>
        </div>
        <div className="flex justify-between text-sm">
          <dt className="text-cof-text-secondary">This week</dt>
          <dd className="font-medium text-cof-text-primary">{data.thisWeekCount}</dd>
        </div>
        <div className="flex justify-between text-sm">
          <dt className="text-cof-text-secondary">Active commitments</dt>
          <dd>
            <Link href="/commitments" className="font-medium text-cof-text-primary hover:text-node-hunch transition-colors">
              {data.activeCommitmentsCount}
            </Link>
          </dd>
        </div>
        <div className="flex justify-between text-sm">
          <dt className="text-cof-text-secondary">Open tensions</dt>
          <dd>
            <Link href="/review" className="font-medium text-cof-text-primary hover:text-node-hunch transition-colors">
              {data.openTensionsCount}
            </Link>
          </dd>
        </div>
        <div className="flex justify-between text-sm">
          <dt className="text-cof-text-secondary">Hunches in flight</dt>
          <dd className="text-right">
            <Link href="/graph" className="font-medium text-cof-text-primary hover:text-node-hunch transition-colors">
              {data.hunchesInFlightCount}
            </Link>
            {data.hunchesInFlightCount > 0 && (
              <div className="text-[10px] text-cof-text-tertiary mt-0.5">
                {(['hypothesis', 'uncertainty', 'navigation', 'coherence', 'holding'] as const)
                  .filter(s => data.hunchStageCounts[s] > 0)
                  .map(s => `${data.hunchStageCounts[s]} ${s}`)
                  .join(' · ')}
              </div>
            )}
          </dd>
        </div>
      </dl>
      <Link href="/review" className="mt-4 block text-xs text-cof-text-tertiary hover:text-cof-text-secondary transition-colors">
        View health →
      </Link>
    </Card>
  );
}
