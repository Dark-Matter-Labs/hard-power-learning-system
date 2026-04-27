import { describe, it, expect } from 'vitest';
import { evaluateStagePromotion, type HunchStats } from '../autoPromote';

const base: HunchStats = {
  currentStage: 'divergence',
  connectedAssumptions: 0,
  connectedTests: 0,
  reinforcedEdges: 0,
  linkedCommitments: 0,
  activeCommitments: 0,
  testsWithSignals: 0,
};

describe('evaluateStagePromotion — divergence → attractor', () => {
  it('promotes when 2+ assumptions connected', () => {
    const result = evaluateStagePromotion({ ...base, connectedAssumptions: 2 });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('attractor');
  });

  it('promotes when 1+ test connected', () => {
    const result = evaluateStagePromotion({ ...base, connectedTests: 1 });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('attractor');
  });

  it('does not promote with 1 assumption and 0 tests', () => {
    const result = evaluateStagePromotion({ ...base, connectedAssumptions: 1 });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — attractor → convergence', () => {
  it('promotes when 2+ reinforced edges and 1+ linked commitment', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'attractor',
      reinforcedEdges: 2,
      linkedCommitments: 1,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('convergence');
  });

  it('does not promote with reinforced edges but no commitment', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'attractor',
      reinforcedEdges: 3,
      linkedCommitments: 0,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — convergence → execution', () => {
  it('promotes when active commitment and tests with signals', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'convergence',
      activeCommitments: 1,
      testsWithSignals: 1,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('execution');
  });

  it('does not promote without signals', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'convergence',
      activeCommitments: 1,
      testsWithSignals: 0,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — terminal stages', () => {
  it('never promotes from execution', () => {
    const result = evaluateStagePromotion({ ...base, currentStage: 'execution' });
    expect(result.advance).toBe(false);
  });

  it('never promotes from archived', () => {
    const result = evaluateStagePromotion({ ...base, currentStage: 'archived' });
    expect(result.advance).toBe(false);
  });
});
