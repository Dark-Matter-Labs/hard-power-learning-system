'use client';

import { useState, useEffect } from 'react';

interface AgentStats {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedCalls: number;
}

interface UsageData {
  totalCalls: number;
  cachedCalls: number;
  cacheHitRate: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostCents: number;
  byAgent: Record<string, AgentStats>;
}

export function UsageTab() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/usage')
      .then(r => r.json() as Promise<{ data?: UsageData; error?: string }>)
      .then(body => {
        if (body.data) setData(body.data);
        else setError(body.error ?? 'Failed to load usage data');
      })
      .catch(() => setError('Failed to load usage data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading usage data…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-red-500">{error ?? 'No data'}</p>;
  }

  const costDollars = (data.estimatedCostCents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total calls', value: data.totalCalls.toLocaleString() },
          { label: 'Cache hit rate', value: `${data.cacheHitRate}%` },
          { label: 'Tokens used', value: (data.totalInputTokens + data.totalOutputTokens).toLocaleString() },
          { label: 'Estimated cost', value: `$${costDollars}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-gray-800 dark:text-gray-200">{value}</dd>
          </div>
        ))}
      </dl>

      {Object.keys(data.byAgent).length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500 text-left border-b border-gray-100 dark:border-gray-800">
              <th className="pb-2 font-medium">Agent</th>
              <th className="pb-2 font-medium text-right">Calls</th>
              <th className="pb-2 font-medium text-right">Cache hits</th>
              <th className="pb-2 font-medium text-right">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {Object.entries(data.byAgent)
              .sort(([, a], [, b]) => b.calls - a.calls)
              .map(([agent, stats]) => (
                <tr key={agent}>
                  <td className="py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">{agent}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">{stats.calls}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">{stats.cachedCalls}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-400">
                    {(stats.inputTokens + stats.outputTokens).toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
