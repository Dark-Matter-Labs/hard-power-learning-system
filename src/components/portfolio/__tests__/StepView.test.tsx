import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepView } from '../StepView';

const baseStep = {
  id: 's1',
  portfolio_id: 'p1',
  step_number: 1,
  step_name: 'Risk Field',
  content: {},
  ai_suggestions: null,
  human_input: null,
  status: 'not_started' as const,
  completed_at: null,
};

describe('StepView', () => {
  it('shows Generate button for not_started step', () => {
    render(<StepView step={baseStep} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Generate AI draft/i)).toBeInTheDocument();
  });

  it('shows AI content for ai_drafted step', () => {
    const step = {
      ...baseStep,
      status: 'ai_drafted' as const,
      ai_suggestions: { text: 'Urban heat island effect is severe', generated_at: '' },
    };
    render(<StepView step={step} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Urban heat island effect/i)).toBeInTheDocument();
  });

  it('shows Accept button for ai_drafted step', () => {
    const step = {
      ...baseStep,
      status: 'ai_drafted' as const,
      ai_suggestions: { text: 'Some content', generated_at: '' },
    };
    render(<StepView step={step} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Accept/i)).toBeInTheDocument();
  });

  it('shows locked summary for complete step', () => {
    const step = {
      ...baseStep,
      status: 'complete' as const,
      ai_suggestions: { text: 'Completed content here', generated_at: '' },
    };
    render(<StepView step={step} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Completed content here/i)).toBeInTheDocument();
    expect(screen.getByText(/Re-open/i)).toBeInTheDocument();
  });

  it('shows Generate button for unimplemented step', () => {
    const step = { ...baseStep, step_number: 9, step_name: 'Outcome Accelerator', status: 'not_started' as const };
    render(<StepView step={step} portfolioId="p1" onStepUpdated={vi.fn()} />);
    expect(screen.getByText(/Generate AI draft/i)).toBeInTheDocument();
  });
});
