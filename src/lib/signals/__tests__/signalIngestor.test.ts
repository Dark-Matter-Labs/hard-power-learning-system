import { describe, it, expect } from 'vitest';
import { checkDailyQuota, buildSignalNode } from '../signalIngestor';

describe('checkDailyQuota', () => {
  it('allows signals when under the cap', () => {
    expect(checkDailyQuota(15, 20)).toBe(true);
  });

  it('blocks signals when at or over the cap', () => {
    expect(checkDailyQuota(20, 20)).toBe(false);
    expect(checkDailyQuota(25, 20)).toBe(false);
  });
});

describe('buildSignalNode', () => {
  it('creates a node with flagged_for_review status', () => {
    const node = buildSignalNode({
      title: 'Rewilding news',
      summary: 'New study on rewilding impacts',
      sourceType: 'web',
      sourceAttribution: 'https://example.com/article',
      topicNodeId: 'topic-1',
      authorId: 'user-1',
    });
    expect(node.status).toBe('flagged_for_review');
    expect(node.node_type).toBe('signal');
    expect((node.content as { source_attribution: string }).source_attribution).toBe('https://example.com/article');
  });
});
