import { describe, it, expect } from 'vitest';
import { evaluateStagePromotion, type HunchStats } from '../autoPromote';

const base: HunchStats = {
  currentStage: 'hypothesis',
  connectedAssumptions: 0,
  connectedTests: 0,
  reinforcedEdges: 0,
  linkedCommitments: 0,
  activeCommitments: 0,
  testsWithSignals: 0,
  daysInCurrentStage: 0,
  linkedLearnings: 0,
};

describe('evaluateStagePromotion — hypothesis → uncertainty', () => {
  it('promotes when 2+ assumptions connected', () => {
    const result = evaluateStagePromotion({ ...base, connectedAssumptions: 2 });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('uncertainty');
  });

  it('promotes when 1+ test connected', () => {
    const result = evaluateStagePromotion({ ...base, connectedTests: 1 });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('uncertainty');
  });

  it('does not promote with 1 assumption and 0 tests', () => {
    const result = evaluateStagePromotion({ ...base, connectedAssumptions: 1 });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — uncertainty → navigation', () => {
  it('promotes when 1+ test and 1+ signal received', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'uncertainty',
      connectedTests: 1,
      testsWithSignals: 1,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('navigation');
  });

  it('does not promote with tests but no signals', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'uncertainty',
      connectedTests: 2,
      testsWithSignals: 0,
    });
    expect(result.advance).toBe(false);
  });

  it('does not promote with signals but no tests', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'uncertainty',
      connectedTests: 0,
      testsWithSignals: 1,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — navigation → coherence', () => {
  it('promotes when 2+ reinforced edges and 1+ active commitment', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'navigation',
      reinforcedEdges: 2,
      activeCommitments: 1,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('coherence');
  });

  it('does not promote with reinforced edges but no active commitment', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'navigation',
      reinforcedEdges: 3,
      activeCommitments: 0,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — coherence → holding', () => {
  it('promotes when 30+ days in stage and 2+ learnings', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'coherence',
      daysInCurrentStage: 30,
      linkedLearnings: 2,
    });
    expect(result.advance).toBe(true);
    expect(result.newStage).toBe('holding');
  });

  it('does not promote before 30 days even with learnings', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'coherence',
      daysInCurrentStage: 29,
      linkedLearnings: 2,
    });
    expect(result.advance).toBe(false);
  });

  it('does not promote with 30 days but fewer than 2 learnings', () => {
    const result = evaluateStagePromotion({
      ...base,
      currentStage: 'coherence',
      daysInCurrentStage: 31,
      linkedLearnings: 1,
    });
    expect(result.advance).toBe(false);
  });
});

describe('evaluateStagePromotion — terminal stages', () => {
  it('never auto-promotes from holding', () => {
    const result = evaluateStagePromotion({ ...base, currentStage: 'holding' });
    expect(result.advance).toBe(false);
  });

  it('never promotes from archived', () => {
    const result = evaluateStagePromotion({ ...base, currentStage: 'archived' });
    expect(result.advance).toBe(false);
  });
});
