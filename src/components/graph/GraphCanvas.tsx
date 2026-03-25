'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import {
  toGraphNode, toGraphLink, FORCE_CONFIG,
  CARD_WIDTH, CARD_HEIGHT,
  type GraphNode, type GraphLink,
} from '@/lib/graph/layout';

interface GraphCanvasProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly activeTypes: readonly string[];
  readonly onSelectNode: (node: Node | null) => void;
  /**
   * Called on empty-canvas click.
   * screenX/Y: viewport coords for position:fixed card placement.
   * canvasX/Y: D3-space coords for future node placement.
   */
  readonly onCanvasClick?: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

const EDGE_COLORS: Record<string, string> = {
  supports: '#1D9E75',
  contradicts: '#D85A30',
  evolved_from: '#7F77DD',
  tested_by: '#D4537E',
  challenges: '#BA7517',
  requires: '#378ADD',
  authored_by: '#888780',
  works_at: '#888780',
};

export function GraphCanvas({ nodes, edges, activeTypes, onSelectNode, onCanvasClick }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const filteredNodes = nodes.filter(n => activeTypes.includes(n.node_type));
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(e => filteredNodeIds.has(e.source_id) && filteredNodeIds.has(e.target_id));

  const graphNodes = filteredNodes.map(toGraphNode);
  const graphLinks = filteredEdges.map(toGraphLink);

  const handleCanvasClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if ((event.target as SVGElement).closest('.node-card')) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !onCanvasClick) return;
    // Screen coords: for position:fixed card placement
    const screenX = event.clientX;
    const screenY = event.clientY;
    // Canvas coords: invert D3 zoom transform for future simulation placement
    const g = svgRef.current?.querySelector('g');
    const transform = g ? d3.zoomTransform(g as unknown as Element) : d3.zoomIdentity;
    const [canvasX, canvasY] = transform.invert([event.clientX - rect.left, event.clientY - rect.top]);
    onCanvasClick(screenX, screenY, canvasX, canvasY);
  }, [onCanvasClick]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .on('zoom', event => { g.attr('transform', event.transform); });
    svg.call(zoom);

    // Defs: arrowheads per edge type
    const defs = svg.append('defs');
    Object.entries(EDGE_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', CARD_WIDTH / 2 + 8)
        .attr('refY', 0)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', color);
    });

    // Links — curved quadratic bezier
    const link = g.append('g').attr('class', 'links')
      .selectAll<SVGPathElement, GraphLink>('path')
      .data(graphLinks)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', d => EDGE_COLORS[d.edge_type] ?? '#444')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', d => `url(#arrow-${d.edge_type})`);

    // Drag behavior on <g> elements
    const dragBehavior = d3.drag<SVGGElement, GraphNode>()
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

    // Node cards
    const cardG = g.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(graphNodes)
      .join('g')
      .attr('class', 'node-card')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectNode(d.data);
      })
      .call(dragBehavior);

    // Card background
    cardG.append('rect')
      .attr('width', CARD_WIDTH)
      .attr('height', CARD_HEIGHT)
      .attr('rx', 8)
      .attr('fill', '#111827')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1);

    // Left accent bar
    cardG.append('rect')
      .attr('width', 3)
      .attr('height', CARD_HEIGHT)
      .attr('rx', 2)
      .attr('fill', d => d.color);

    // Type label
    cardG.append('text')
      .text(d => d.node_type.replace(/_/g, ' '))
      .attr('x', 12)
      .attr('y', 20)
      .attr('font-size', 9)
      .attr('fill', d => d.color)
      .attr('font-weight', '600')
      .attr('text-transform', 'uppercase')
      .attr('letter-spacing', '0.05em');

    // Title
    cardG.append('text')
      .text(d => truncate(d.title, 28))
      .attr('x', 12)
      .attr('y', 38)
      .attr('font-size', 11)
      .attr('fill', '#e5e7eb')
      .attr('font-weight', '500');

    // Confidence dots (5 small circles)
    cardG.each(function(d) {
      const level = d.data.confidence_level ?? 0;
      for (let i = 0; i < 5; i++) {
        d3.select(this).append('circle')
          .attr('cx', 12 + i * 10)
          .attr('cy', 60)
          .attr('r', 3)
          .attr('fill', i < level ? d.color : '#374151');
      }
    });

    // First domain tag (if any)
    cardG.filter(d => d.data.domain_tags.length > 0)
      .append('text')
      .text(d => `#${d.data.domain_tags[0]}`)
      .attr('x', CARD_WIDTH - 8)
      .attr('y', CARD_HEIGHT - 10)
      .attr('font-size', 9)
      .attr('fill', '#4b5563')
      .attr('text-anchor', 'end');

    // Simulation
    const simulation = d3.forceSimulation(graphNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphLinks)
        .id(d => d.id)
        .distance(FORCE_CONFIG.linkDistance))
      .force('charge', d3.forceManyBody().strength(FORCE_CONFIG.charge))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(FORCE_CONFIG.centerStrength))
      .force('collide', d3.forceCollide<GraphNode>().radius(FORCE_CONFIG.collideRadius))
      .on('tick', () => {
        cardG.attr('transform', d =>
          `translate(${(d.x ?? 0) - CARD_WIDTH / 2}, ${(d.y ?? 0) - CARD_HEIGHT / 2})`
        );
        link.attr('d', d => {
          const sx = (d.source as GraphNode).x ?? 0;
          const sy = (d.source as GraphNode).y ?? 0;
          const tx = (d.target as GraphNode).x ?? 0;
          const ty = (d.target as GraphNode).y ?? 0;
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2 - 30;
          return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
        });
      });

    simulationRef.current = simulation;
    return () => { simulation.stop(); };
  }, [filteredNodes.length, filteredEdges.length, activeTypes]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: '#030712' }}
      onClick={handleCanvasClick}
    />
  );
}
