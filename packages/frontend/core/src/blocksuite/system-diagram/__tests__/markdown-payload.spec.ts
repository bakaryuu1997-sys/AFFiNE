import { describe, expect, test } from 'vitest';

import { decodeDiagram, encodeDiagram } from '../markdown-payload';
import { createSampleSpec, normalizeSpec } from '../spec';

describe('markdown payload', () => {
  test('round-trips title and spec', () => {
    const spec = createSampleSpec();
    const text = encodeDiagram('Cửa hàng', spec);
    const back = decodeDiagram(text);
    expect(back.title).toBe('Cửa hàng');
    expect(normalizeSpec(back.spec)).toEqual(spec);
  });

  test('is human readable, indented JSON', () => {
    const text = encodeDiagram('x', createSampleSpec());
    expect(text.startsWith('{\n  "title": "x"')).toBe(true);
    expect(text).toContain('"type": "database"');
  });

  test('accepts a bare spec without the wrapper', () => {
    const spec = createSampleSpec();
    const back = decodeDiagram(JSON.stringify(spec));
    expect(back.title).toBe('');
    expect(normalizeSpec(back.spec)).toEqual(spec);
  });

  test('keeps text that is not JSON instead of dropping it', () => {
    const back = decodeDiagram('{ not json');
    expect(back.spec).toBe('{ not json');
  });

  test('repairs a sloppy spec on export but never loses an unreadable one', () => {
    const sloppy = {
      nodes: [{ type: 'api', label: 'API', replicas: 0 }],
      edges: [],
    };
    const fixed = JSON.parse(encodeDiagram('t', sloppy)).spec;
    expect(fixed.nodes[0].replicas).toBe(1);
    expect(fixed.version).toBe(1);

    const broken = { nodes: [{ type: 'toaster' }], edges: [] };
    expect(JSON.parse(encodeDiagram('t', broken)).spec).toEqual(broken);
  });
});
