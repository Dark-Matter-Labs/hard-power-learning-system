import { describe, it, expect } from 'vitest';
import { buildMissionPathwaysMessage, buildCloseContactsMessage } from '../agents';
import type { MissionPathwaysData, CloseContactsData } from '../select';

const fullMissionData: MissionPathwaysData = {
  stageCounts: { hypothesis: 3, uncertainty: 2, navigation: 1 },
  recentlyMoved: [{ id: 'h1', title: 'Climate Risk Hunch', lifecycle_stage: 'navigation' }],
  activeCommitments: [{ id: 'c1', title: 'Pilot deployment' }],
  completedCommitments: [{ id: 'c2', title: 'Stakeholder mapping' }],
  testsWithActivity: [{ id: 't1', title: 'Field sensor test' }],
  stuckHunches: [{ id: 'h2', title: 'Slow Hunch', lifecycle_stage: 'uncertainty', daysStuck: 45 }],
};

const emptyMissionData: MissionPathwaysData = {
  stageCounts: {},
  recentlyMoved: [],
  activeCommitments: [],
  completedCommitments: [],
  testsWithActivity: [],
  stuckHunches: [],
};

const fullContactsData: CloseContactsData = {
  learnings: [{ id: 'l1', title: 'Heat resilience patterns', summary: 'Urban areas show...' }],
  testsWithActivity: [{ id: 't1', title: 'Cooling intervention test' }],
  coherentHunches: [{ id: 'h1', title: 'Mycorrhizal corridors', lifecycle_stage: 'coherence' }],
};

const emptyContactsData: CloseContactsData = {
  learnings: [],
  testsWithActivity: [],
  coherentHunches: [],
};

describe('buildMissionPathwaysMessage', () => {
  it('includes stage counts', () => {
    const msg = buildMissionPathwaysMessage(fullMissionData);
    expect(msg).toContain('hypothesis: 3');
    expect(msg).toContain('uncertainty: 2');
  });

  it('includes recently moved hunches', () => {
    const msg = buildMissionPathwaysMessage(fullMissionData);
    expect(msg).toContain('Climate Risk Hunch');
    expect(msg).toContain('navigation');
  });

  it('includes stuck hunches with days', () => {
    const msg = buildMissionPathwaysMessage(fullMissionData);
    expect(msg).toContain('Slow Hunch');
    expect(msg).toContain('45');
  });

  it('does not throw on empty data', () => {
    expect(() => buildMissionPathwaysMessage(emptyMissionData)).not.toThrow();
  });
});

describe('buildCloseContactsMessage', () => {
  it('includes learning titles and summaries', () => {
    const msg = buildCloseContactsMessage(fullContactsData);
    expect(msg).toContain('Heat resilience patterns');
    expect(msg).toContain('Urban areas show...');
  });

  it('includes coherent hunches', () => {
    const msg = buildCloseContactsMessage(fullContactsData);
    expect(msg).toContain('Mycorrhizal corridors');
    expect(msg).toContain('coherence');
  });

  it('returns fallback message when no data', () => {
    const msg = buildCloseContactsMessage(emptyContactsData);
    expect(msg).toContain('No significant activity');
  });
});
