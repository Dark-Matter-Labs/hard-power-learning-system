import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' } }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

import { NavBar } from '../NavBar';

describe('NavBar', () => {
  it('renders Dashboard link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders Graph link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Graph')).toBeInTheDocument();
  });

  it('renders Commitments link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Commitments')).toBeInTheDocument();
  });

  it('renders Health link', () => {
    render(<NavBar reviewCount={0} />);
    expect(screen.getByText('Health')).toBeInTheDocument();
  });
});
