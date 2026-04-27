import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklyRhythm } from '../WeeklyRhythm';
import type { RhythmData } from '@/lib/dashboard/queries';

describe('WeeklyRhythm', () => {
  const rhythm: RhythmData = {
    dailyCaptures: [true, true, false, false, false],
    weeklyReviewDone: false,
    monthlyReflectionDone: true,
    todayIndex: 2,
  };

  it('renders 5 day dots', () => {
    const { container } = render(<WeeklyRhythm rhythm={rhythm} />);
    const dots = container.querySelectorAll('[data-day-dot]');
    expect(dots).toHaveLength(5);
  });

  it('shows weekly review and monthly reflection labels', () => {
    render(<WeeklyRhythm rhythm={rhythm} />);
    expect(screen.getByText(/weekly review/i)).toBeInTheDocument();
    expect(screen.getByText(/monthly reflection/i)).toBeInTheDocument();
  });
});
