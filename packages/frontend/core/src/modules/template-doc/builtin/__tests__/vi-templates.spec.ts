import { describe, expect, test } from 'vitest';

import { VI_TEMPLATES } from '../vi-templates';

describe('VI_TEMPLATES', () => {
  test('has the five bundled templates with unique ids and titles', () => {
    expect(VI_TEMPLATES).toHaveLength(5);
    expect(new Set(VI_TEMPLATES.map(t => t.id)).size).toBe(5);
    expect(new Set(VI_TEMPLATES.map(t => t.title)).size).toBe(5);
  });

  test('every template has content and no dated task tokens', () => {
    for (const template of VI_TEMPLATES) {
      expect(template.markdown.trim().length).toBeGreaterThan(50);
      // a placeholder date would leak into every doc made from the template
      expect(template.markdown).not.toMatch(/@\d{4}-\d{2}-\d{2}/);
    }
  });
});
