'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { toGraphNode, toGraphLink, FORCE_CONFIG, type GraphNode, type GraphLink } from '@/lib/graph/layout';

interface GraphCanvasProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly activeTypes: readonly string[];
  readonly onSelectNode: (node: Node | null) => void;
}

export function GraphCanvas({ nodes, edges, activeTypes, onSelectNode }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const filteredNodes = nodes.filter(n => activeTypes.includes(n.node_type));
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(e => filteredNodeIds.has(e.source_id) && filteredNodeIds.has(e.target_id));

  const graphNodes = filteredNodes.map(toGraphNode);
  const graphLinks = filteredEdges.map(toGraphLink);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#444');

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrowhead)');

    // Drag behavior
    const dragBehavior = d3.drag<SVGCircleElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Nodes
    const node = g.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(graphNodes)
      .join('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', 'none')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => onSelectNode(d.data))
      .call(dragBehavior);

    // Labels
    const label = g.append('g')
      .selectAll('text')
      .data(graphNodes)
      .join('text')
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title)
      .attr('font-size', 9)
      .attr('fill', '#888')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.radius + 12);

    // Simulation
    const simulation = d3.forceSimulation(graphNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphLinks).id(d => d.id).distance(FORCE_CONFIG.linkDistance))
      .force('charge', d3.forceManyBody().strength(FORCE_CONFIG.charge))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(FORCE_CONFIG.centerStrength))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.radius + 5))
      .on('tick', () => {
        link
          .attr('x1', d => (d.source as GraphNode).x ?? 0)
          .attr('y1', d => (d.source as GraphNode).y ?? 0)
          .attr('x2', d => (d.target as GraphNode).x ?? 0)
          .attr('y2', d => (d.target as GraphNode).y ?? 0);
        node
          .attr('cx', d => d.x ?? 0)
          .attr('cy', d => d.y ?? 0);
        label
          .attr('x', d => d.x ?? 0)
          .attr('y', d => d.y ?? 0);
      });

    simulationRef.current = simulation;

    return () => { simulation.stop(); };
  }, [filteredNodes.length, filteredEdges.length, activeTypes]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-gray-950"
      style={{ minHeight: '500px' }}
    />
  );
}
