import { normalizeSpec } from './spec';

/**
 * In Markdown a diagram is a fenced code block with this language, holding a
 * JSON object `{ "title": ..., "spec": ... }`. It reads fine in any editor,
 * diffs well in git and can be written by hand or by an AI agent.
 */
export const DIAGRAM_MARKDOWN_LANG = 'system-diagram';

/** The text that goes inside the fenced block. */
export function encodeDiagram(title: string, spec: unknown): string {
  let value: unknown;
  try {
    value = JSON.parse(JSON.stringify(spec ?? {}));
  } catch {
    value = {};
  }
  try {
    value = normalizeSpec(value);
  } catch {
    // keep what was stored rather than losing it on export
  }
  return JSON.stringify({ title, spec: value }, null, 2);
}

/**
 * Reads the text of a fenced block back. Anything that is not valid JSON is
 * kept as the raw spec so nothing is thrown away; the block then shows its
 * "cannot read the spec" state and the text can be repaired.
 */
export function decodeDiagram(text: string): { title: string; spec: unknown } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { title: '', spec: text };
  }
  if (parsed && typeof parsed === 'object' && 'spec' in parsed) {
    const wrapped = parsed as { title?: unknown; spec: unknown };
    return {
      title: typeof wrapped.title === 'string' ? wrapped.title : '',
      spec: wrapped.spec,
    };
  }
  // a bare spec without the { title, spec } wrapper
  return { title: '', spec: parsed };
}
