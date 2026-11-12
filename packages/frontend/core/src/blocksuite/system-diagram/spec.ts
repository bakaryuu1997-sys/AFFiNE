/**
 * Data model of the system-design diagram block. The whole diagram is one
 * plain JSON value (DiagramSpec) so people, the renderer, the simulator and AI
 * agents (through MCP) all work on the same thing.
 */

export const NODE_TYPES = [
  'client',
  'dns',
  'cdn',
  'load-balancer',
  'api',
  'cache',
  'database',
  'queue',
  'worker',
  'storage',
  'search',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const TRAFFIC_PROFILES = ['constant', 'ramp', 'spike'] as const;
export type TrafficProfile = (typeof TRAFFIC_PROFILES)[number];

export interface DiagramNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  /** identical instances behind this node */
  replicas: number;
  /** requests per second one instance can serve */
  capacityRps: number;
  /** time one instance needs per request when idle */
  latencyMs: number;
  /** cache and cdn only: share of requests answered without going further */
  hitRatio?: number;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  /** share of the traffic leaving `from` that takes this edge */
  weight: number;
  label?: string;
}

export interface DiagramTraffic {
  /** requests per second produced by every client node together */
  rps: number;
  profile: TrafficProfile;
  /** length of one simulated run */
  durationSec: number;
}

export interface DiagramSpec {
  version: 1;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  traffic: DiagramTraffic;
}

interface TypeDefaults {
  label: string;
  capacityRps: number;
  latencyMs: number;
  hitRatio?: number;
}

export const TYPE_DEFAULTS: Record<NodeType, TypeDefaults> = {
  client: { label: 'Người dùng', capacityRps: 1e9, latencyMs: 0 },
  dns: { label: 'DNS', capacityRps: 50_000, latencyMs: 5 },
  cdn: { label: 'CDN', capacityRps: 20_000, latencyMs: 10, hitRatio: 0.85 },
  'load-balancer': { label: 'Cân bằng tải', capacityRps: 30_000, latencyMs: 1 },
  api: { label: 'API', capacityRps: 1000, latencyMs: 20 },
  cache: { label: 'Cache', capacityRps: 50_000, latencyMs: 1, hitRatio: 0.8 },
  database: { label: 'Cơ sở dữ liệu', capacityRps: 800, latencyMs: 8 },
  queue: { label: 'Hàng đợi', capacityRps: 20_000, latencyMs: 2 },
  worker: { label: 'Worker', capacityRps: 300, latencyMs: 50 },
  storage: { label: 'Lưu trữ tệp', capacityRps: 5000, latencyMs: 15 },
  search: { label: 'Tìm kiếm', capacityRps: 1500, latencyMs: 12 },
};

export const LIMITS = {
  maxNodes: 60,
  maxEdges: 200,
  maxRps: 10_000_000,
  maxReplicas: 1000,
  maxDurationSec: 600,
} as const;

export function defaultNode(
  type: NodeType,
  partial: Partial<DiagramNode> & { id: string }
): DiagramNode {
  const d = TYPE_DEFAULTS[type];
  return {
    type,
    label: d.label,
    x: 0,
    y: 0,
    replicas: 1,
    capacityRps: d.capacityRps,
    latencyMs: d.latencyMs,
    ...(d.hitRatio !== undefined ? { hitRatio: d.hitRatio } : {}),
    ...partial,
  };
}

export function createEmptySpec(): DiagramSpec {
  return {
    version: 1,
    nodes: [],
    edges: [],
    traffic: { rps: 1000, profile: 'constant', durationSec: 60 },
  };
}

/** A small but realistic starting point: web tier, cache and database. */
export function createSampleSpec(): DiagramSpec {
  const n = (
    id: string,
    type: NodeType,
    x: number,
    y: number,
    extra: Partial<DiagramNode> = {}
  ) => defaultNode(type, { id, x, y, ...extra });
  return {
    version: 1,
    traffic: { rps: 1500, profile: 'ramp', durationSec: 60 },
    nodes: [
      n('users', 'client', 80, 220),
      n('lb', 'load-balancer', 260, 220),
      n('api', 'api', 460, 220, { replicas: 2, label: 'API' }),
      n('cache', 'cache', 660, 120),
      n('db', 'database', 660, 320, { label: 'PostgreSQL' }),
    ],
    edges: [
      { id: 'e1', from: 'users', to: 'lb', weight: 1 },
      { id: 'e2', from: 'lb', to: 'api', weight: 1 },
      { id: 'e3', from: 'api', to: 'cache', weight: 0.7, label: 'đọc' },
      { id: 'e4', from: 'api', to: 'db', weight: 0.3, label: 'ghi' },
      { id: 'e5', from: 'cache', to: 'db', weight: 1 },
    ],
  };
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function slug(text: string) {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'node'
  );
}

/** Finds a cycle and returns the ids on it, or null for a DAG. */
export function findCycle(spec: DiagramSpec): string[] | null {
  const next = new Map<string, string[]>();
  for (const edge of spec.edges) {
    next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to]);
  }
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const to of next.get(id) ?? []) {
      if (state.get(to) === 1) return [...stack.slice(stack.indexOf(to)), to];
      if (!state.has(to)) {
        const cycle = visit(to);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const node of spec.nodes) {
    if (!state.has(node.id)) {
      const cycle = visit(node.id);
      if (cycle) return cycle;
    }
  }
  return null;
}

/**
 * Turns untrusted input (a stored block, a tool argument) into a valid spec:
 * missing fields get defaults, numbers are clamped, ids are made unique. Throws
 * an Error with a readable message when the diagram cannot be repaired.
 */
export function normalizeSpec(input: unknown): DiagramSpec {
  if (!input || typeof input !== 'object') {
    throw new Error('Đặc tả sơ đồ phải là một đối tượng JSON');
  }
  const raw = input as Record<string, unknown>;
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];
  if (rawNodes.length > LIMITS.maxNodes) {
    throw new Error(`Tối đa ${LIMITS.maxNodes} thành phần`);
  }
  if (rawEdges.length > LIMITS.maxEdges) {
    throw new Error(`Tối đa ${LIMITS.maxEdges} đường nối`);
  }

  const usedIds = new Set<string>();
  const nodes: DiagramNode[] = rawNodes.map((value, index) => {
    const item = (value ?? {}) as Record<string, unknown>;
    const type = NODE_TYPES.includes(item.type as NodeType)
      ? (item.type as NodeType)
      : null;
    if (!type) {
      throw new Error(
        `Thành phần #${index + 1} có "type" không hợp lệ. Chọn một trong: ${NODE_TYPES.join(', ')}`
      );
    }
    const d = TYPE_DEFAULTS[type];
    const label =
      typeof item.label === 'string' && item.label.trim()
        ? item.label.trim().slice(0, 60)
        : d.label;
    let id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 60)
        : slug(label);
    const base = id;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);

    const node: DiagramNode = {
      id,
      type,
      label,
      x: finite(item.x) ? clamp(item.x, -5000, 5000) : 80 + (index % 6) * 180,
      y: finite(item.y)
        ? clamp(item.y, -5000, 5000)
        : 80 + Math.floor(index / 6) * 160,
      replicas: finite(item.replicas)
        ? clamp(Math.round(item.replicas), 1, LIMITS.maxReplicas)
        : 1,
      capacityRps: finite(item.capacityRps)
        ? clamp(item.capacityRps, 1, 1e12)
        : d.capacityRps,
      latencyMs: finite(item.latencyMs)
        ? clamp(item.latencyMs, 0, 60_000)
        : d.latencyMs,
    };
    if (type === 'cache' || type === 'cdn') {
      node.hitRatio = finite(item.hitRatio)
        ? clamp(item.hitRatio, 0, 1)
        : (d.hitRatio ?? 0.8);
    }
    return node;
  });

  const ids = new Set(nodes.map(node => node.id));
  const usedEdgeIds = new Set<string>();
  const edges: DiagramEdge[] = rawEdges.map((value, index) => {
    const item = (value ?? {}) as Record<string, unknown>;
    const from = String(item.from ?? '');
    const to = String(item.to ?? '');
    if (!ids.has(from) || !ids.has(to)) {
      throw new Error(
        `Đường nối #${index + 1} trỏ tới thành phần không tồn tại ("${from}" → "${to}")`
      );
    }
    if (from === to) {
      throw new Error(
        `Đường nối #${index + 1} nối một thành phần với chính nó`
      );
    }
    let id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 60)
        : `${from}-${to}`;
    const base = id;
    for (let n = 2; usedEdgeIds.has(id); n++) id = `${base}-${n}`;
    usedEdgeIds.add(id);
    return {
      id,
      from,
      to,
      weight: finite(item.weight) ? clamp(item.weight, 0, 1e6) : 1,
      ...(typeof item.label === 'string' && item.label.trim()
        ? { label: item.label.trim().slice(0, 40) }
        : {}),
    };
  });

  const t = (raw.traffic ?? {}) as Record<string, unknown>;
  const spec: DiagramSpec = {
    version: 1,
    nodes,
    edges,
    traffic: {
      rps: finite(t.rps) ? clamp(t.rps, 0, LIMITS.maxRps) : 1000,
      profile: TRAFFIC_PROFILES.includes(t.profile as TrafficProfile)
        ? (t.profile as TrafficProfile)
        : 'constant',
      durationSec: finite(t.durationSec)
        ? clamp(t.durationSec, 1, LIMITS.maxDurationSec)
        : 60,
    },
  };

  const cycle = findCycle(spec);
  if (cycle) {
    throw new Error(
      `Sơ đồ có vòng lặp (${cycle.join(' → ')}). Mô phỏng chỉ hỗ trợ luồng một chiều.`
    );
  }
  return spec;
}
