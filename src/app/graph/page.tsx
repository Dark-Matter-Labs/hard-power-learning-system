'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Node, NodeType } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { NodeDetailPanel } from '@/components/graph/NodeDetailPanel';
import { FilterBar } from '@/components/graph/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';

export default function GraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchData = async () => {
      const [nodesRes, edgesRes, typesRes] = await Promise.all([
        supabase.from('nodes').select('*').in('status', ['promoted', 'human_reviewed']),
        supabase.from('edges').select('*'),
        supabase.from('node_types').select('*').eq('is_active', true).order('sort_order'),
      ]);

      if (nodesRes.data) setNodes(nodesRes.data as unknown as Node[]);
      if (edgesRes.data) setEdges(edgesRes.data as unknown as Edge[]);
      if (typesRes.data) {
        const types = typesRes.data as unknown as NodeType[];
        setNodeTypes(types);
        setActiveTypes(types.map(t => t.id));
      }
    };

    fetchData();
  }, []);

  const handleToggleType = (typeId: string) => {
    setActiveTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  if (nodes.length === 0) {
    return (
      <EmptyState
        title="Capture your first hunch to start building the graph"
        actionLabel="Go to Capture"
        actionHref="/capture"
      />
    );
  }

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col relative">
      <FilterBar
        activeTypes={activeTypes}
        onToggleType={handleToggleType}
        nodeTypes={nodeTypes}
      />
      <div className="flex-1 relative">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          activeTypes={activeTypes}
          onSelectNode={setSelectedNode}
        />
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            edges={edges}
            allNodes={nodes}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 border-t border-gray-800 justify-center">
        {nodeTypes.map(type => (
          <div key={type.id} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: type.color ?? '#888' }}
            />
            <span className="text-[10px] text-gray-500">{type.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
