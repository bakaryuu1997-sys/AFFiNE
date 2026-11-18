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

/** Evaluates a point at parameter `t` (0..1) along the cubic Bezier `edgePath`. */
export function edgePointAt(from: Point, to: Point, t: number): Point {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5) * (b.x >= a.x ? 1 : -1);
  const p0x = a.x;
  const p0y = a.y;
  const p1x = a.x + dx;
  const p1y = a.y;
  const p2x = b.x - dx;
  const p2y = b.y;
  const p3x = b.x;
  const p3y = b.y;
  const u = 1 - t;
  const u2 = u * u;
  const u3 = u2 * u;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: u3 * p0x + 3 * u2 * t * p1x + 3 * u * t2 * p2x + t3 * p3x,
    y: u3 * p0y + 3 * u2 * t * p1y + 3 * u * t2 * p2y + t3 * p3y,
  };
}

interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

const boxesOverlap = (a: Box, b: Box, pad = 0): boolean =>
  a.l - pad < b.r && a.r + pad > b.l && a.t - pad < b.b && a.b + pad > b.t;

const nodeTextBoxOf = (n: Point & { label?: string }): Box => {
  const labelLen = n.label ? n.label.length : 14;
  const halfW = Math.max(66, (labelLen * 7.6) / 2 + 8);
  return { l: n.x - halfW, r: n.x + halfW, t: n.y + 4, b: n.y + 66 };
};

const nodeGlyphBoxOf = (n: Point): Box => ({
  l: n.x - 44,
  r: n.x + 44,
  t: n.y - 52,
  b: n.y + 4,
});

const PILL_HALF_H = 9;
const CANDIDATE_TS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
const CANDIDATE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, -18],
  [0, 18],
  [28, 0],
  [-28, 0],
  [0, -34],
  [0, 34],
  [28, -18],
  [-28, -18],
  [28, 18],
  [-28, 18],
  [52, 0],
  [-52, 0],
  [52, -20],
  [-52, -20],
  [52, 20],
  [-52, 20],
  [0, -52],
  [0, 52],
  [76, -24],
  [-76, -24],
  [76, 24],
  [-76, 24],
];

function findBestPillPoint(
  from: Point,
  to: Point,
  pillW: number,
  hardBoxes: Box[],
  softBoxes: Box[]
): Point {
  const halfW = pillW / 2;
  const anchor = edgePointAt(from, to, 0.5);
  let bestPoint = anchor;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const t of CANDIDATE_TS) {
    const base = edgePointAt(from, to, t);
    for (const [ox, oy] of CANDIDATE_OFFSETS) {
      const cx = base.x + ox;
      const cy = base.y + oy;
      const box: Box = {
        l: cx - halfW,
        r: cx + halfW,
        t: cy - PILL_HALF_H,
        b: cy + PILL_HALF_H,
      };
      let hardHits = 0;
      for (const hb of hardBoxes) {
        if (boxesOverlap(box, hb, 3)) hardHits++;
      }
      let softHits = 0;
      for (const sb of softBoxes) {
        if (boxesOverlap(box, sb, 2)) softHits++;
      }
      const distPenalty =
        Math.hypot(cx - anchor.x, cy - anchor.y) * 0.15 +
        Math.abs(t - 0.5) * 30;
      const score = hardHits * 100_000 + softHits * 1_000 + distPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestPoint = { x: cx, y: cy };
        if (
          hardHits === 0 &&
          softHits === 0 &&
          ox === 0 &&
          oy === 0 &&
          t === 0.5
        ) {
          return bestPoint;
        }
      }
    }
  }
  return bestPoint;
}

export function edgeMidpoint(
  from: Point,
  to: Point,
  allNodes?: Array<Point & { label?: string }>,
  pillWidthPx = 68
): Point {
  if (!allNodes || allNodes.length === 0) {
    return edgePointAt(from, to, 0.5);
  }
  const hardBoxes = allNodes.map(nodeTextBoxOf);
  const softBoxes = allNodes.map(nodeGlyphBoxOf);
  return findBestPillPoint(from, to, pillWidthPx, hardBoxes, softBoxes);
}

export interface EdgePillLayoutItem {
  id: string;
  from: Point;
  to: Point;
  width: number;
}

/**
 * Computes collision-free positions for all edge pills simultaneously so pills
 * avoid every node's label/badge and never overlap each other.
 */
export function layoutEdgePills(
  items: EdgePillLayoutItem[],
  nodes: Array<Point & { label?: string }>
): Map<string, Point> {
  const result = new Map<string, Point>();
  const hardBoxes: Box[] = nodes.map(nodeTextBoxOf);
  const softBoxes: Box[] = nodes.map(nodeGlyphBoxOf);

  for (const item of items) {
    const pos = findBestPillPoint(
      item.from,
      item.to,
      item.width,
      hardBoxes,
      softBoxes
    );
    result.set(item.id, pos);
    hardBoxes.push({
      l: pos.x - item.width / 2,
      r: pos.x + item.width / 2,
      t: pos.y - PILL_HALF_H,
      b: pos.y + PILL_HALF_H,
    });
  }
  return result;
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
    nodes.some(n => Math.abs(n.x - p.x) < 130 && Math.abs(n.y - p.y) < 135);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      const p = { x: 80 + col * 180, y: 100 + row * 150 };
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
