import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

export function getNodeConnections(nodeId: string, edges: readonly Edge[]): readonly Edge[] {
  return edges.filter(e => e.source_id === nodeId || e.target_id === nodeId);
}

export function getConnectedNodeIds(nodeId: string, edges: readonly Edge[]): readonly string[] {
  const connections = getNodeConnections(nodeId, edges);
  const ids = new Set<string>();
  for (const edge of connections) {
    if (edge.source_id !== nodeId) ids.add(edge.source_id);
    if (edge.target_id !== nodeId) ids.add(edge.target_id);
  }
  return Array.from(ids);
}

export function getChain(
  startNodeId: string,
  nodes: readonly Node[],
  edges: readonly Edge[]
): readonly Node[] {
  const visited = new Set<string>();
  const chain: Node[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) chain.push(node);

    const outgoing = edges.filter(e => e.source_id === nodeId);
    for (const edge of outgoing) {
      traverse(edge.target_id);
    }
  }

  traverse(startNodeId);
  return chain;
}
