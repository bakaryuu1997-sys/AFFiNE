import { describe, expect, test } from 'vitest';

import { analyzeSpec } from '../analyze';
import { createSampleSpec, defaultNode, type DiagramSpec } from '../spec';

const overloaded = (): DiagramSpec => ({
  version: 1,
  traffic: { rps: 3000, profile: 'constant', durationSec: 60 },
  nodes: [
    defaultNode('client', { id: 'users' }),
    defaultNode('api', { id: 'api', label: 'API', capacityRps: 1000 }),
    defaultNode('database', { id: 'db', label: 'DB', capacityRps: 800 }),
  ],
  edges: [
    { id: 'e1', from: 'users', to: 'api', weight: 1 },
    { id: 'e2', from: 'api', to: 'db', weight: 1 },
  ],
});

describe('analyzeSpec', () => {
  test('a healthy design reports full success and no suggestions', () => {
    const result = analyzeSpec(createSampleSpec(), 300);
    expect(result.successRate).toBe(100);
    expect(result.bottleneck).toBeNull();
    expect(result.nodes.some(n => 'suggestedReplicas' in n)).toBe(false);
  });

  test('an overloaded design names the bottleneck and suggests replicas', () => {
    const result = analyzeSpec(overloaded());
    expect(result.successRate).toBeLessThan(100);
    expect(result.bottleneck).toBe('API');
    const api = result.nodes.find(n => n.id === 'api')!;
    // 3000 rps at a 70% target on 1000 rps instances needs 5 instances
    expect(api.suggestedReplicas).toBe(5);
    expect(api.status).toBe('saturated');
  });

  test('following the suggestions fixes the design', () => {
    const spec = overloaded();
    for (const node of analyzeSpec(spec).nodes) {
      if ('suggestedReplicas' in node) {
        spec.nodes.find(n => n.id === node.id)!.replicas =
          node.suggestedReplicas as number;
      }
    }
    // one more pass is needed because the database only sees what the API lets through
    for (const node of analyzeSpec(spec).nodes) {
      if ('suggestedReplicas' in node) {
        spec.nodes.find(n => n.id === node.id)!.replicas =
          node.suggestedReplicas as number;
      }
    }
    expect(analyzeSpec(spec).successRate).toBe(100);
  });

  test('never suggests fewer replicas than there are, nor for clients', () => {
    const result = analyzeSpec(overloaded());
    for (const node of result.nodes) {
      if ('suggestedReplicas' in node) {
        expect(node.suggestedReplicas).toBeGreaterThanOrEqual(node.replicas);
      }
    }
    expect(result.nodes.find(n => n.type === 'client')).not.toHaveProperty(
      'suggestedReplicas'
    );
  });
});
