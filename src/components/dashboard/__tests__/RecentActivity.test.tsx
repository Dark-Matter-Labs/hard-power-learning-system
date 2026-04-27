import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentActivity } from '../RecentActivity';
import type { RecentActivityGroup } from '@/lib/dashboard/queries';

describe('RecentActivity', () => {
  const groups: RecentActivityGroup[] = [
    {
      label: 'Today',
      items: [{ id: '1', title: 'Madrid awe infrastructure', node_type: 'hunch', created_at: new Date().toISOString() }],
    },
  ];

  it('renders group label and item title', () => {
    render(<RecentActivity groups={groups} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Madrid awe infrastructure')).toBeInTheDocument();
  });

  it('shows empty state when no groups', () => {
    render(<RecentActivity groups={[]} />);
    expect(screen.getByText(/no recent activity/i)).toBeInTheDocument();
  });
});
