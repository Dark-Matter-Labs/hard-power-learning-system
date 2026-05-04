'use client';

import { useState } from 'react';
import { StepNavigator } from './StepNavigator';
import { StepView } from './StepView';

interface Step {
  readonly id: string;
  readonly portfolio_id: string;
  readonly step_number: number;
  readonly step_name: string;
  readonly content: Record<string, unknown>;
  readonly ai_suggestions: { text: string; generated_at: string } | null;
  readonly human_input: string | null;
  readonly status: 'not_started' | 'ai_drafted' | 'in_review' | 'complete';
  readonly completed_at: string | null;
}

interface Portfolio {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly current_step: number;
  readonly steps: readonly Step[];
}

interface PortfolioDetailProps {
  readonly portfolio: Portfolio;
}

export function PortfolioDetail({ portfolio }: PortfolioDetailProps) {
  const [steps, setSteps] = useState<Step[]>([...portfolio.steps]);
  const [activeStep, setActiveStep] = useState(portfolio.current_step);

  function handleStepUpdated(updated: Step) {
    setSteps(prev => prev.map(s => s.step_number === updated.step_number ? updated : s));
    if (updated.status === 'complete') {
      setActiveStep(Math.min(updated.step_number + 1, 13));
    }
  }

  const currentStep = steps.find(s => s.step_number === activeStep) ?? steps[0];

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <StepNavigator
        steps={steps}
        activeStep={activeStep}
        onSelectStep={setActiveStep}
      />
      {currentStep && (
        <StepView
          step={currentStep}
          portfolioId={portfolio.id}
          onStepUpdated={handleStepUpdated}
        />
      )}
    </div>
  );
}
