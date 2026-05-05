import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackWidget } from '../FeedbackWidget';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FeedbackWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders idle state with feedback link', () => {
    render(<FeedbackWidget sourceType="newsletter" sourceId="n1" />);
    expect(screen.getByText(/something wrong/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/describe what/i)).not.toBeInTheDocument();
  });

  it('opens the form when the link is clicked', () => {
    render(<FeedbackWidget sourceType="newsletter" sourceId="n1" />);
    fireEvent.click(screen.getByText(/something wrong/i));
    expect(screen.getByPlaceholderText(/describe what/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows loading state on submit', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<FeedbackWidget sourceType="newsletter" sourceId="n1" />);
    fireEvent.click(screen.getByText(/something wrong/i));
    const textarea = screen.getByPlaceholderText(/describe what/i);
    fireEvent.change(textarea, { target: { value: 'this is wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
    });
  });

  it('shows confirmation on successful submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'fb-1', created_at: '2026-05-05' }),
    });
    render(<FeedbackWidget sourceType="query" sourceId="q1" />);
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.change(screen.getByPlaceholderText(/describe what/i), { target: { value: 'node info was incorrect' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText(/feedback received/i)).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText(/describe what/i)).not.toBeInTheDocument();
  });

  it('shows error and keeps form open on failed submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });
    render(<FeedbackWidget sourceType="reflection" sourceId="r1" />);
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.change(screen.getByPlaceholderText(/describe what/i), { target: { value: 'wrong node' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/describe what/i)).toBeInTheDocument();
  });
});
