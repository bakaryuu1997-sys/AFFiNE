import { svg, type SVGTemplateResult } from 'lit';

import type { NodeType } from './spec';

/**
 * Isometric (2.5D) glyphs drawn with plain SVG shapes. Every glyph is centered
 * on the middle of its footprint at ground level, so (0,0) is where the node
 * sits and the picture grows upwards (negative y).
 */

const COS = 0.866;
const SIN = 0.5;

type Pt = [number, number];

const iso = (x: number, y: number, z: number): Pt => [
  (x - y) * COS,
  (x + y) * SIN - z,
];
const pts = (list: Pt[]) =>
  list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Fill colors come from the block's CSS variables so both themes work. */
const TOP = 'fill: color-mix(in srgb, var(--sd-accent) 30%, var(--sd-surface))';
const LEFT = 'fill: color-mix(in srgb, var(--sd-accent) 12%, var(--sd-shade))';
const RIGHT =
  'fill: color-mix(in srgb, var(--sd-accent) 20%, var(--sd-surface))';
const SCREEN =
  'fill: color-mix(in srgb, var(--sd-accent) 55%, var(--sd-shade))';
const ACCENT = 'fill: var(--sd-accent)';

function cuboid(
  ox: number,
  oy: number,
  oz: number,
  w: number,
  d: number,
  h: number
): SVGTemplateResult {
  const a = iso(ox, oy, oz);
  const b = iso(ox + w, oy, oz);
  const c = iso(ox + w, oy + d, oz);
  const dd = iso(ox, oy + d, oz);
  const up = ([x, y]: Pt): Pt => [x, y - h];
  return svg`
    <polygon points=${pts([dd, c, up(c), up(dd)])} style=${LEFT} class="edge" />
    <polygon points=${pts([c, b, up(b), up(c)])} style=${RIGHT} class="edge" />
    <polygon points=${pts([up(a), up(b), up(c), up(dd)])} style=${TOP} class="edge" />`;
}

/** A point on the front-left face of a cuboid (s along its width, t up). */
const onLeftFace = (
  ox: number,
  oy: number,
  oz: number,
  w: number,
  d: number,
  h: number,
  s: number,
  t: number
): Pt => iso(ox + s * w, oy + d, oz + t * h);

function led(
  ox: number,
  oy: number,
  oz: number,
  w: number,
  d: number,
  h: number,
  s: number,
  t: number
) {
  const [x, y] = onLeftFace(ox, oy, oz, w, d, h, s, t);
  return svg`<circle cx=${x.toFixed(1)} cy=${y.toFixed(1)} r="1.7" style=${ACCENT} />`;
}

function cylinder(
  rx: number,
  ry: number,
  h: number,
  baseY = 0
): SVGTemplateResult {
  const top = baseY - h;
  return svg`
    <path d="M ${-rx} ${top} L ${-rx} ${baseY} A ${rx} ${ry} 0 0 0 ${rx} ${baseY} L ${rx} ${top} Z"
      style=${LEFT} class="edge" />
    <path d="M ${-rx} ${(top + (baseY - top) * 0.45).toFixed(1)} A ${rx} ${ry} 0 0 0 ${rx} ${(top + (baseY - top) * 0.45).toFixed(1)}"
      class="ring" fill="none" />
    <path d="M ${-rx} ${(top + (baseY - top) * 0.78).toFixed(1)} A ${rx} ${ry} 0 0 0 ${rx} ${(top + (baseY - top) * 0.78).toFixed(1)}"
      class="ring" fill="none" />
    <ellipse cx="0" cy=${top} rx=${rx} ry=${ry} style=${TOP} class="edge" />`;
}

function server(): SVGTemplateResult {
  const w = 40;
  const d = 40;
  const h = 13;
  const ox = -w / 2;
  const oy = -d / 2;
  return svg`${[0, 1, 2].map(i => {
    const oz = i * (h + 2);
    return svg`${cuboid(ox, oy, oz, w, d, h)}
      ${led(ox, oy, oz, w, d, h, 0.16, 0.5)}
      ${led(ox, oy, oz, w, d, h, 0.3, 0.5)}`;
  })}`;
}

function glyph(type: NodeType): SVGTemplateResult {
  switch (type) {
    case 'client': {
      const sx = -26;
      const sy = -18;
      const inset = (s: number, t: number) =>
        onLeftFace(sx, sy + 15, 5, 52, 3, 34, s, t);
      return svg`
        ${cuboid(sx, sy, 0, 52, 36, 5)}
        ${cuboid(sx, sy + 15, 5, 52, 3, 34)}
        <polygon points=${pts([inset(0.08, 0.1), inset(0.92, 0.1), inset(0.92, 0.9), inset(0.08, 0.9)])}
          style=${SCREEN} />
        <polyline points=${pts([inset(0.2, 0.7), inset(0.55, 0.7)])} class="code" />
        <polyline points=${pts([inset(0.2, 0.5), inset(0.75, 0.5)])} class="code" />
        <polyline points=${pts([inset(0.2, 0.3), inset(0.45, 0.3)])} class="code" />`;
    }
    case 'api':
    case 'worker':
      return server();
    case 'database':
      return cylinder(26, 11, 40);
    case 'cache':
      return svg`${cylinder(20, 8, 22)}
        <polygon points="-3,-34 5,-34 1,-26 6,-26 -4,-14 -1,-23 -6,-23" style=${ACCENT} />`;
    case 'load-balancer':
      return svg`${cuboid(-32, -22, 0, 64, 44, 9)}
        ${[-12, 0, 12].map(y => cuboid(-5, y - 4, 9, 10, 8, 8))}`;
    case 'cdn':
      return svg`${cuboid(-24, -24, 0, 48, 48, 6)}
        <circle cx="0" cy="-26" r="20" style=${TOP} class="edge" />
        <ellipse cx="0" cy="-26" rx="8" ry="20" class="ring" fill="none" />
        <ellipse cx="0" cy="-26" rx="20" ry="7" class="ring" fill="none" />`;
    case 'dns':
      return svg`${cuboid(-28, -20, 0, 56, 40, 12)}
        ${led(-28, -20, 0, 56, 40, 12, 0.14, 0.5)}
        ${led(-28, -20, 0, 56, 40, 12, 0.26, 0.5)}
        ${cuboid(-8, -8, 12, 16, 16, 8)}`;
    case 'queue':
      return svg`${[0, 1, 2, 3].map(i => cuboid(-28 + i * 5, -17, i * 8, 56, 34, 5))}`;
    case 'storage':
      return svg`
        ${cuboid(-36, -10, 0, 34, 24, 16)}
        ${cuboid(2, -10, 0, 34, 24, 16)}
        ${cuboid(-17, -10, 16, 34, 24, 16)}`;
    case 'search':
      return svg`${cuboid(-22, -22, 0, 44, 44, 22)}
        <circle cx="-3" cy="-33" r="9" class="ring" fill="none" />
        <line x1="3" y1="-27" x2="11" y2="-19" class="ring" />`;
  }
}

/** Accent color of each component type. */
export const TYPE_ACCENT: Record<NodeType, string> = {
  client: '#6f9bff',
  dns: '#9aa4b2',
  cdn: '#f0a93b',
  'load-balancer': '#5cc7d6',
  api: '#7c8cff',
  cache: '#f0a93b',
  database: '#4cc3a0',
  queue: '#c58cf0',
  worker: '#7c8cff',
  storage: '#8fa0b8',
  search: '#e9719b',
};

/** Hit area of a node (relative to its anchor): glyph above, label below. */
export const NODE_BOX = { left: -48, right: 48, top: -76, bottom: 66 } as const;

export function nodeGlyph(type: NodeType): SVGTemplateResult {
  return glyph(type);
}
