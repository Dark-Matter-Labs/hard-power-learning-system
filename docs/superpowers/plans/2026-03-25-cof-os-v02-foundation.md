# COF OS v0.2 — Foundation: Graph as Home + Node Cards + Inline Capture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the force-directed graph the root OS surface (`/`), replace dot nodes with structured SVG cards, add inline hunch capture from the canvas, and lay font/colour groundwork for Martin's design direction.

**Architecture:** The graph becomes a fullscreen canvas at `/`. A fixed, translucent NavBar overlays the top. A collapsible left sidebar shows dashboard stats. D3 handles physics; card rendering stays in SVG `<g>` groups (no foreignObject). An HTML overlay div handles the inline capture card (floating at click position). Routing moves graph data-fetching logic from `/graph/page.tsx` to `/page.tsx`; the old graph route redirects.

**Tech Stack:** Next.js 16 App Router, React 19, D3 v7, Supabase, Tailwind CSS v4, TypeScript

---

## File Map

| File | Change | Responsibility |
|------|--------|---------------|
| `tailwind.config.ts` | **No change** | v4 ignores this file for theme tokens — tokens go in globals.css |
| `src/app/globals.css` | Modify | Add COF colour tokens + font variables inside `@theme` block |
| `src/app/layout.tsx` | Modify | Remove nav spacing, import display font, make main fullscreen |
| `src/app/page.tsx` | Rewrite | Graph OS surface (was dashboard stats) |
| `src/app/graph/page.tsx` | Rewrite | Redirect to `/` |
| `src/components/layout/NavBar.tsx` | Modify | Fixed overlay, transparent bg, updated links |
| `src/components/graph/GraphCanvas.tsx` | Rewrite | SVG card nodes instead of circles, empty-space click handler |
| `src/components/graph/FilterBar.tsx` | Delete (absorb into GraphTopBar) | — |
| `src/components/graph/GraphTopBar.tsx` | Create | Overlaid filter pills + view switcher stub |
| `src/components/graph/DashboardSidebar.tsx` | Create | Collapsible left panel: stats + recent activity |
| `src/components/graph/InlineCaptureCard.tsx` | Create | Floating capture form on canvas |
| `src/lib/graph/layout.ts` | Modify | Add card dimensions, keep GraphNode/GraphLink types |
| `src/lib/graph/layout.ts` | — | Card WIDTH=200, HEIGHT=80 constants exported |

---

## Task 1: Font groundwork + COF colour tokens

> **Tailwind v4 note:** `tailwind.config.ts` is ignored in v4. All colour and font tokens **must** live inside the `@theme` block in `src/app/globals.css`. Do **not** touch `tailwind.config.ts`.

**Files:**
- Modify: `src/app/globals.css` (tokens go into the existing `@theme inline` block)
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add colour + font tokens to `@theme` in globals.css**

Open `src/app/globals.css`. Find the existing `@theme inline {` block and add the COF colour tokens and font stack variables inside it:

```css
/* Inside the existing @theme inline { … } block in globals.css */

  /* Node-type colours */
  --color-node-hunch: #7F77DD;
  --color-node-assumption-bg: #1D9E75;
  --color-node-assumption-fg: #D85A30;
  --color-node-test: #D4537E;
  --color-node-learning: #378ADD;
  --color-node-option: #BA7517;
  --color-node-entity: #888780;
  --color-node-site: #639922;
  --color-node-commitment: #185FA5;

  /* COF earth-tone palette (groundwork for Martin's design) */
  --color-cof-earth: #8B7355;
  --color-cof-ocean: #2D6A7F;
  --color-cof-atmosphere: #6B8AA3;
  --color-cof-canopy: #5A7247;

  /* Font stacks — swap with Martin's fonts when delivered */
  --font-display: 'Inter', system-ui, sans-serif; /* Will become PCI-derived dot font */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
```

In v4, `--color-*` variables inside `@theme` are automatically available as Tailwind utilities (e.g. `bg-node-hunch`, `text-cof-ocean`). `--font-*` variables become `font-display`, `font-sans`, etc.

- [ ] **Step 2: (No-op) Font CSS variable stubs**

Font variables are already declared in the `@theme` block above — no separate `:root` block needed.

- [ ] **Step 3: Update layout.tsx font imports**

In `src/app/layout.tsx`, add the `variable` assignments so CSS vars resolve:

```typescript
// The existing Inter import already sets --font-inter
// Map our new CSS variables to the loaded font
// Add this inside <body> className:
// Change:  font-sans
// Keep as-is — Inter is already loaded; the CSS var just adds the alias
```

The layout.tsx body className already has `font-sans` which resolves to Inter via the tailwind config. No change needed to the import itself — the CSS vars in globals.css provide the aliases. ✓

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add COF colour tokens and font variables to @theme in globals.css (Tailwind v4)"
```

---

## Task 2: Routing restructure — graph as home

**Files:**
- Rewrite: `src/app/page.tsx`
- Rewrite: `src/app/graph/page.tsx`
- Modify: `src/components/layout/NavBar.tsx`

- [ ] **Step 1: Write redirect for old graph route**

```typescript
// src/app/graph/page.tsx
import { redirect } from 'next/navigation';

export default function GraphRedirect() {
  redirect('/');
}
```

- [ ] **Step 2: Update NavBar links**

In `src/components/layout/NavBar.tsx`, update the `links` array and active detection:

```typescript
const links = [
  { href: '/', label: 'Graph' },        // was 'Dashboard' — now graph is home
  { href: '/capture', label: 'Capture' },
  { href: '/review', label: 'Review' },
  { href: '/settings', label: 'Settings' },
];

// isActive: graph/home is active for / only
// (existing logic already handles this correctly)
```

Remove the old `{ href: '/graph', label: 'Graph' }` entry (it was the 3rd item).

- [ ] **Step 3: Write failing test for redirect**

```typescript
// src/components/graph/__tests__/graphRedirect.test.ts
// We can't easily test a server redirect, so test the NavBar links instead

import { render, screen } from '@testing-library/react';
// (NavBar tests already exist in the codebase pattern — skip adding a new one
//  for the redirect since it's a trivial one-liner. Test the full routing
//  manually after wiring in Task 8.)
```

Note: The redirect is a one-liner server component — skip formal unit test, verify manually after Task 8.

- [ ] **Step 4: Scaffold new page.tsx (graph OS surface)**

Replace `src/app/page.tsx` with a minimal scaffold that shows the graph. Full implementation comes in Task 8; this just moves the data-fetching skeleton:

```typescript
// src/app/page.tsx
import { GraphOSSurface } from '@/components/graph/GraphOSSurface';

export default function HomePage() {
  return <GraphOSSurface />;
}
```

We'll create `GraphOSSurface` in Task 8. For now, create a stub:

```typescript
// src/components/graph/GraphOSSurface.tsx
'use client';

export function GraphOSSurface() {
  return <div className="w-full h-screen bg-gray-950 flex items-center justify-center text-gray-600">Graph OS — wiring up...</div>;
}
```

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: builds clean. `/` shows stub. `/graph` redirects to `/`.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/graph/page.tsx src/components/graph/GraphOSSurface.tsx src/components/layout/NavBar.tsx
git commit -m "feat: make graph the home route, redirect /graph to /, update nav links"
```

---

## Task 3: Fullscreen layout — NavBar as fixed overlay

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/layout/NavBar.tsx`

The graph must fill 100vh. The NavBar overlays the top with a blurred background.

- [ ] **Step 1: Update layout.tsx — remove nav spacing from main**

```typescript
// src/app/layout.tsx
// Change <main className="min-h-[calc(100vh-49px)]">
// To:
<main className="h-screen overflow-hidden">
  {children}
</main>
```

Non-graph pages (/capture, /review, /settings) need to account for the fixed nav. Add a utility class:

```css
/* src/app/globals.css — add: */
.page-with-nav {
  padding-top: 49px;
  min-height: 100vh;
}
```

- [ ] **Step 2: Update NavBar — fixed overlay**

```typescript
// src/components/layout/NavBar.tsx
// Change the outer <nav> className from:
//   "flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-950"
// To:
//   "fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800/50"
```

- [ ] **Step 3: Add page-with-nav to non-graph pages**

Non-graph pages need top padding so content isn't hidden under the fixed nav.

In `src/app/capture/page.tsx`, `src/app/review/page.tsx`, `src/app/settings/page.tsx` — wrap the root div with `className="page-with-nav"`.

Check each file's outer wrapper and add the class.

- [ ] **Step 4: Build check**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/layout/NavBar.tsx src/app/globals.css src/app/capture/page.tsx src/app/review/page.tsx src/app/settings/page.tsx
git commit -m "feat: fixed overlay nav, fullscreen main, page-with-nav utility for non-graph pages"
```

---

## Task 4: Dashboard sidebar component

**Files:**
- Create: `src/components/graph/DashboardSidebar.tsx`

A collapsible left panel overlaid on the graph. Shows the stats that were on the old dashboard.

- [ ] **Step 1: Write test**

```typescript
// src/components/graph/__tests__/DashboardSidebar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardSidebar } from '../DashboardSidebar';

const mockStats = {
  awaitingReview: 3,
  promotedThisWeek: 5,
  activeTests: 2,
};

it('renders stats when open', () => {
  render(<DashboardSidebar stats={mockStats} isOpen={true} onToggle={() => {}} />);
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
});

it('hides stats when closed', () => {
  render(<DashboardSidebar stats={mockStats} isOpen={false} onToggle={() => {}} />);
  expect(screen.queryByText('Awaiting Review')).not.toBeInTheDocument();
});

it('calls onToggle when toggle button clicked', () => {
  const onToggle = vi.fn();
  render(<DashboardSidebar stats={mockStats} isOpen={true} onToggle={onToggle} />);
  fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }));
  expect(onToggle).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx vitest run src/components/graph/__tests__/DashboardSidebar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement DashboardSidebar**

```typescript
// src/components/graph/DashboardSidebar.tsx
'use client';

import Link from 'next/link';

interface SidebarStats {
  readonly awaitingReview: number;
  readonly promotedThisWeek: number;
  readonly activeTests: number;
}

interface DashboardSidebarProps {
  readonly stats: SidebarStats;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}

export function DashboardSidebar({ stats, isOpen, onToggle }: DashboardSidebarProps) {
  return (
    <div className="absolute left-0 top-0 bottom-0 z-30 flex">
      {/* Panel */}
      {isOpen && (
        <div className="w-56 bg-gray-950/90 backdrop-blur-sm border-r border-gray-800/50 pt-[49px] pb-4 px-4 flex flex-col gap-4">
          <div className="text-[10px] text-gray-600 uppercase tracking-widest pt-3">Overview</div>

          <Link href="/review" className="group block">
            <div className="text-2xl font-bold text-node-assumption-fg">{stats.awaitingReview}</div>
            <div className="text-xs text-gray-500 group-hover:text-gray-400">Awaiting Review</div>
          </Link>

          <div>
            <div className="text-2xl font-bold text-node-assumption-bg">{stats.promotedThisWeek}</div>
            <div className="text-xs text-gray-500">Promoted This Week</div>
          </div>

          <div>
            <div className="text-2xl font-bold text-node-test">{stats.activeTests}</div>
            <div className="text-xs text-gray-500">Active Tests</div>
          </div>
        </div>
      )}

      {/* Toggle tab */}
      <button
        onClick={onToggle}
        aria-label="toggle sidebar"
        className="absolute top-[57px] left-0 w-5 h-10 bg-gray-800/80 hover:bg-gray-700 rounded-r flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
        style={{ left: isOpen ? '224px' : '0px', transition: 'left 0.2s ease' }}
      >
        <span className="text-[10px]">{isOpen ? '‹' : '›'}</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npx vitest run src/components/graph/__tests__/DashboardSidebar.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/graph/DashboardSidebar.tsx src/components/graph/__tests__/DashboardSidebar.test.tsx
git commit -m "feat: add collapsible DashboardSidebar overlay component"
```

---

## Task 5: GraphTopBar — overlaid filter + view switcher stub

**Files:**
- Create: `src/components/graph/GraphTopBar.tsx`

The filter pills move from a separate border-b bar into an overlaid floating bar below the NavBar. Also adds a placeholder for the view switcher (Plan B).

- [ ] **Step 1: Implement GraphTopBar**

```typescript
// src/components/graph/GraphTopBar.tsx
'use client';

export type GraphView = 'force' | 'tree' | 'timeline' | 'workflow';

interface NodeTypeOption {
  readonly id: string;
  readonly label: string;
  readonly color: string | null;
}

interface GraphTopBarProps {
  readonly activeTypes: readonly string[];
  readonly onToggleType: (type: string) => void;
  readonly nodeTypes: readonly NodeTypeOption[];
  readonly currentView: GraphView;
  readonly onChangeView: (view: GraphView) => void;
}

const VIEW_ICONS: Record<GraphView, string> = {
  force: '⬡',
  tree: '⤷',
  timeline: '⋯',
  workflow: '⊞',
};

export function GraphTopBar({ activeTypes, onToggleType, nodeTypes, currentView, onChangeView }: GraphTopBarProps) {
  return (
    <div className="absolute top-[49px] left-0 right-0 z-20 flex items-center gap-3 px-4 py-2 bg-gray-950/60 backdrop-blur-sm border-b border-gray-800/30">
      {/* Filter pills */}
      <span className="text-[10px] text-gray-600 uppercase tracking-wider flex-shrink-0">Filter</span>
      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        {nodeTypes.map(type => {
          const isActive = activeTypes.includes(type.id);
          return (
            <button
              key={type.id}
              onClick={() => onToggleType(type.id)}
              className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
              style={{
                backgroundColor: isActive ? (type.color ?? '#888') : 'rgba(31,41,55,0.8)',
                color: isActive ? '#fff' : '#6b7280',
              }}
            >
              {type.label}
            </button>
          );
        })}
      </div>

      {/* View switcher (stub — Plan B fills this out) */}
      <div className="flex items-center gap-1 flex-shrink-0 border border-gray-800 rounded-md overflow-hidden">
        {(['force', 'tree', 'timeline', 'workflow'] as GraphView[]).map(view => (
          <button
            key={view}
            onClick={() => onChangeView(view)}
            title={view}
            className={`px-2.5 py-1 text-sm transition-colors ${
              currentView === view
                ? 'bg-gray-700 text-gray-200'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {VIEW_ICONS[view]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/graph/GraphTopBar.tsx
git commit -m "feat: add GraphTopBar with overlaid filter pills and view switcher stub"
```

---

## Task 6: Node cards — SVG group cards replacing circles

**Files:**
- Modify: `src/lib/graph/layout.ts`
- Rewrite: `src/components/graph/GraphCanvas.tsx`

Replace D3 circles with SVG `<g>` card groups. Each card is a rect (200×80px) with a left accent bar, truncated title, type colour, and 5 confidence dots.

- [ ] **Step 1: Add card dimension constants to layout.ts**

```typescript
// src/lib/graph/layout.ts — add these exports near the top:

export const CARD_WIDTH = 200;
export const CARD_HEIGHT = 80;
export const CARD_COLLIDE_RADIUS = 120; // approx diagonal/2 + padding

// Update FORCE_CONFIG:
export const FORCE_CONFIG = {
  charge: -400,          // stronger repulsion to spread cards
  linkDistance: 180,     // longer links to give cards room
  collideRadius: CARD_COLLIDE_RADIUS,
  centerStrength: 0.05,
} as const;
```

- [ ] **Step 2: Rewrite GraphCanvas.tsx**

Key changes:
- Nodes are `<g>` elements, not `<circle>` elements
- Drag behavior on `<g>` (change type param from SVGCircleElement)
- Collision force uses CARD_COLLIDE_RADIUS
- Card renders: outer rect, left accent rect, title text, confidence dots, type label
- Empty-space click handler (canvas background click → onCanvasClick)
- Curved edges (quadratic bezier) instead of straight lines

```typescript
// src/components/graph/GraphCanvas.tsx
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
   * Called when the user clicks empty canvas space.
   * screenX/screenY are viewport coords (for positioning the capture card with position:fixed).
   * canvasX/canvasY are D3 canvas-space coords (for future node placement in the simulation).
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
    // Only fire if clicking the background, not a node card
    if ((event.target as SVGElement).closest('.node-card')) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !onCanvasClick) return;
    // Screen coords: used by InlineCaptureCard for position:fixed placement
    const screenX = event.clientX;
    const screenY = event.clientY;
    // Canvas coords: invert the D3 zoom transform, used for future node placement in the simulation
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
        // Cards: origin is top-left of card, position is centre of card
        cardG.attr('transform', d =>
          `translate(${(d.x ?? 0) - CARD_WIDTH / 2}, ${(d.y ?? 0) - CARD_HEIGHT / 2})`
        );

        // Curved links using quadratic bezier, midpoint offset
        link.attr('d', d => {
          const sx = (d.source as GraphNode).x ?? 0;
          const sy = (d.source as GraphNode).y ?? 0;
          const tx = (d.target as GraphNode).x ?? 0;
          const ty = (d.target as GraphNode).y ?? 0;
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2 - 30; // arc upward
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
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/graph/layout.ts src/components/graph/GraphCanvas.tsx
git commit -m "feat: replace circle nodes with SVG card nodes, curved edges, canvas click handler"
```

---

## Task 7: Inline capture card

**Files:**
- Create: `src/components/graph/InlineCaptureCard.tsx`

Floating HTML card that appears at a screen position (`position: fixed`, passed as viewport coordinates from `GraphCanvas`) when user clicks empty space or presses Cmd+N.

- [ ] **Step 1: Write test**

```typescript
// src/components/graph/__tests__/InlineCaptureCard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineCaptureCard } from '../InlineCaptureCard';
import { vi } from 'vitest';

global.fetch = vi.fn();

it('renders at given position', () => {
  render(
    <InlineCaptureCard
      position={{ x: 100, y: 200 }}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />
  );
  expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
});

it('calls onClose when Escape pressed', () => {
  const onClose = vi.fn();
  render(
    <InlineCaptureCard
      position={{ x: 100, y: 200 }}
      onClose={onClose}
      onCreated={vi.fn()}
    />
  );
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

it('disables Create button when title is empty', () => {
  render(
    <InlineCaptureCard
      position={{ x: 100, y: 200 }}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />
  );
  expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
});

it('submits on Create click with valid title', async () => {
  const mockNode = { id: 'new-id', title: 'Test' };
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: mockNode }),
  });
  const onCreated = vi.fn();
  render(
    <InlineCaptureCard
      position={{ x: 100, y: 200 }}
      onClose={vi.fn()}
      onCreated={onCreated}
    />
  );
  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test hunch' } });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-id'));
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx vitest run src/components/graph/__tests__/InlineCaptureCard.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement InlineCaptureCard**

```typescript
// src/components/graph/InlineCaptureCard.tsx
'use client';

import { useEffect, useState } from 'react';

const NODE_TYPES = [
  { value: 'hunch', label: 'Hunch' },
  { value: 'assumption_background', label: 'Background Assumption' },
  { value: 'assumption_foreground', label: 'Foreground Assumption' },
  { value: 'test', label: 'Test' },
  { value: 'learning', label: 'Learning' },
  { value: 'option', label: 'Option' },
];

interface InlineCaptureCardProps {
  readonly position: { x: number; y: number }; // screen coordinates
  readonly linkedNodeId?: string;
  readonly onClose: () => void;
  readonly onCreated: (nodeId: string) => void;
}

export function InlineCaptureCard({ position, onClose, onCreated }: InlineCaptureCardProps) {
  const [title, setTitle] = useState('');
  const [nodeType, setNodeType] = useState('hunch');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), node_type: nodeType, hunch_type: 'new', confidence_level: 3 }),
      });
      if (!res.ok) throw new Error('Failed');
      const { data } = await res.json();
      onCreated(data.id);
    } catch {
      // keep card open on error
    } finally {
      setIsSubmitting(false);
    }
  };

  // Position card so it doesn't overflow viewport
  const cardW = 280;
  const cardH = 180;
  const left = Math.min(position.x, window.innerWidth - cardW - 16);
  const top = Math.min(position.y, window.innerHeight - cardH - 16);

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 flex flex-col gap-3"
      style={{ left, top, width: cardW }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wider">New node</div>

      <input
        autoFocus
        type="text"
        placeholder="Title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
        className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 w-full"
      />

      <select
        value={nodeType}
        onChange={e => setNodeType(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-400 focus:outline-none w-full"
      >
        {NODE_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={!title.trim() || isSubmitting}
          className="flex-1 py-1.5 bg-node-hunch text-white text-xs rounded-md disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {isSubmitting ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Fix `/api/capture/route.ts` — accept `node_type` from request body**

The capture route currently hardcodes `node_type: 'hunch'` and ignores the field from the request body. Fix it to extract `node_type`, defaulting to `'hunch'`:

```typescript
// src/app/api/capture/route.ts
// Find the section where the insert payload is built and change:

// BEFORE (hardcoded):
//   node_type: 'hunch',

// AFTER (reads from body, falls back to 'hunch'):
const { title, node_type = 'hunch', hunch_type, confidence_level } = await req.json();
// … rest of handler unchanged, use node_type in the insert payload
```

Read the current file first, then apply the minimal change: extract `node_type` from the parsed body alongside the other fields, and pass it through to the Supabase insert. The default `= 'hunch'` preserves all existing callers that omit the field.

- [ ] **Step 5: Run test — confirm it passes**

```bash
npx vitest run src/components/graph/__tests__/InlineCaptureCard.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/graph/InlineCaptureCard.tsx src/components/graph/__tests__/InlineCaptureCard.test.tsx src/app/api/capture/route.ts
git commit -m "feat: add InlineCaptureCard; capture API now accepts node_type (default: hunch)"
```

---

## Task 8: Wire up GraphOSSurface — the full home page

**Files:**
- Rewrite: `src/components/graph/GraphOSSurface.tsx`

This is the orchestration layer: loads data, manages state, composes all the graph OS components.

- [ ] **Step 1: Implement GraphOSSurface**

```typescript
// src/components/graph/GraphOSSurface.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Node, NodeType } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { NodeDetailPanel } from '@/components/graph/NodeDetailPanel';
import { GraphTopBar, type GraphView } from '@/components/graph/GraphTopBar';
import { DashboardSidebar } from '@/components/graph/DashboardSidebar';
import { InlineCaptureCard } from '@/components/graph/InlineCaptureCard';
import { EmptyState } from '@/components/shared/EmptyState';

interface CapturePosition { x: number; y: number }

export function GraphOSSurface() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [capturePos, setCapturePos] = useState<CapturePosition | null>(null);
  const [currentView, setCurrentView] = useState<GraphView>('force');
  const [awaitingReview, setAwaitingReview] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    const fetchAll = async () => {
      const [nodesRes, edgesRes, typesRes, reviewRes] = await Promise.all([
        supabase.from('nodes').select('*').in('status', ['promoted', 'human_reviewed']),
        supabase.from('edges').select('*'),
        supabase.from('node_types').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('nodes').select('id', { count: 'exact', head: true }).eq('status', 'llm_reviewed'),
      ]);
      if (nodesRes.data) setNodes(nodesRes.data as unknown as Node[]);
      if (edgesRes.data) setEdges(edgesRes.data as unknown as Edge[]);
      if (typesRes.data) {
        const types = typesRes.data as unknown as NodeType[];
        setNodeTypes(types);
        setActiveTypes(types.map(t => t.id));
      }
      setAwaitingReview(reviewRes.count ?? 0);
    };

    fetchAll();

    // Real-time: add newly promoted nodes without full reload
    const channel = supabase
      .channel('graph-nodes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'nodes',
        filter: 'status=eq.promoted',
      }, payload => {
        setNodes(prev => {
          const exists = prev.find(n => n.id === payload.new.id);
          if (exists) return prev.map(n => n.id === payload.new.id ? payload.new as unknown as Node : n);
          return [...prev, payload.new as unknown as Node];
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'edges',
      }, payload => {
        setEdges(prev => [...prev, payload.new as unknown as Edge]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Keyboard: Cmd+N or Ctrl+N opens capture at centre
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setCapturePos({ x: window.innerWidth / 2 - 140, y: window.innerHeight / 2 - 90 });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCanvasClick = useCallback((screenX: number, screenY: number, _canvasX: number, _canvasY: number) => {
    setSelectedNode(null);
    // Use screen coords directly — InlineCaptureCard positions itself with position:fixed
    setCapturePos({ x: screenX, y: screenY });
    // _canvasX / _canvasY are reserved for future node placement in the D3 simulation
  }, []);

  const handleNodeCreated = useCallback((nodeId: string) => {
    setCapturePos(null);
    // Node will appear once promoted; for now just close
    // Optionally: immediately add a 'raw' node to graph as a ghost
    console.log('Created node', nodeId);
  }, []);

  const handleToggleType = useCallback((typeId: string) => {
    setActiveTypes(prev =>
      prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]
    );
  }, []);

  const promotedThisWeek = nodes.filter(n => {
    const created = new Date(n.created_at);
    return Date.now() - created.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const activeTests = nodes.filter(n => n.node_type === 'test').length;

  if (nodes.length === 0 && nodeTypes.length > 0) {
    return (
      <div className="pt-[49px]">
        <EmptyState
          title="Capture your first hunch to start building the graph"
          actionLabel="Capture a Hunch"
          actionHref="/capture"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Overlaid top bar */}
      <GraphTopBar
        activeTypes={activeTypes}
        onToggleType={handleToggleType}
        nodeTypes={nodeTypes}
        currentView={currentView}
        onChangeView={setCurrentView}
      />

      {/* Collapsible sidebar */}
      <DashboardSidebar
        stats={{ awaitingReview, promotedThisWeek, activeTests }}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      {/* Graph canvas — fills full screen */}
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        activeTypes={activeTypes}
        onSelectNode={setSelectedNode}
        onCanvasClick={handleCanvasClick}
      />

      {/* Node detail panel (absolute right) */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          edges={edges}
          allNodes={nodes}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Inline capture card (fixed over graph) */}
      {capturePos && (
        <InlineCaptureCard
          position={capturePos}
          onClose={() => setCapturePos(null)}
          onCreated={handleNodeCreated}
        />
      )}

      {/* Bottom legend */}
      <div className="absolute bottom-0 left-0 right-0 flex gap-4 px-4 py-1.5 bg-gray-950/60 backdrop-blur-sm justify-center border-t border-gray-800/30">
        {nodeTypes.map(type => (
          <div key={type.id} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color ?? '#888' }} />
            <span className="text-[10px] text-gray-600">{type.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update src/app/page.tsx — import GraphOSSurface**

```typescript
// src/app/page.tsx
import { GraphOSSurface } from '@/components/graph/GraphOSSurface';

export default function HomePage() {
  return <GraphOSSurface />;
}
```

Note: `page.tsx` is now a server component that just renders the client `GraphOSSurface`. The layout no longer needs to be a server component for this route.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/graph/GraphOSSurface.tsx src/app/page.tsx
git commit -m "feat: wire up GraphOSSurface as home page with canvas, sidebar, top bar, inline capture"
```

---

## Task 9: Delete obsolete FilterBar component

**Files:**
- Delete: `src/components/graph/FilterBar.tsx`

The filter functionality has moved into `GraphTopBar`. The old standalone `FilterBar` is now dead code.

- [ ] **Step 1: Confirm no imports**

```bash
grep -r "FilterBar" src/
```

Expected: no results (GraphOSSurface and graph page no longer import it).

- [ ] **Step 2: Delete file**

```bash
rm src/components/graph/FilterBar.tsx
```

- [ ] **Step 3: Build check + test**

```bash
npm run build && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git commit -am "chore: remove obsolete FilterBar (absorbed into GraphTopBar)"
```

---

## Verification

After completing all tasks, manually verify:

1. `/` loads the graph fullscreen — nav overlaid, no white border gap
2. Filter pills visible in top bar overlay at `top-[49px]`
3. View switcher buttons render (force/tree/timeline/workflow icons)
4. Nodes render as rectangular cards with left colour accent, title, confidence dots
5. Edges are curved bezier paths with directional arrows, coloured by type
6. Clicking empty canvas opens `InlineCaptureCard` floating at click position
7. Typing a title and clicking Create makes a POST to `/api/capture`
8. Pressing Escape closes the inline card
9. Cmd+N opens the inline card at canvas centre
10. Sidebar toggle button visible on left edge, click shows/hides stats panel
11. `/graph` redirects to `/`
12. `/capture`, `/review`, `/settings` have correct top padding (content not hidden under nav)
13. `npm run build` clean
14. `npx vitest run` — all tests pass

---

## What's in Plan B

Plan B covers:
- **Tree/Evolution view** — d3-hierarchy tree layout with seed selector
- **Timeline view** — horizontal chronological layout
- **Workflow/Kanban view** — status swim lanes with drag-and-drop
- **Connection handles** — drag from node handle to create edges
- **Right-click context menu** — quick actions on node cards
- **Commitment node type** — taxonomy addition, distinct card style
- **View switcher** — activating the stub built in Task 5
