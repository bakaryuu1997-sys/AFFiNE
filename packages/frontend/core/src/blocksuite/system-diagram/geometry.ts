import { NODE_BOX } from './icons';
import { type DiagramNode, type DiagramSpec, findCycle, LIMITS } from './spec';

/** The visual middle of a node's glyph, relative to its anchor point. */
export const NODE_CENTER_DY = -18;

export interface Point {
  x: number;
  y: number;
}

export const nodeCenter = (node: Point): Point => ({
  x: node.x,
  y: node.y + NODE_CENTER_DY,
});

/** A smooth horizontal-leaning curve between two node centers. */
export function edgePath(from: Point, to: Point): string {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5) * (b.x >= a.x ? 1 : -1);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function edgeMidpoint(from: Point, to: Point, allNodes?: Point[]): Point {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  if (allNodes && allNodes.length > 0) {
    for (const n of allNodes) {
      // If midpoint is close to any node center (within 85px X and 70px Y)
      if (Math.abs(midX - n.x) < 85 && Math.abs(midY - n.y) < 70) {
        // Shift position towards source node at t = 0.30 with a slight upward clearance
        return {
          x: a.x + (b.x - a.x) * 0.3,
          y: a.y + (b.y - a.y) * 0.3 - 12,
        };
      }
    }
  }
  return { x: midX, y: midY };
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The area that contains every node plus its glyph and label with generous breathing room. */
export function viewBoxOf(nodes: Point[], margin = 60): ViewBox {
  if (nodes.length === 0) return { x: 0, y: 0, w: 640, h: 300 };
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const leftPad = Math.max(margin, 80);
  const rightPad = Math.max(margin, 100);
  const topPad = Math.max(margin, 50);
  const bottomPad = Math.max(margin, 60);
  const x = Math.min(...xs) + NODE_BOX.left - leftPad;
  const y = Math.min(...ys) + NODE_BOX.top - topPad;
  const w = Math.max(...xs) + NODE_BOX.right + rightPad - x;
  const h = Math.max(...ys) + NODE_BOX.bottom + bottomPad - y;
  return { x, y, w: Math.max(w, 420), h: Math.max(h, 240) };
}

/** How many particles to draw on an edge carrying `rps` requests per second. */
export function particleCount(rps: number): number {
  if (!(rps > 0)) return 0;
  return Math.min(12, Math.max(1, Math.round(1 + Math.log10(1 + rps) * 2.2)));
}

/** A spot for a new node that does not sit on top of an existing one. */
export function freePosition(nodes: DiagramNode[]): Point {
  const taken = (p: Point) =>
    nodes.some(n => Math.abs(n.x - p.x) < 100 && Math.abs(n.y - p.y) < 90);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      const p = { x: 80 + col * 180, y: 100 + row * 140 };
      if (!taken(p)) return p;
    }
  }
  return { x: 80, y: 100 };
}

export type ConnectError = 'self' | 'duplicate' | 'limit' | 'cycle';

/** Why `from -> to` cannot be added, or null when it can. */
export function connectError(
  spec: DiagramSpec,
  from: string,
  to: string
): ConnectError | null {
  if (from === to) return 'self';
  if (spec.edges.some(e => e.from === from && e.to === to)) return 'duplicate';
  if (spec.edges.length >= LIMITS.maxEdges) return 'limit';
  const next: DiagramSpec = {
    ...spec,
    edges: [...spec.edges, { id: 'tmp', from, to, weight: 1 }],
  };
  return findCycle(next) ? 'cycle' : null;
}

/** An id that is not used yet, based on `base` (a component type, say). */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}
