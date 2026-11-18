export interface DiagramHintStrings {
  connectHint: string;
  connectPickTarget: string;
}

/**
 * Resolves the banner hint displayed on the diagram canvas.
 * Validation errors (`notice`) always take precedence so users see why a
 * connection failed even while connect mode stays active.
 */
export function resolveDiagramHint(
  connecting: boolean,
  connectFrom: string | null,
  notice: string | null,
  strings: DiagramHintStrings
): string | null {
  if (notice) return notice;
  if (connecting) {
    return connectFrom ? strings.connectPickTarget : strings.connectHint;
  }
  return null;
}

export interface SvgQueryHost {
  shadowRoot: ParentNode | null;
  querySelector<E extends Element = Element>(selectors: string): E | null;
}

/** Finds the rendered diagram SVG element across Light DOM or Shadow DOM. */
export function resolveExportSvg(host: SvgQueryHost): SVGSVGElement | null {
  return (
    host.querySelector<SVGSVGElement>('svg.sd-svg') ??
    host.shadowRoot?.querySelector<SVGSVGElement>('svg.sd-svg') ??
    null
  );
}

interface EditableTitleText {
  length?: number;
  replace?: (index: number, length: number, text: string) => void;
}

interface TitleSyncStore {
  id?: string;
  root?: {
    title?: EditableTitleText;
    props?: {
      title?: EditableTitleText;
    };
  } | null;
  doc?: {
    id?: string;
    collection?: {
      meta?: {
        setDocMeta?: (id: string, meta: { title: string }) => void;
      };
    };
  };
  collection?: {
    meta?: {
      setDocMeta?: (id: string, meta: { title: string }) => void;
    };
  };
  meta?: {
    title?: string;
  };
}

/**
 * Keeps the document's root page Y.Text title and workspace metadata in sync
 * so renaming a diagram or loading a template updates the H1 heading and
 * persists across reopen/navigation.
 */
export function syncDocTitle(store: unknown, newTitle: string): void {
  const s = store as TitleSyncStore | null | undefined;
  if (!s) return;

  const rootTitle = s.root?.props?.title ?? s.root?.title;
  if (rootTitle && typeof rootTitle.replace === 'function') {
    rootTitle.replace(0, rootTitle.length ?? 0, newTitle);
  }

  const docId = s.id || s.doc?.id;
  const collection = s.collection || s.doc?.collection;
  if (collection?.meta?.setDocMeta && docId) {
    collection.meta.setDocMeta(docId, { title: newTitle });
  }
  if (s.meta) {
    s.meta.title = newTitle;
  }
}

const GENERIC_DIAGRAM_TITLES = new Set([
  '',
  'sơ đồ hệ thống',
  'system diagram',
  'システム構成図',
  'untitled',
]);

/**
 * Returns true when an existing diagram doc still carries a generic/empty page
 * title even though its diagram block already has a specific custom title.
 */
export function shouldAutoSyncDiagramTitle(
  blockTitle: string | null | undefined,
  docTitle: string | null | undefined
): boolean {
  const normalizedBlock = (blockTitle ?? '').trim();
  if (!normalizedBlock) return false;
  if (GENERIC_DIAGRAM_TITLES.has(normalizedBlock.toLowerCase())) return false;

  const normalizedDoc = (docTitle ?? '').trim().toLowerCase();
  return GENERIC_DIAGRAM_TITLES.has(normalizedDoc);
}

export function getDocTitle(store: unknown): string {
  const s = store as
    | (TitleSyncStore & {
        root?: {
          title?: { toString?: () => string };
          props?: { title?: { toString?: () => string } };
        } | null;
      })
    | null
    | undefined;
  const rootTitle = s?.root?.props?.title ?? s?.root?.title;
  const fromRoot =
    rootTitle && typeof rootTitle.toString === 'function'
      ? rootTitle.toString()
      : '';
  return fromRoot || s?.meta?.title || '';
}
