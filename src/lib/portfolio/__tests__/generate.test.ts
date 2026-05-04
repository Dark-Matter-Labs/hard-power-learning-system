import { describe, it, expect } from 'vitest';
import { buildStepContext } from '../generate';

describe('buildStepContext', () => {
  it('returns portfolio title in context', () => {
    const ctx = buildStepContext(
      { title: 'Madrid Urban Heat', description: 'Cooling Madrid' },
      []
    );
    expect(ctx).toContain('Madrid Urban Heat');
    expect(ctx).toContain('Cooling Madrid');
  });

  it('includes completed step summaries', () => {
    const ctx = buildStepContext(
      { title: 'Madrid Urban Heat', description: null },
      [
        { step_number: 1, step_name: 'Risk Field', content: { text: 'Urban heat island effect...' }, status: 'complete' },
      ]
    );
    expect(ctx).toContain('Risk Field');
    expect(ctx).toContain('Urban heat island effect');
  });

  it('excludes incomplete steps from context', () => {
    const ctx = buildStepContext(
      { title: 'Test', description: null },
      [
        { step_number: 1, step_name: 'Risk Field', content: {}, status: 'not_started' },
        { step_number: 2, step_name: 'Risk Goal', content: { text: 'Cool by 7.5C' }, status: 'complete' },
      ]
    );
    expect(ctx).toContain('Risk Goal');
    expect(ctx).not.toContain('Risk Field');
  });

  it('returns title for portfolio with no description and no steps', () => {
    const ctx = buildStepContext({ title: 'Empty', description: null }, []);
    expect(ctx).toContain('Empty');
  });
});
