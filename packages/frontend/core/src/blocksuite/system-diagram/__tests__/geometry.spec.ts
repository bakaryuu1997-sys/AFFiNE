import { describe, expect, test } from 'vitest';

import {
  connectError,
  edgeMidpoint,
  edgePath,
  freePosition,
  layoutEdgePills,
  particleCount,
  uniqueId,
  viewBoxOf,
} from '../geometry';
import {
  createFullSampleSpec,
  createOffshore3TierSpec,
  createOffshoreBatchEtlSpec,
  createOffshoreHaDrSpec,
  createOffshoreMicroservicesSpec,
  createOffshoreRagAiSpec,
  createSampleSpec,
  defaultNode,
} from '../spec';

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

  test('freePosition leaves full vertical clearance so badges never touch adjacent icons', () => {
    const nodes = [defaultNode('client', { id: 'users', x: 70, y: 200 })];
    const spot = freePosition(nodes);
    expect(Math.abs(spot.x - 70) >= 130 || Math.abs(spot.y - 200) >= 135).toBe(
      true
    );
  });

  test('edgeMidpoint does not push short vertical edge pills onto the source node label', () => {
    const cache = { x: 720, y: 100 };
    const db = { x: 720, y: 220 };
    const mid = edgeMidpoint(cache, db, [cache, db]);
    // Must not sit on cache's icon/label area (y around 82..120) or badge (y around 144..162)
    const onCacheLabel =
      Math.abs(mid.x - cache.x) < 55 && mid.y > cache.y - 40 && mid.y < cache.y + 62;
    expect(onCacheLabel).toBe(false);
  });

  test('layoutEdgePills produces zero pill-node-text and zero pill-pill overlaps on all 7 built-in presets', () => {
    const specs = [
      { name: '3tier', spec: createOffshore3TierSpec() },
      { name: 'microservices', spec: createOffshoreMicroservicesSpec() },
      { name: 'batch', spec: createOffshoreBatchEtlSpec() },
      { name: 'rag', spec: createOffshoreRagAiSpec() },
      { name: 'hadr', spec: createOffshoreHaDrSpec() },
      { name: 'full', spec: createFullSampleSpec() },
      { name: 'sample', spec: createSampleSpec() },
    ];

    const rectsOverlap = (
      a: { l: number; r: number; t: number; b: number },
      b: { l: number; r: number; t: number; b: number }
    ) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

    for (const { name, spec } of specs) {
      const byId = new Map(spec.nodes.map(n => [n.id, n]));
      const items = spec.edges
        .map(e => {
          const from = byId.get(e.from);
          const to = byId.get(e.to);
          if (!from || !to) return null;
          const text = `${e.label ? `${e.label} ` : ''}999/s`;
          const width = Math.max(44, text.length * 6.4 + 16);
          return { id: e.id, from, to, width };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      const positions = layoutEdgePills(items, spec.nodes);

      // Node text + badge area using realistic rendered font width (7.4px/char)
      const nodeTextBoxes = spec.nodes.map(n => {
        const halfW = Math.max(64, (n.label.length * 7.4) / 2 + 6);
        return {
          id: n.id,
          l: n.x - halfW,
          r: n.x + halfW,
          t: n.y + 4,
          b: n.y + 66,
        };
      });

      const pillBoxes = items.map(item => {
        const pos = positions.get(item.id)!;
        return {
          id: item.id,
          l: pos.x - item.width / 2,
          r: pos.x + item.width / 2,
          t: pos.y - 9,
          b: pos.y + 9,
        };
      });

      for (const pb of pillBoxes) {
        for (const nb of nodeTextBoxes) {
          expect(
            rectsOverlap(pb, nb),
            `Preset ${name}: edge pill "${pb.id}" overlapped node "${nb.id}"`
          ).toBe(false);
        }
      }

      for (let i = 0; i < pillBoxes.length; i++) {
        for (let j = i + 1; j < pillBoxes.length; j++) {
          expect(
            rectsOverlap(pillBoxes[i], pillBoxes[j]),
            `Preset ${name}: edge pill "${pillBoxes[i].id}" overlapped edge pill "${pillBoxes[j].id}"`
          ).toBe(false);
        }
      }
    }
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
