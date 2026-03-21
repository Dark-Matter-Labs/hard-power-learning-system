import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { NodeTypeBadge } from '@/components/shared/NodeTypeBadge';
import { getNodeConnections } from '@/lib/graph/queries';

interface NodeDetailPanelProps {
  readonly node: Node;
  readonly edges: readonly Edge[];
  readonly allNodes: readonly Node[];
  readonly onClose: () => void;
}

export function NodeDetailPanel({ node, edges, allNodes, onClose }: NodeDetailPanelProps) {
  const connections = getNodeConnections(node.id, edges);
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 bg-gray-950 border-l border-gray-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <NodeTypeBadge nodeType={node.node_type} />
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-lg">×</button>
      </div>

      <h3 className="text-sm font-bold text-gray-200 mb-2">{node.title}</h3>

      {node.description && (
        <p className="text-xs text-gray-500 mb-3">{node.description}</p>
      )}

      {node.domain_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {node.domain_tags.map(tag => (
            <span key={tag} className="bg-node-site text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {connections.length > 0 && (
        <div className="border-t border-gray-800 pt-3">
          <div className="text-xs text-gray-600 mb-2">CONNECTIONS ({connections.length})</div>
          {connections.map(edge => {
            const isSource = edge.source_id === node.id;
            const otherNodeId = isSource ? edge.target_id : edge.source_id;
            const otherNode = nodeMap.get(otherNodeId);
            return (
              <div key={edge.id} className="text-xs text-gray-400 mb-1">
                {isSource ? '\u2192' : '\u2190'} {edge.edge_type} {otherNode?.title ?? 'Unknown'}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-gray-800 pt-3 mt-3">
        <div className="text-xs text-gray-600">CREATED</div>
        <div className="text-xs text-gray-400 mt-1">
          {new Date(node.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
