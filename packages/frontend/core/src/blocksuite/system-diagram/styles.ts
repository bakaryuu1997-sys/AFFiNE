import { css } from 'lit';

/**
 * Blocks render without a shadow root, so every rule is scoped by the tag name.
 * Colors come from AFFiNE's theme variables, with fallbacks for dark mode.
 */
export const systemDiagramStyles = css`
  system-diagram-block {
    display: block;
    margin: 12px 0;
  }

  system-diagram-block .sd {
    --sd-accent: #7c8cff;
    --sd-surface: var(--affine-v2-layer-background-secondary, #2b2b30);
    --sd-shade: color-mix(in srgb, var(--sd-surface) 55%, #000);
    --sd-bg: var(--affine-v2-layer-background-primary, #1c1c1f);
    --sd-border: var(--affine-v2-layer-insideBorder-border, #3d3d45);
    --sd-text: var(--affine-v2-text-primary, #ececf1);
    --sd-muted: var(--affine-v2-text-secondary, #9a9aa6);
    --sd-ok: #3fb68b;
    --sd-busy: #e0a43a;
    --sd-bad: #e5534b;
    --sd-flow: #58a6ff;
    border: 1px solid var(--sd-border);
    border-radius: 10px;
    background: var(--sd-bg);
    color: var(--sd-text);
    font-size: 13px;
    overflow: hidden;
    user-select: none;
  }

  system-diagram-block .sd-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--sd-border);
  }

  system-diagram-block .sd-title {
    flex: 1 1 140px;
    min-width: 120px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--sd-text);
    font-size: 14px;
    font-weight: 600;
  }

  system-diagram-block .sd-btn,
  system-diagram-block .sd select,
  system-diagram-block .sd input[type='number'],
  system-diagram-block .sd input[type='text'] {
    background: var(--sd-surface);
    color: var(--sd-text);
    border: 1px solid var(--sd-border);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 12px;
    font-family: inherit;
  }

  system-diagram-block .sd-btn {
    cursor: pointer;
  }
  system-diagram-block .sd-btn:hover:not(:disabled) {
    border-color: var(--sd-accent);
  }
  system-diagram-block .sd-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  system-diagram-block .sd-btn.active {
    background: var(--sd-accent);
    border-color: var(--sd-accent);
    color: #fff;
  }

  system-diagram-block .sd-time {
    flex: 1 1 120px;
    min-width: 100px;
    accent-color: var(--sd-accent);
  }

  system-diagram-block .sd-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    padding: 6px 12px;
    border-top: 1px solid var(--sd-border);
    color: var(--sd-muted);
    font-size: 12px;
  }
  system-diagram-block .sd-metrics b {
    color: var(--sd-text);
  }
  system-diagram-block .sd-metrics .bad b {
    color: var(--sd-bad);
  }
  system-diagram-block .sd-metrics .warn b {
    color: var(--sd-busy);
  }

  system-diagram-block .sd-canvas {
    position: relative;
  }
  system-diagram-block .sd-svg {
    display: block;
    width: 100%;
    height: auto;
    min-height: 220px;
    max-height: 560px;
    touch-action: none;
  }
  system-diagram-block .sd-hint {
    position: absolute;
    left: 12px;
    top: 8px;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--sd-accent);
    color: #fff;
    font-size: 12px;
  }
  system-diagram-block .sd-empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--sd-muted);
  }

  system-diagram-block .edge {
    stroke: color-mix(in srgb, var(--sd-text) 38%, transparent);
    stroke-width: 0.8;
  }
  system-diagram-block .ring {
    stroke: color-mix(in srgb, var(--sd-text) 40%, transparent);
    stroke-width: 1;
  }
  system-diagram-block .code {
    stroke: color-mix(in srgb, #fff 75%, transparent);
    stroke-width: 1.4;
    fill: none;
  }

  system-diagram-block .link {
    fill: none;
    stroke: color-mix(in srgb, var(--sd-text) 28%, transparent);
    stroke-width: 2;
  }
  system-diagram-block .link.live {
    stroke: color-mix(in srgb, var(--sd-flow) 55%, transparent);
  }
  system-diagram-block .link.hot {
    stroke: color-mix(in srgb, var(--sd-bad) 60%, transparent);
  }
  system-diagram-block .link.selected {
    stroke-width: 3.5;
  }
  system-diagram-block .p {
    fill: var(--sd-flow);
  }
  system-diagram-block .p.hot {
    fill: var(--sd-bad);
  }

  system-diagram-block .pill {
    fill: var(--sd-bg);
    stroke: var(--sd-border);
    stroke-width: 1;
  }
  system-diagram-block .pill.bad {
    stroke: var(--sd-bad);
  }
  system-diagram-block .pill.warn {
    stroke: var(--sd-busy);
  }
  system-diagram-block .pill-text {
    fill: var(--sd-text);
    font-size: 10.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
  system-diagram-block .pill-text.bad {
    fill: var(--sd-bad);
  }
  system-diagram-block .pill-text.warn {
    fill: var(--sd-busy);
  }

  system-diagram-block .node {
    cursor: grab;
  }
  system-diagram-block .node.dragging {
    cursor: grabbing;
  }
  system-diagram-block .node-box {
    fill: transparent;
    stroke: transparent;
    stroke-width: 1.5;
    rx: 8;
  }
  system-diagram-block .node.selected .node-box {
    stroke: var(--sd-accent);
    fill: color-mix(in srgb, var(--sd-accent) 8%, transparent);
  }
  system-diagram-block .node.connect-source .node-box {
    stroke: var(--sd-flow);
    stroke-dasharray: 4 3;
  }
  system-diagram-block .node-label {
    fill: var(--sd-text);
    font-size: 13px;
    font-weight: 600;
    text-anchor: middle;
    pointer-events: none;
  }
  system-diagram-block .node-type {
    fill: var(--sd-accent);
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    text-anchor: middle;
    pointer-events: none;
  }
  system-diagram-block .pulse {
    fill: none;
    stroke: var(--sd-bad);
    stroke-width: 2;
    transform-box: fill-box;
    transform-origin: center;
    animation: sd-pulse 1.4s ease-out infinite;
  }
  @keyframes sd-pulse {
    from {
      opacity: 0.9;
      transform: scale(0.8);
    }
    to {
      opacity: 0;
      transform: scale(1.6);
    }
  }

  system-diagram-block .sd-inspector {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 8px 14px;
    padding: 10px 12px;
    border-top: 1px solid var(--sd-border);
    background: color-mix(in srgb, var(--sd-surface) 40%, transparent);
  }
  system-diagram-block .sd-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: var(--sd-muted);
    font-size: 11px;
  }
  system-diagram-block .sd-field input,
  system-diagram-block .sd-field select {
    width: 100%;
    box-sizing: border-box;
  }
  system-diagram-block .sd-field .row {
    display: flex;
    gap: 4px;
  }
  system-diagram-block .sd-field .row input {
    text-align: center;
  }
  system-diagram-block .sd-group-title {
    grid-column: 1 / -1;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--sd-muted);
  }

  system-diagram-block .chart-line {
    fill: none;
    stroke-width: 1.6;
  }
  system-diagram-block .chart-ok {
    stroke: var(--sd-ok);
  }
  system-diagram-block .chart-rps {
    stroke: var(--sd-flow);
    stroke-dasharray: 3 3;
  }
  system-diagram-block .chart-now {
    stroke: var(--sd-text);
    stroke-width: 1;
    opacity: 0.6;
  }
`;
