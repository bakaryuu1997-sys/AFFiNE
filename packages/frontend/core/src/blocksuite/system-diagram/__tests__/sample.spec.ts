import { describe, expect, test } from 'vitest';

import {
  createFullSampleSpec,
  createSampleSpec,
  findCycle,
  NODE_TYPES,
  normalizeSpec,
  type SampleNames,
} from '../spec';

const japanese: SampleNames = {
  label: type => `JA:${type}`,
  read: '読み取り',
  write: '書き込み',
};

describe('createSampleSpec', () => {
  test('uses the given names for components and edges', () => {
    const spec = createSampleSpec(japanese);
    expect(spec.nodes.find(n => n.id === 'users')?.label).toBe('JA:client');
    expect(spec.nodes.find(n => n.id === 'lb')?.label).toBe('JA:load-balancer');
    // components with their own product name keep it
    expect(spec.nodes.find(n => n.id === 'api')?.label).toBe('API');
    expect(spec.nodes.find(n => n.id === 'db')?.label).toBe('PostgreSQL');
    expect(spec.edges.map(e => e.label).filter(Boolean)).toEqual([
      '読み取り',
      '書き込み',
    ]);
  });

  test('without names it keeps the Vietnamese defaults and stays valid', () => {
    const spec = createSampleSpec();
    expect(spec.nodes.find(n => n.id === 'users')?.label).toBe('Người dùng');
    expect(normalizeSpec(spec).edges).toHaveLength(5);
    expect(normalizeSpec(createSampleSpec(japanese)).nodes).toHaveLength(5);
  });

  test('createFullSampleSpec creates a complete diagram with all 11 component types', () => {
    const spec = createFullSampleSpec();
    expect(spec.nodes).toHaveLength(11);
    const presentTypes = new Set(spec.nodes.map(n => n.type));
    for (const type of NODE_TYPES) {
      expect(presentTypes.has(type)).toBe(true);
    }
    expect(findCycle(spec)).toBeNull();
    const normalized = normalizeSpec(spec);
    expect(normalized.nodes).toHaveLength(11);
    expect(normalized.edges.length).toBeGreaterThanOrEqual(12);
  });
});
