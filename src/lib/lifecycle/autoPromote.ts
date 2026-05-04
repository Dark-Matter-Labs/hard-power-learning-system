export type LifecycleStage =
  | 'hypothesis'
  | 'uncertainty'
  | 'navigation'
  | 'coherence'
  | 'holding'
  | 'archived';

export interface HunchStats {
  readonly currentStage: LifecycleStage;
  readonly connectedAssumptions: number;
  readonly connectedTests: number;
  readonly reinforcedEdges: number;
  readonly linkedCommitments: number;
  readonly activeCommitments: number;
  readonly testsWithSignals: number;
  readonly daysInCurrentStage: number;
  readonly linkedLearnings: number;
}

export interface StageDecision {
  readonly advance: boolean;
  readonly newStage?: LifecycleStage;
  readonly reason?: string;
}

export function evaluateStagePromotion(stats: HunchStats): StageDecision {
  const {
    currentStage,
    connectedAssumptions,
    connectedTests,
    reinforcedEdges,
    activeCommitments,
    testsWithSignals,
    daysInCurrentStage,
    linkedLearnings,
  } = stats;

  if (currentStage === 'hypothesis') {
    if (connectedAssumptions >= 2) {
      return { advance: true, newStage: 'uncertainty', reason: `${connectedAssumptions} assumptions connected` };
    }
    if (connectedTests >= 1) {
      return { advance: true, newStage: 'uncertainty', reason: `${connectedTests} test(s) linked` };
    }
  }

  if (currentStage === 'uncertainty') {
    if (connectedTests >= 1 && testsWithSignals >= 1) {
      return { advance: true, newStage: 'navigation', reason: `Active inquiry: ${connectedTests} test(s) with ${testsWithSignals} signal(s)` };
    }
  }

  if (currentStage === 'navigation') {
    if (reinforcedEdges >= 2 && activeCommitments >= 1) {
      return { advance: true, newStage: 'coherence', reason: `${reinforcedEdges} reinforced edges, active commitment` };
    }
  }

  if (currentStage === 'coherence') {
    if (daysInCurrentStage >= 30 && linkedLearnings >= 2) {
      return { advance: true, newStage: 'holding', reason: `${daysInCurrentStage} days in coherence with ${linkedLearnings} learnings` };
    }
  }

  return { advance: false };
}

export async function checkHunchPromotion(nodeId: string): Promise<StageDecision> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: node } = await supabase
      .from('nodes')
      .select('lifecycle_stage, node_type, stage_transitioned_at, created_at')
      .eq('id', nodeId)
      .single();

    if (!node || node.node_type !== 'hunch') return { advance: false };

    const { data: edgesFromHunch } = await supabase.from('edges').select('target_id').eq('source_id', nodeId);
    const { data: edgesToHunch } = await supabase.from('edges').select('source_id').eq('target_id', nodeId);

    let connectedAssumptions = 0;
    let connectedTests = 0;
    let linkedCommitments = 0;
    let activeCommitments = 0;

    if (edgesFromHunch?.length) {
      const tids = edgesFromHunch.map(e => e.target_id as string);
      const { count: aCount } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
        .in('id', tids).in('node_type', ['assumption_background', 'assumption_foreground']);
      connectedAssumptions = aCount ?? 0;

      const { count: tCount } = await supabase.from('nodes').select('id', { count: 'exact', head: true })
        .in('id', tids).eq('node_type', 'test');
      connectedTests = tCount ?? 0;

      const { data: commitmentRows } = await supabase.from('nodes').select('id, status')
        .in('id', tids).eq('node_type', 'commitment');
      linkedCommitments = commitmentRows?.length ?? 0;
      activeCommitments = commitmentRows?.filter(c => c.status === 'promoted').length ?? 0;
    }

    const { count: reinforcedEdges } = await supabase.from('edges').select('id', { count: 'exact', head: true })
      .eq('source_id', nodeId).eq('path_status', 'reinforced');

    let testsWithSignals = 0;
    if (edgesFromHunch?.length) {
      const tids = edgesFromHunch.map(e => e.target_id as string);
      const { data: testNodes } = await supabase.from('nodes')
        .select('id').in('id', tids).eq('node_type', 'test');
      if (testNodes?.length) {
        const testIds = testNodes.map(t => t.id as string);
        const { data: signalEdges } = await supabase.from('edges')
          .select('source_id').in('target_id', testIds);
        if (signalEdges?.length) {
          const sourceIds = [...new Set(signalEdges.map(e => e.source_id as string))];
          const { count } = await supabase.from('nodes')
            .select('id', { count: 'exact', head: true })
            .in('id', sourceIds).eq('node_type', 'signal');
          testsWithSignals = count ?? 0;
        }
      }
    }

    const allConnectedIds = [
      ...(edgesFromHunch ?? []).map(e => e.target_id as string),
      ...(edgesToHunch ?? []).map(e => e.source_id as string),
    ];
    let linkedLearnings = 0;
    if (allConnectedIds.length > 0) {
      const { count: lCount } = await supabase.from('nodes')
        .select('id', { count: 'exact', head: true })
        .in('id', allConnectedIds).eq('node_type', 'learning');
      linkedLearnings = lCount ?? 0;
    }

    const transitionedAt = node.stage_transitioned_at
      ? new Date(node.stage_transitioned_at as string)
      : new Date(node.created_at as string);
    const daysInCurrentStage = Math.floor((Date.now() - transitionedAt.getTime()) / (1000 * 60 * 60 * 24));

    const VALID_STAGES: readonly LifecycleStage[] = ['hypothesis', 'uncertainty', 'navigation', 'coherence', 'holding', 'archived'];
    const rawStage = node.lifecycle_stage as string;
    const currentStage: LifecycleStage = VALID_STAGES.includes(rawStage as LifecycleStage)
      ? (rawStage as LifecycleStage)
      : 'hypothesis';

    const stats: HunchStats = {
      currentStage,
      connectedAssumptions,
      connectedTests,
      reinforcedEdges: reinforcedEdges ?? 0,
      linkedCommitments,
      activeCommitments,
      testsWithSignals,
      daysInCurrentStage,
      linkedLearnings,
    };

    return evaluateStagePromotion(stats);
  } catch (err) {
    process.stderr.write(`[lifecycle] checkHunchPromotion error for ${nodeId}: ${String(err)}\n`);
    return { advance: false };
  }
}
