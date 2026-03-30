import type { FactorBreakdown } from '@/lib/graph/convergence';

export interface ConvergenceSnapshot {
  readonly score: number;
  readonly factor_breakdown: FactorBreakdown;
  readonly computed_at: string;
}

export interface SparklinePoint {
  readonly score: number;
  readonly computed_at: string;
}

export interface ConvergenceData {
  readonly latest: ConvergenceSnapshot | null;
  readonly history: readonly SparklinePoint[];
}
