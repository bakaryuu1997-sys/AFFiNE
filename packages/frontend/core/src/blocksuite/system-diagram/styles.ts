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
    overflow: visible;
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
    overflow: hidden;
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

  system-diagram-block.sd-fullscreen {
    position: fixed !important;
    inset: 0 !important;
    z-index: 99999 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-height: none !important;
    background: var(--sd-bg, #1a1a1a) !important;
    padding: 16px !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    border-radius: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }
  system-diagram-block.sd-fullscreen .sd-canvas {
    flex: 1 !important;
    height: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  system-diagram-block.sd-fullscreen .sd-svg {
    max-height: calc(100vh - 180px) !important;
    height: 100% !important;
  }

  system-diagram-block .sd-zoom-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--sd-border);
    color: var(--sd-text);
    min-width: 38px;
    text-align: center;
    user-select: none;
    cursor: pointer;
  }

  system-diagram-block .sd-canvas {
    cursor: grab;
    overflow: hidden;
  }
  system-diagram-block .sd-canvas.panning {
    cursor: grabbing;
  }

  system-diagram-block .sd-preset-select {
    background: var(--sd-surface);
    color: var(--sd-accent);
    border: 1px solid var(--sd-accent);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    outline: none;
  }

  system-diagram-block .sd-node-floating-toolbar {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--sd-surface, #242428);
    border: 1px solid var(--sd-accent, #7c8cff);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    border-radius: 8px;
    padding: 10px 14px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 90%;
    backdrop-filter: blur(8px);
    animation: sd-fade-in 0.15s ease-out;
  }

  @keyframes sd-fade-in {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  system-diagram-block .sd-nft-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--sd-text);
  }

  system-diagram-block .sd-nft-type {
    font-size: 11px;
    color: var(--sd-muted);
    font-weight: 400;
    margin-left: auto;
  }

  system-diagram-block .sd-nft-edit-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  system-diagram-block .sd-nft-edit-row input {
    flex: 1;
    background: var(--sd-bg);
    color: var(--sd-text);
    border: 1px solid var(--sd-border);
    border-radius: 5px;
    padding: 4px 8px;
    font-size: 12px;
    outline: none;
  }
  system-diagram-block .sd-nft-edit-row input:focus {
    border-color: var(--sd-accent);
  }

  system-diagram-block .sd-nft-presets-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--sd-muted);
  }

  system-diagram-block .sd-nft-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  system-diagram-block .sd-badge-btn {
    background: color-mix(in srgb, var(--sd-surface) 80%, #fff 10%);
    color: var(--sd-text);
    border: 1px solid var(--sd-border);
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  system-diagram-block .sd-badge-btn:hover {
    border-color: var(--sd-accent);
    color: var(--sd-accent);
    background: color-mix(in srgb, var(--sd-accent) 15%, transparent);
  }
  system-diagram-block .sd-badge-btn.active {
    background: var(--sd-accent);
    color: #fff;
    border-color: var(--sd-accent);
  }

  /* Container for Add Component Dropdown */
  system-diagram-block .sd-add-menu-container {
    position: relative;
    display: inline-block;
  }

  system-diagram-block .sd-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
  }

  /* Flyout 2-column menu */
  system-diagram-block .sd-flyout-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    left: auto;
    z-index: 1000;
    display: flex;
    background: var(--sd-surface, #1e1e22);
    border: 1px solid var(--sd-border, #333338);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    overflow: hidden;
    width: 490px;
    height: 350px;
    animation: sd-flyout-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes sd-flyout-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Left column: Categories list */
  system-diagram-block .sd-flyout-categories {
    width: 200px;
    background: color-mix(in srgb, var(--sd-surface, #1e1e22) 85%, #000 15%);
    border-right: 1px solid var(--sd-border, #333338);
    display: flex;
    flex-direction: column;
    padding: 6px 0;
    overflow-y: auto;
    flex-shrink: 0;
  }

  system-diagram-block .sd-flyout-cat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--sd-text, #e2e2e8);
    cursor: pointer;
    user-select: none;
    transition: background 0.12s ease, color 0.12s ease;
  }

  system-diagram-block .sd-flyout-cat-item:hover,
  system-diagram-block .sd-flyout-cat-item.active {
    background: color-mix(in srgb, var(--sd-accent, #7c8cff) 20%, transparent);
    color: var(--sd-accent, #7c8cff);
  }

  system-diagram-block .sd-flyout-cat-item.active {
    font-weight: 600;
  }

  system-diagram-block .sd-cat-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  system-diagram-block .sd-cat-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  system-diagram-block .sd-cat-arrow {
    font-size: 14px;
    color: var(--sd-muted, #888);
    opacity: 0.6;
  }
  system-diagram-block .sd-flyout-cat-item.active .sd-cat-arrow {
    opacity: 1;
    color: var(--sd-accent, #7c8cff);
  }

  /* Right column: Items of selected category */
  system-diagram-block .sd-flyout-items {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--sd-surface, #1e1e22);
    overflow: hidden;
  }

  system-diagram-block .sd-flyout-items-header {
    padding: 8px 14px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--sd-muted, #888);
    border-bottom: 1px solid var(--sd-border, #333338);
    background: color-mix(in srgb, var(--sd-surface, #1e1e22) 95%, #fff 5%);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  system-diagram-block .sd-flyout-items-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  system-diagram-block .sd-flyout-subitem {
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: background 0.12s ease;
  }

  system-diagram-block .sd-flyout-subitem:hover {
    background: color-mix(in srgb, var(--sd-accent, #7c8cff) 15%, transparent);
  }

  system-diagram-block .sd-subitem-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--sd-text, #f0f0f5);
  }

  system-diagram-block .sd-flyout-subitem:hover .sd-subitem-title {
    color: var(--sd-accent, #7c8cff);
  }

  system-diagram-block .sd-subitem-desc {
    font-size: 11px;
    color: var(--sd-muted, #8c8c96);
    line-height: 1.3;
  }
`;
