# Graph UX Improvements Design

## Goal

Fix three compounding pain points in the knowledge graph: nodes overlap and cluster too densely in force mode, there's no reliable way to reset your view when lost, and the force layout gives no semantic structure — it's hard to see what connects to what.

## Architecture

Four focused changes to the existing D3 graph, in order of impact:

1. **Cluster force** — extend the D3 simulation so nodes group by goal space and sub-cluster by type
2. **Focus mode** — click any node to dim everything not directly connected
3. **Fit to view** — one button to reset the camera to show all nodes
4. **Search-to-focus** — type a node title to pan and highlight it

Layout switching (Force / Timeline / Tree / Workflow) moves from `GraphTopBar` to a new `GraphBottomBar`, keeping the top bar purely for type filters.

## Data model note

Goal space membership is encoded as edges of type `belongs_to_goalspace`, not as a direct field on Node. The cluster force must derive `nodeGoalMap: Map<nodeId, goalSpaceNodeId>` by scanning edges before setting up the simulation.

---

## Component breakdown

### 1. Cluster force — `src/lib/graph/layout.ts` + `GraphCanvas.tsx`

**What changes in `layout.ts`:**
- Increase `charge` from -400 to -800 (more breathing room)
- Increase `collideRadius` to `CARD_WIDTH / 2 + 24` (prevents overlap)
- Export a `buildClusterForce(nodes, nodeGoalMap)` function that returns a D3-compatible force

**`buildClusterForce` algorithm:**
- Compute `goalSpaceIds`: unique goal space node IDs from `nodeGoalMap` values
- Assign each goal space a centroid in a ring: `angle = (i / total) * 2π`, `x = cx + r * cos(angle)`, `y = cy + r * sin(angle)` where `r = min(width, height) * 0.3`
- Within each goal space, offset by node type: fixed `(dx, dy)` per type (e.g., hunches top-left, assumptions top-right, learnings bottom-left, commitments bottom-right)
- Per tick: for each node, compute `(targetX, targetY)` from its goal space centroid + type offset, apply `node.vx += (targetX - node.x) * alpha * 0.08` and same for y
- Strength `0.08` keeps the force gentle — nodes can still move freely between pulls

**Goal space zone overlays (in `GraphCanvas.tsx`):**
- Render one SVG `<ellipse>` per goal space centroid, positioned at the precomputed centroid coordinates (static — not tied to live simulation positions)
- `rx = 120, ry = 90`, `fill` at 4% opacity, `stroke` dashed at 20% opacity
- Color matches the goal space node's type color
- Rendered behind all nodes (z-order: zones → edges → nodes)
- Zones are decorative only — they don't respond to interaction

### 2. Focus mode — `GraphCanvas.tsx`

**State:** `focusedNodeId: string | null` (starts null)

**On node click:**
- If `focusedNodeId === clickedId` → set to null (toggle off)
- Otherwise → set to `clickedId`
- Node detail panel still opens as before

**Render:**
- Compute `activeSet`: `{focusedNodeId}` ∪ all node IDs directly connected by any edge
- Nodes in `activeSet`: render at full opacity
- Nodes not in `activeSet`: `opacity: 0.08`
- Edges touching `focusedNodeId`: full opacity
- Edges not touching `focusedNodeId`: `opacity: 0.05`

**Clear focus:**
- Click the SVG background (not a node) → `setFocusedNodeId(null)`
- Add an `onClick` handler to the root SVG element; node click handlers call `e.stopPropagation()` to prevent bubbling

### 3. Fit to view — `GraphCanvas.tsx` + `GraphBottomBar.tsx`

**`fitView()` function in `GraphCanvas.tsx`:**
```ts
function fitView() {
  const nodes = simulationRef.current?.nodes() ?? [];
  if (nodes.length === 0) return;
  const padding = 60;
  const minX = Math.min(...nodes.map(n => n.x - CARD_WIDTH / 2)) - padding;
  const maxX = Math.max(...nodes.map(n => n.x + CARD_WIDTH / 2)) + padding;
  const minY = Math.min(...nodes.map(n => n.y - CARD_HEIGHT / 2)) - padding;
  const maxY = Math.max(...nodes.map(n => n.y + CARD_HEIGHT / 2)) + padding;
  const scaleX = svgWidth / (maxX - minX);
  const scaleY = svgHeight / (maxY - minY);
  const scale = Math.min(scaleX, scaleY, 1.5);
  const tx = (svgWidth - (maxX + minX) * scale) / 2;
  const ty = (svgHeight - (maxY + minY) * scale) / 2;
  svgRef.current
    .transition().duration(500)
    .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}
```
- Called on mount (after first simulation tick settles) and via the bottom bar button

### 4. Search to focus — `GraphBottomBar.tsx`

- `<input placeholder="Find node...">` with a search icon
- On input change: filter `nodes` by `title.toLowerCase().includes(query)`
- First match → call `onFocusNode(matchId)` which:
  1. Sets `focusedNodeId` to `matchId` (triggers focus mode)
  2. Pans camera to centre on that node: `svg.transition().call(zoom.translateTo, node.x, node.y)`
- No match → no change (input stays, nothing happens)
- Clear input → clear focus

---

### 5. `GraphBottomBar.tsx` (new component)

```tsx
interface GraphBottomBarProps {
  readonly onFitView: () => void;
  readonly view: ViewMode;
  readonly onChangeView: (v: ViewMode) => void;
  readonly nodes: readonly GraphNode[];
  readonly onFocusNode: (id: string) => void;
}
```

Renders a pill-shaped floating toolbar centred at the bottom of the canvas:

```
[ ⊡ Fit view ] | [ 🔍 Find node... ] | [ Force ] [ Timeline ] [ Tree ] [ Workflow ]
```

- Styled as a dark card floating over the SVG (`position: absolute`, `bottom: 16px`, centred)
- Active layout button highlighted; others muted
- No state of its own — all callbacks

### 6. `GraphTopBar.tsx` — remove layout switcher

Remove the four layout buttons from `GraphTopBar`. Keep all type filter pills unchanged. Pass `onChangeView` and `view` down to `GraphBottomBar` instead.

---

## What does NOT change

- Timeline, Tree, Workflow layout algorithms (untouched)
- Node card rendering, edge path rendering, edge colours
- Node detail panel and commitment routing
- Supabase realtime subscription
- Zoom scroll behaviour (0.1–3x)
- Drag behaviour in force mode

---

## File map

| Action | File |
|--------|------|
| Modify | `src/lib/graph/layout.ts` — increase charge/collide, export `buildClusterForce` |
| Modify | `src/components/graph/GraphCanvas.tsx` — cluster force, zone overlays, focus mode, fitView, pass props to BottomBar |
| Modify | `src/components/graph/GraphTopBar.tsx` — remove layout switcher buttons |
| Create | `src/components/graph/GraphBottomBar.tsx` — fit view, search, layout switcher |
| Create | `src/components/graph/__tests__/GraphBottomBar.test.tsx` — unit tests |

---

## Testing

- `GraphBottomBar`: renders controls, calls `onFitView` when clicked, calls `onFocusNode` with first match on search, calls `onChangeView` when layout button clicked
- `buildClusterForce`: given nodes + nodeGoalMap, centroid positions are within canvas bounds; goal spaces without members produce no centroid
- Focus mode: nodes in activeSet get full opacity, others get 0.08 — tested via rendered `opacity` attribute
- `fitView`: given known node positions, produces translate/scale values that fit within SVG bounds
