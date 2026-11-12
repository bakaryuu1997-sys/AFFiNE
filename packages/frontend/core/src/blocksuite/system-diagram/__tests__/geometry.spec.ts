import { describe, expect, test } from 'vitest';

import {
  connectError,
  edgePath,
  freePosition,
  particleCount,
  uniqueId,
  viewBoxOf,
} from '../geometry';
import { createSampleSpec, defaultNode } from '../spec';

describe('geometry', () => {
  test('edgePath starts and ends at the node centers', () => {
    const path = edgePath({ x: 0, y: 100 }, { x: 300, y: 100 });
    expect(path.startsWith('M 0 82 C')).toBe(true);
    expect(path.endsWith('300 82')).toBe(true);
  });

  test('viewBox always covers the nodes', () => {
    const box = viewBoxOf([
      { x: 100, y: 100 },
      { x: 700, y: 400 },
    ]);
    expect(box.x).toBeLessThan(100);
    expect(box.x + box.w).toBeGreaterThan(700);
    expect(box.y + box.h).toBeGreaterThan(400);
    expect(viewBoxOf([]).w).toBeGreaterThan(0);
  });

  test('particle count grows with traffic but stays bounded', () => {
    expect(particleCount(0)).toBe(0);
    expect(particleCount(1)).toBeGreaterThanOrEqual(1);
    expect(particleCount(10)).toBeLessThan(particleCount(100_000));
    expect(particleCount(1e12)).toBe(12);
  });

  test('freePosition avoids existing nodes', () => {
    const nodes = [defaultNode('api', { id: 'a', x: 80, y: 100 })];
    const spot = freePosition(nodes);
    expect(Math.abs(spot.x - 80) >= 100 || Math.abs(spot.y - 100) >= 90).toBe(
      true
    );
  });

  test('uniqueId adds a numeric suffix', () => {
    expect(uniqueId('api', ['db'])).toBe('api');
    expect(uniqueId('api', ['api', 'api-2'])).toBe('api-3');
  });
});

describe('connectError', () => {
  const spec = createSampleSpec();
  test('accepts a valid new edge', () => {
    expect(connectError(spec, 'users', 'db')).toBeNull();
  });
  test('rejects self links, duplicates and cycles', () => {
    expect(connectError(spec, 'api', 'api')).toBe('self');
    expect(connectError(spec, 'api', 'cache')).toBe('duplicate');
    expect(connectError(spec, 'db', 'users')).toBe('cycle');
  });
});
