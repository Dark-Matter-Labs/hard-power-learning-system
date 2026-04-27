import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemPulse } from '../SystemPulse';
import type { SystemPulseData } from '@/lib/dashboard/queries';

describe('SystemPulse', () => {
  const data: SystemPulseData = {
    lastCaptureAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    thisWeekCount: 12,
    activeCommitmentsCount: 4,
    openTensionsCount: 2,
    hunchesInFlightCount: 18,
  };

  it('renders all five metric values', () => {
    render(<SystemPulse data={data} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('shows "Never" when lastCaptureAt is null', () => {
    render(<SystemPulse data={{ ...data, lastCaptureAt: null }} />);
    expect(screen.getByText('Never')).toBeInTheDocument();
  });
});
