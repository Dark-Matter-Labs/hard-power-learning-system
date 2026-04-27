import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Trajectory } from '../Trajectory';
import type { TrajectoryItem } from '@/lib/dashboard/queries';

describe('Trajectory', () => {
  const items: TrajectoryItem[] = [
    { goalSpaceId: 'gs1', goalSpaceTitle: 'Formation Capital', latestScore: 0.7, direction: 'up', delta: 7 },
    { goalSpaceId: 'gs2', goalSpaceTitle: 'Natural Assets', latestScore: 0.4, direction: 'down', delta: -3 },
  ];

  it('renders goal space titles', () => {
    render(<Trajectory items={items} />);
    expect(screen.getByText('Formation Capital')).toBeInTheDocument();
    expect(screen.getByText('Natural Assets')).toBeInTheDocument();
  });

  it('renders positive delta with + prefix', () => {
    render(<Trajectory items={items} />);
    expect(screen.getByText('↗ +7')).toBeInTheDocument();
  });

  it('renders negative delta with − prefix', () => {
    render(<Trajectory items={items} />);
    expect(screen.getByText('↘ −3')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<Trajectory items={[]} />);
    expect(screen.getByText(/no goal spaces/i)).toBeInTheDocument();
  });
});
