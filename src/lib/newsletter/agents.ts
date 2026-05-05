import type { MissionPathwaysData, CloseContactsData } from './select';

export const MISSION_PATHWAYS_PROMPT = `You are writing a plain-text field intelligence brief for an internal team meeting.
Write in a concise, factual style. No bullet overload — use short paragraphs.
Structure: Opening status line → Hunch movement → Active commitments → Tests with signals → [Optional] Agenda flag if anything is stuck or needs decision.
Do not include headers or markdown. Plain text only.
Length: 200–350 words.`;

export const CLOSE_CONTACTS_PROMPT = `You are writing a plain-text field update for colleagues doing related work in the field.
Write as one practitioner sharing with another — warm, honest, reflective.
Structure: What we've been learning → What tested out → Where our thinking has landed.
Do not include headers or markdown. Plain text only.
Length: 250–400 words.`;

export function buildMissionPathwaysMessage(data: MissionPathwaysData): string {
  const lines: string[] = ['## Knowledge Graph — Last 6 Weeks', ''];

  const stageOrder = ['hypothesis', 'uncertainty', 'navigation', 'coherence', 'holding'];
  const stageLines = stageOrder
    .filter(s => (data.stageCounts[s] ?? 0) > 0)
    .map(s => `${s}: ${data.stageCounts[s]}`);
  if (stageLines.length > 0) {
    lines.push('Hunch stages: ' + stageLines.join(', '));
  }

  if (data.recentlyMoved.length > 0) {
    lines.push('');
    lines.push('Recently moved:');
    for (const h of data.recentlyMoved) {
      lines.push(`- "${h.title}" → ${h.lifecycle_stage}`);
    }
  }

  if (data.activeCommitments.length > 0) {
    lines.push('');
    lines.push('Active commitments:');
    for (const c of data.activeCommitments) {
      lines.push(`- ${c.title}`);
    }
  }

  if (data.completedCommitments.length > 0) {
    lines.push('');
    lines.push('Completed this period:');
    for (const c of data.completedCommitments) {
      lines.push(`- ${c.title}`);
    }
  }

  if (data.testsWithActivity.length > 0) {
    lines.push('');
    lines.push('Tests with recent activity:');
    for (const t of data.testsWithActivity) {
      lines.push(`- ${t.title}`);
    }
  }

  if (data.stuckHunches.length > 0) {
    lines.push('');
    lines.push('Stuck (30+ days in same stage):');
    for (const h of data.stuckHunches) {
      lines.push(`- "${h.title}" (${h.lifecycle_stage}, ${h.daysStuck} days)`);
    }
  }

  return lines.join('\n');
}

export function buildCloseContactsMessage(data: CloseContactsData): string {
  const lines: string[] = ['## Field Intelligence — Last 6 Weeks', ''];

  if (data.learnings.length > 0) {
    lines.push('Learnings:');
    for (const l of data.learnings) {
      lines.push(`- "${l.title}"${l.summary ? ': ' + l.summary : ''}`);
    }
  }

  if (data.testsWithActivity.length > 0) {
    lines.push('');
    lines.push('Tests with recent activity:');
    for (const t of data.testsWithActivity) {
      lines.push(`- ${t.title}`);
    }
  }

  if (data.coherentHunches.length > 0) {
    lines.push('');
    lines.push('Ideas that have reached coherence or are being held:');
    for (const h of data.coherentHunches) {
      lines.push(`- "${h.title}" (${h.lifecycle_stage})`);
    }
  }

  if (data.learnings.length === 0 && data.testsWithActivity.length === 0 && data.coherentHunches.length === 0) {
    lines.push('No significant activity in the last 6 weeks.');
  }

  return lines.join('\n');
}
