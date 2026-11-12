import {
  type DiagramNode,
  type DiagramSpec,
  type DiagramTraffic,
  findCycle,
} from './spec';

export type NodeStatus = 'idle' | 'ok' | 'busy' | 'saturated';

export interface NodeResult {
  id: string;
  /** requests per second arriving */
  load: number;
  /** requests per second this node can serve (replicas x capacity) */
  capacity: number;
  served: number;
  dropped: number;
  /** load / capacity, can be above 1 */
  utilization: number;
  status: NodeStatus;
  /** latency of one request here, including waiting when busy */
  latencyMs: number;
}

export interface SimResult {
  rps: number;
  nodes: Record<string, NodeResult>;
  /** requests per second on each edge */
  edges: Record<string, number>;
  completed: number;
  /** completed / offered */
  successRate: number;
  /** expected end-to-end latency of requests that get through */
  latencyMs: number;
  /** most loaded node when it is at least 80% busy */
  bottleneck: string | null;
}

export interface TimelinePoint {
  t: number;
  rps: number;
  successRate: number;
  latencyMs: number;
  bottleneck: string | null;
}

const BUSY_AT = 0.8;
const SATURATED_AT = 0.999;

function statusOf(utilization: number): NodeStatus {
  if (utilization < 0.01) return 'idle';
  if (utilization >= SATURATED_AT) return 'saturated';
  if (utilization >= BUSY_AT) return 'busy';
  return 'ok';
}

/** Idle latency stretched by queueing: base / (1 - utilization). */
export function loadedLatency(baseMs: number, utilization: number): number {
  if (baseMs <= 0) return 0;
  if (utilization >= 1) return baseMs * 20;
  return Math.min(baseMs * 20, baseMs / (1 - Math.min(utilization, 0.95)));
}

function topologicalOrder(spec: DiagramSpec): DiagramNode[] {
  const indegree = new Map(spec.nodes.map(node => [node.id, 0]));
  for (const edge of spec.edges) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }
  const byId = new Map(spec.nodes.map(node => [node.id, node]));
  const queue = spec.nodes.filter(node => indegree.get(node.id) === 0);
  const order: DiagramNode[] = [];
  while (queue.length) {
    const node = queue.shift() as DiagramNode;
    order.push(node);
    for (const edge of spec.edges) {
      if (edge.from !== node.id) continue;
      const left = (indegree.get(edge.to) ?? 0) - 1;
      indegree.set(edge.to, left);
      if (left === 0) queue.push(byId.get(edge.to) as DiagramNode);
    }
  }
  return order;
}

/**
 * Steady-state flow through the diagram at `rps` requests per second.
 *
 * Every node serves at most replicas x capacity; the rest is dropped. Caches
 * and CDNs answer a hitRatio share themselves and forward the misses. Traffic
 * leaving a node is split over its edges by weight. Latency grows as a node
 * fills up (queueing), which is how overload shows up before requests fail.
 */
export function simulate(spec: DiagramSpec, rps = spec.traffic.rps): SimResult {
  if (findCycle(spec)) throw new Error('Sơ đồ có vòng lặp');
  const order = topologicalOrder(spec);

  const hasInbound = new Set(spec.edges.map(edge => edge.to));
  let entries = spec.nodes.filter(node => node.type === 'client');
  if (entries.length === 0) {
    entries = spec.nodes.filter(node => !hasInbound.has(node.id));
  }
  const entryLoad = entries.length ? rps / entries.length : 0;
  const entryIds = new Set(entries.map(node => node.id));

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, typeof spec.edges>();
  for (const edge of spec.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }

  const nodes: Record<string, NodeResult> = {};
  const edgeRps: Record<string, number> = {};
  const forwardShare = new Map<string, number>();
  let completed = 0;

  for (const node of order) {
    const load =
      (entryIds.has(node.id) ? entryLoad : 0) + (incoming.get(node.id) ?? 0);
    const capacity = node.replicas * node.capacityRps;
    const served = Math.min(load, capacity);
    const utilization = capacity > 0 ? load / capacity : 0;
    nodes[node.id] = {
      id: node.id,
      load,
      capacity,
      served,
      dropped: load - served,
      utilization,
      status: statusOf(utilization),
      latencyMs: loadedLatency(node.latencyMs, utilization),
    };

    const out = outgoing.get(node.id) ?? [];
    const answersItself = node.type === 'cache' || node.type === 'cdn';
    const hitShare = answersItself ? (node.hitRatio ?? 0) : 0;
    if (out.length === 0) {
      completed += served;
      forwardShare.set(node.id, 0);
      continue;
    }
    completed += served * hitShare;
    forwardShare.set(node.id, 1 - hitShare);
    const forwarded = served * (1 - hitShare);
    const totalWeight = out.reduce((sum, edge) => sum + edge.weight, 0);
    for (const edge of out) {
      const flow =
        totalWeight > 0 ? (forwarded * edge.weight) / totalWeight : 0;
      edgeRps[edge.id] = flow;
      incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + flow);
    }
  }
  for (const edge of spec.edges) edgeRps[edge.id] ??= 0;

  // expected latency, computed from the sinks back towards the entries
  const expected = new Map<string, number>();
  for (const node of [...order].reverse()) {
    const own = nodes[node.id].latencyMs;
    const out = outgoing.get(node.id) ?? [];
    const share = forwardShare.get(node.id) ?? 0;
    const totalWeight = out.reduce((sum, edge) => sum + edge.weight, 0);
    let downstream = 0;
    if (out.length > 0 && totalWeight > 0) {
      for (const edge of out) {
        downstream +=
          (edge.weight / totalWeight) * (expected.get(edge.to) ?? 0);
      }
    }
    expected.set(node.id, own + share * downstream);
  }
  const latencyMs = entries.length
    ? entries.reduce((sum, node) => sum + (expected.get(node.id) ?? 0), 0) /
      entries.length
    : 0;

  let bottleneck: string | null = null;
  let highest = BUSY_AT;
  for (const node of order) {
    const { utilization } = nodes[node.id];
    if (utilization >= highest) {
      highest = utilization;
      bottleneck = node.id;
    }
  }

  return {
    rps,
    nodes,
    edges: edgeRps,
    completed,
    successRate: rps > 0 ? Math.min(1, completed / rps) : 1,
    latencyMs: Math.round(latencyMs * 10) / 10,
    bottleneck,
  };
}

/** Requests per second at time `t` of a run. */
export function trafficAt(traffic: DiagramTraffic, t: number): number {
  const progress = Math.min(1, Math.max(0, t / traffic.durationSec));
  switch (traffic.profile) {
    case 'ramp':
      return traffic.rps * (0.1 + 0.9 * progress);
    case 'spike':
      return progress >= 0.4 && progress < 0.6 ? traffic.rps * 3 : traffic.rps;
    default:
      return traffic.rps;
  }
}

export function simulateTimeline(
  spec: DiagramSpec,
  samples = 60
): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  const count = Math.max(2, samples);
  for (let i = 0; i < count; i++) {
    const t = (spec.traffic.durationSec * i) / (count - 1);
    const result = simulate(spec, trafficAt(spec.traffic, t));
    points.push({
      t,
      rps: result.rps,
      successRate: result.successRate,
      latencyMs: result.latencyMs,
      bottleneck: result.bottleneck,
    });
  }
  return points;
}

/** 15000 -> "15K/s", 820 -> "820/s", 1500000 -> "1.5M/s" */
export function formatRate(rps: number): string {
  const trim = (n: number) =>
    n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  if (rps >= 1_000_000) return `${trim(rps / 1_000_000)}M/s`;
  if (rps >= 1000) return `${trim(rps / 1000)}K/s`;
  return `${Math.round(rps)}/s`;
}
