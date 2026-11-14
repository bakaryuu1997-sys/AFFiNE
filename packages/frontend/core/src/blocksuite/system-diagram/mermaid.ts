import type { DiagramSpec } from './spec';

const quote = (text: string) => text.replace(/"/g, "'");

/** Turns a diagram into Mermaid `flowchart LR` text. */
export function diagramToMermaid(spec: DiagramSpec): string {
  const lines: string[] = ['flowchart LR'];
  const ids = new Map<string, string>();

  for (const node of spec.nodes) {
    const safeId = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
    ids.set(node.id, safeId);
    lines.push(`  ${safeId}["${quote(node.label || node.type)}"]`);
  }

  for (const edge of spec.edges) {
    const from = ids.get(edge.from);
    const to = ids.get(edge.to);
    if (!from || !to) continue;
    lines.push(
      edge.label
        ? `  ${from} -->|"${quote(edge.label)}"| ${to}`
        : `  ${from} --> ${to}`
    );
  }

  return lines.join('\n');
}
