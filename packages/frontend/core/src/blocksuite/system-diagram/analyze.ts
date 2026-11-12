import { simulate, simulateTimeline } from './simulate';
import type { DiagramSpec } from './spec';

/** Target utilization used when suggesting how many replicas a tier needs. */
const TARGET_UTILIZATION = 0.7;
/** From this utilization on a node gets a replica suggestion. */
const SUGGEST_FROM = 0.8;

const pct = (value: number) => Math.round(value * 1000) / 10;

/** A compact, agent-friendly reading of how a design behaves under load. */
export function analyzeSpec(spec: DiagramSpec, rps?: number) {
  const result = simulate(spec, rps ?? spec.traffic.rps);
  const timeline = simulateTimeline(spec, 12);
  const worst = timeline.reduce((a, b) =>
    b.successRate < a.successRate ? b : a
  );
  const label = (id: string | null) =>
    id ? (spec.nodes.find(n => n.id === id)?.label ?? id) : null;

  return {
    rps: Math.round(result.rps),
    successRate: pct(result.successRate),
    latencyMs: result.latencyMs,
    bottleneck: label(result.bottleneck),
    worstMoment: {
      atSecond: Math.round(worst.t),
      rps: Math.round(worst.rps),
      successRate: pct(worst.successRate),
      bottleneck: label(worst.bottleneck),
    },
    nodes: spec.nodes.map(node => {
      const r = result.nodes[node.id];
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        replicas: node.replicas,
        loadRps: Math.round(r.load),
        capacityRps: Math.round(r.capacity),
        utilizationPercent: Math.round(r.utilization * 100),
        status: r.status,
        latencyMs: Math.round(r.latencyMs * 10) / 10,
        ...(r.utilization >= SUGGEST_FROM && node.type !== 'client'
          ? {
              suggestedReplicas: Math.max(
                node.replicas,
                Math.ceil(r.load / (node.capacityRps * TARGET_UTILIZATION))
              ),
            }
          : {}),
      };
    }),
  };
}
