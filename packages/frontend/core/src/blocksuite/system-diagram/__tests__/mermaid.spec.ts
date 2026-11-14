import { describe, expect, test } from 'vitest';

import { diagramToMermaid } from '../mermaid';
import { createSampleSpec } from '../spec';

describe('diagramToMermaid', () => {
  test('lists every node and edge of the sample diagram', () => {
    const spec = createSampleSpec();
    const text = diagramToMermaid(spec);
    const lines = text.split('\n');
    expect(lines[0]).toBe('flowchart LR');
    // one line per node and per edge, plus the header
    expect(lines).toHaveLength(1 + spec.nodes.length + spec.edges.length);
    expect(text).toContain('users["');
  });

  test('keeps edge labels and neutralises quotes', () => {
    const spec = createSampleSpec();
    spec.nodes[0].label = 'Người "dùng"';
    const text = diagramToMermaid(spec);
    expect(text).toContain(`users["Người 'dùng'"]`);
    expect(text).toMatch(/api -->\|"[^"]+"\| cache/);
  });

  test('skips edges that point at missing nodes', () => {
    const spec = createSampleSpec();
    spec.edges.push({ id: 'bad', from: 'api', to: 'ghost', weight: 1 });
    expect(diagramToMermaid(spec)).not.toContain('ghost');
  });
});
