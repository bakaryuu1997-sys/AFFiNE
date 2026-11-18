import { describe, expect, test, vi } from 'vitest';

import {
  resolveDiagramHint,
  resolveExportSvg,
  shouldAutoSyncDiagramTitle,
  type SvgQueryHost,
  syncDocTitle,
} from '../block-helpers';

describe('resolveDiagramHint', () => {
  const strings = {
    connectHint: 'Chọn thành phần nguồn, rồi chọn thành phần đích.',
    connectPickTarget: 'Giờ chọn thành phần đích.',
  };

  test('prioritizes validation error notice even while connecting mode is active', () => {
    expect(
      resolveDiagramHint(
        true,
        null,
        'Không thể nối thành phần với chính nó.',
        strings
      )
    ).toBe('Không thể nối thành phần với chính nó.');
  });

  test('shows pick-target prompt when connecting with a source selected and no error', () => {
    expect(resolveDiagramHint(true, 'api', null, strings)).toBe(
      strings.connectPickTarget
    );
  });

  test('shows initial connect prompt when connecting without source or error', () => {
    expect(resolveDiagramHint(true, null, null, strings)).toBe(
      strings.connectHint
    );
  });

  test('returns null when idle with no notice', () => {
    expect(resolveDiagramHint(false, null, null, strings)).toBeNull();
  });
});

describe('resolveExportSvg', () => {
  test('finds svg.sd-svg in light DOM when shadowRoot is null', () => {
    const fakeSvg = { tagName: 'svg' } as unknown as SVGSVGElement;
    const fakeHost = {
      shadowRoot: null,
      querySelector: (selector: string) =>
        selector === 'svg.sd-svg' ? fakeSvg : null,
    } as unknown as SvgQueryHost;
    expect(resolveExportSvg(fakeHost)).toBe(fakeSvg);
  });
});

describe('syncDocTitle', () => {
  test('updates both root page Y.Text title and workspace docMeta title', () => {
    const replace = vi.fn();
    const setDocMeta = vi.fn();
    const store = {
      id: 'doc-123',
      root: {
        title: {
          length: 14,
          replace,
        },
      },
      doc: {
        id: 'doc-123',
        collection: {
          meta: { setDocMeta },
        },
      },
      meta: { title: 'Sơ đồ hệ thống' },
    };

    syncDocTitle(store, 'Kiến trúc 3-Tier AWS');

    expect(replace).toHaveBeenCalledWith(0, 14, 'Kiến trúc 3-Tier AWS');
    expect(setDocMeta).toHaveBeenCalledWith('doc-123', {
      title: 'Kiến trúc 3-Tier AWS',
    });
    expect(store.meta.title).toBe('Kiến trúc 3-Tier AWS');
  });

  test('updates BlockSuite 0.27 store.root.props.title Y.Text so H1 heading and reopen persist', () => {
    const replace = vi.fn();
    const setDocMeta = vi.fn();
    const store = {
      id: 'doc-456',
      root: {
        props: {
          title: {
            length: 14,
            replace,
          },
        },
      },
      doc: {
        id: 'doc-456',
        collection: {
          meta: { setDocMeta },
        },
      },
    };

    syncDocTitle(store, '🌐 Web 3-Tier Chuẩn Offshore (AWS)');

    expect(replace).toHaveBeenCalledWith(
      0,
      14,
      '🌐 Web 3-Tier Chuẩn Offshore (AWS)'
    );
    expect(setDocMeta).toHaveBeenCalledWith('doc-456', {
      title: '🌐 Web 3-Tier Chuẩn Offshore (AWS)',
    });
  });
});

describe('shouldAutoSyncDiagramTitle', () => {
  test('returns true when legacy doc has generic title but diagram block has a custom title', () => {
    expect(
      shouldAutoSyncDiagramTitle(
        '🤖 Hệ thống AI Doanh nghiệp (RAG & LLM)',
        'Sơ đồ hệ thống'
      )
    ).toBe(true);
    expect(shouldAutoSyncDiagramTitle('Kiến trúc AWS', '')).toBe(true);
    expect(shouldAutoSyncDiagramTitle('Kiến trúc AWS', 'Untitled')).toBe(true);
  });

  test('returns false when block title is empty/generic or doc already has a custom title', () => {
    expect(shouldAutoSyncDiagramTitle('Sơ đồ hệ thống', 'Sơ đồ hệ thống')).toBe(
      false
    );
    expect(shouldAutoSyncDiagramTitle('', 'Sơ đồ hệ thống')).toBe(false);
    expect(
      shouldAutoSyncDiagramTitle('Tên trong khối', 'Tên tài liệu tùy chỉnh')
    ).toBe(false);
  });
});
