import { describe, expect, test } from 'vitest';

import {
  formatRate,
  loadedLatency,
  simulate,
  simulateTimeline,
  trafficAt,
} from '../simulate';
import {
  createSampleSpec,
  defaultNode,
  type DiagramSpec,
  findCycle,
  normalizeSpec,
} from '../spec';

const chain = (apiReplicas: number, rps: number): DiagramSpec => ({
  version: 1,
  traffic: { rps, profile: 'constant', durationSec: 60 },
  nodes: [
    defaultNode('client', { id: 'users' }),
    defaultNode('api', { id: 'api', replicas: apiReplicas, capacityRps: 1000 }),
    defaultNode('database', { id: 'db', capacityRps: 800 }),
  ],
  edges: [
    { id: 'e1', from: 'users', to: 'api', weight: 1 },
    { id: 'e2', from: 'api', to: 'db', weight: 1 },
  ],
});

describe('simulate', () => {
  test('under capacity everything completes', () => {
    const result = simulate(chain(1, 500));
    expect(result.successRate).toBe(1);
    expect(result.nodes.api.status).toBe('ok');
    expect(result.edges.e2).toBeCloseTo(500);
    expect(result.bottleneck).toBeNull();
  });

  test('the slowest tier limits throughput and is reported as bottleneck', () => {
    // api could take 3000/s but the database only 800/s
    const result = simulate(chain(3, 2000));
    expect(result.nodes.db.status).toBe('saturated');
    expect(result.nodes.db.dropped).toBeCloseTo(1200);
    expect(result.completed).toBeCloseTo(800);
    expect(result.successRate).toBeCloseTo(0.4);
    expect(result.bottleneck).toBe('db');
  });

  test('adding replicas to the bottleneck fixes it', () => {
    const spec = chain(3, 2000);
    spec.nodes.find(n => n.id === 'db')!.replicas = 3;
    expect(simulate(spec).successRate).toBe(1);
  });

  test('load balancers split by edge weight', () => {
    const spec: DiagramSpec = {
      version: 1,
      traffic: { rps: 1000, profile: 'constant', durationSec: 60 },
      nodes: [
        defaultNode('client', { id: 'users' }),
        defaultNode('load-balancer', { id: 'lb' }),
        defaultNode('api', { id: 'a' }),
        defaultNode('api', { id: 'b' }),
      ],
      edges: [
        { id: '1', from: 'users', to: 'lb', weight: 1 },
        { id: '2', from: 'lb', to: 'a', weight: 3 },
        { id: '3', from: 'lb', to: 'b', weight: 1 },
      ],
    };
    const result = simulate(spec);
    expect(result.edges['2']).toBeCloseTo(750);
    expect(result.edges['3']).toBeCloseTo(250);
  });

  test('a cache answers hits itself and forwards only misses', () => {
    const spec: DiagramSpec = {
      version: 1,
      traffic: { rps: 1000, profile: 'constant', durationSec: 60 },
      nodes: [
        defaultNode('client', { id: 'users' }),
        defaultNode('cache', { id: 'cache', hitRatio: 0.9 }),
        defaultNode('database', { id: 'db', capacityRps: 200 }),
      ],
      edges: [
        { id: '1', from: 'users', to: 'cache', weight: 1 },
        { id: '2', from: 'cache', to: 'db', weight: 1 },
      ],
    };
    const result = simulate(spec);
    expect(result.edges['2']).toBeCloseTo(100);
    expect(result.successRate).toBe(1);
  });

  test('latency grows as a node fills up', () => {
    expect(loadedLatency(20, 0)).toBe(20);
    expect(loadedLatency(20, 0.5)).toBeCloseTo(40);
    expect(loadedLatency(20, 0.9)).toBeGreaterThan(loadedLatency(20, 0.5));
    expect(loadedLatency(20, 2)).toBe(400);
    expect(loadedLatency(0, 0.9)).toBe(0);
    const calm = simulate(chain(3, 100)).latencyMs;
    const busy = simulate(chain(3, 700)).latencyMs;
    expect(busy).toBeGreaterThan(calm);
  });

  test('zero traffic is harmless', () => {
    const result = simulate(chain(1, 0));
    expect(result.successRate).toBe(1);
    expect(result.bottleneck).toBeNull();
  });

  test('refuses cycles', () => {
    const spec = chain(1, 100);
    spec.edges.push({ id: 'back', from: 'db', to: 'api', weight: 1 });
    expect(findCycle(spec)).not.toBeNull();
    expect(() => simulate(spec)).toThrow(/vòng lặp/);
  });
});

describe('traffic profiles', () => {
  const base = { rps: 1000, durationSec: 100 };
  test('constant, ramp and spike', () => {
    expect(trafficAt({ ...base, profile: 'constant' }, 50)).toBe(1000);
    expect(trafficAt({ ...base, profile: 'ramp' }, 0)).toBeCloseTo(100);
    expect(trafficAt({ ...base, profile: 'ramp' }, 100)).toBeCloseTo(1000);
    expect(trafficAt({ ...base, profile: 'spike' }, 50)).toBe(3000);
    expect(trafficAt({ ...base, profile: 'spike' }, 10)).toBe(1000);
  });

  test('timeline covers the whole run', () => {
    const timeline = simulateTimeline(createSampleSpec(), 10);
    expect(timeline).toHaveLength(10);
    expect(timeline[0].t).toBe(0);
    expect(timeline.at(-1)!.t).toBe(60);
  });
});

describe('normalizeSpec', () => {
  test('fills defaults, clamps and makes ids unique', () => {
    const spec = normalizeSpec({
      nodes: [
        { type: 'api', label: 'API', replicas: 99999, x: 1e9 },
        { type: 'api', label: 'API' },
        { type: 'cache', label: 'Cache' },
      ],
      edges: [{ from: 'api', to: 'api-2' }],
      traffic: { rps: -5, profile: 'weird' },
    });
    expect(spec.nodes.map(n => n.id)).toEqual(['api', 'api-2', 'cache']);
    expect(spec.nodes[0].replicas).toBe(1000);
    expect(spec.nodes[0].x).toBe(5000);
    expect(spec.nodes[2].hitRatio).toBe(0.8);
    expect(spec.traffic).toEqual({
      rps: 0,
      profile: 'constant',
      durationSec: 60,
    });
  });

  test('rejects bad input with readable errors', () => {
    expect(() => normalizeSpec(null)).toThrow(/đối tượng/);
    expect(() => normalizeSpec({ nodes: [{ type: 'toaster' }] })).toThrow(
      /type/
    );
    expect(() =>
      normalizeSpec({
        nodes: [{ type: 'api', id: 'a' }],
        edges: [{ from: 'a', to: 'ghost' }],
      })
    ).toThrow(/không tồn tại/);
    expect(() =>
      normalizeSpec({
        nodes: [
          { type: 'api', id: 'a' },
          { type: 'api', id: 'b' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
      })
    ).toThrow(/vòng lặp/);
  });

  test('the sample spec is valid and healthy at its start', () => {
    const sample = createSampleSpec();
    expect(normalizeSpec(sample).nodes).toHaveLength(5);
    expect(simulate(sample, 300).successRate).toBe(1);
  });
});

describe('formatRate', () => {
  test('is compact', () => {
    expect(formatRate(820)).toBe('820/s');
    expect(formatRate(15000)).toBe('15K/s');
    expect(formatRate(4900)).toBe('4.9K/s');
    expect(formatRate(1_500_000)).toBe('1.5M/s');
  });
});
