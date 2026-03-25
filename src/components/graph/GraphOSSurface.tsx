'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { GraphCanvas } from './GraphCanvas';
import { GraphTopBar, type GraphView } from './GraphTopBar';
import { DashboardSidebar } from './DashboardSidebar';
import { InlineCaptureCard } from './InlineCaptureCard';
import { NodeDetailPanel } from './NodeDetailPanel';

const NODE_TYPE_OPTIONS = [
  { id: 'hunch', label: 'Hunch', color: '#7F77DD' },
  { id: 'assumption_background', label: 'Background Assumption', color: '#1D9E75' },
  { id: 'assumption_foreground', label: 'Foreground Assumption', color: '#D85A30' },
  { id: 'test', label: 'Test', color: '#D4537E' },
  { id: 'learning', label: 'Learning', color: '#378ADD' },
  { id: 'option', label: 'Option', color: '#BA7517' },
  { id: 'entity', label: 'Entity', color: '#888780' },
  { id: 'site', label: 'Site', color: '#639922' },
  { id: 'commitment', label: 'Commitment', color: '#185FA5' },
] as const;

const ALL_TYPE_IDS = NODE_TYPE_OPTIONS.map(t => t.id);

export function GraphOSSurface() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([...ALL_TYPE_IDS]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [capturePos, setCapturePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [currentView, setCurrentView] = useState<GraphView>('force');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      try {
        const [nodesResult, edgesResult] = await Promise.all([
          supabase.from('nodes').select('*'),
          supabase.from('edges').select('*'),
        ]);

        if (nodesResult.error) throw nodesResult.error;
        if (edgesResult.error) throw edgesResult.error;

        setNodes(nodesResult.data ?? []);
        setEdges(edgesResult.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load graph data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    const channel = supabase
      .channel('nodes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nodes' },
        payload => {
          if (payload.eventType === 'INSERT') {
            setNodes(prev => [...prev, payload.new as Node]);
          } else if (payload.eventType === 'UPDATE') {
            setNodes(prev =>
              prev.map(n => (n.id === (payload.new as Node).id ? (payload.new as Node) : n))
            );
          } else if (payload.eventType === 'DELETE') {
            setNodes(prev => prev.filter(n => n.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCanvasClick = useCallback(
    (screenX: number, screenY: number, _canvasX: number, _canvasY: number) => {
      setSelectedNode(null);
      setCapturePos({ x: screenX, y: screenY });
    },
    []
  );

  const handleToggleType = useCallback((type: string) => {
    setActiveTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }, []);

  const handleNodeCreated = useCallback((_nodeId: string) => {
    setCapturePos(null);
  }, []);

  const handleSelectNode = useCallback((node: Node | null) => {
    setSelectedNode(node);
    setCapturePos(null);
  }, []);

  const sidebarStats = {
    awaitingReview: nodes.filter(n => n.status === 'llm_reviewed').length,
    promotedThisWeek: nodes.filter(n => {
      if (n.status !== 'promoted') return false;
      const updated = new Date(n.updated_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return updated >= weekAgo;
    }).length,
    activeTests: nodes.filter(n => n.node_type === 'test' && n.status !== 'archived').length,
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading graph…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen bg-gray-950 flex items-center justify-center text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gray-950">
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        activeTypes={activeTypes}
        onSelectNode={handleSelectNode}
        onCanvasClick={handleCanvasClick}
      />

      <GraphTopBar
        activeTypes={activeTypes}
        onToggleType={handleToggleType}
        nodeTypes={NODE_TYPE_OPTIONS}
        currentView={currentView}
        onChangeView={setCurrentView}
      />

      <DashboardSidebar
        stats={sidebarStats}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(prev => !prev)}
      />

      {capturePos !== null && (
        <InlineCaptureCard
          position={capturePos}
          onClose={() => setCapturePos(null)}
          onCreated={handleNodeCreated}
        />
      )}

      {selectedNode !== null && (
        <NodeDetailPanel
          node={selectedNode}
          edges={edges}
          allNodes={nodes}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
