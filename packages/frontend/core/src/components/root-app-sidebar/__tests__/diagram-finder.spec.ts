import { describe, expect, it } from 'vitest';

import { findLatestDiagramDoc } from '../diagram-finder';

describe('findLatestDiagramDoc', () => {
  it('prefers lastOpenedId when the doc exists and is not trashed', () => {
    const docs = [
      {
        id: 'doc-1',
        trash$: { value: false },
        title$: { value: '🌐 Web 3-Tier Chuẩn Offshore (AWS)' },
        updatedAt$: { value: 100 },
      },
      {
        id: 'doc-2',
        trash$: { value: false },
        title$: { value: '🤖 Hệ thống AI Doanh nghiệp' },
        updatedAt$: { value: 200 },
      },
    ];
    const result = findLatestDiagramDoc(docs, 'doc-1');
    expect(result).toBe('doc-1');
  });

  it('falls back to the most recently updated diagram if lastOpenedId is trashed', () => {
    const docs = [
      {
        id: 'doc-1',
        trash$: { value: true },
        title$: { value: '🌐 Web 3-Tier Chuẩn Offshore (AWS)' },
        updatedAt$: { value: 300 },
      },
      {
        id: 'doc-2',
        trash$: { value: false },
        title$: { value: '🤖 Hệ thống AI Doanh nghiệp' },
        updatedAt$: { value: 200 },
      },
      {
        id: 'doc-3',
        trash$: { value: false },
        title$: { value: 'Tài liệu ghi chú thường' },
        updatedAt$: { value: 250 },
      },
    ];
    const result = findLatestDiagramDoc(docs, 'doc-1');
    expect(result).toBe('doc-2');
  });

  it('finds diagrams with dynamic renamed titles (e.g. cloud/microservices icons)', () => {
    const docs = [
      {
        id: 'doc-old',
        trash$: { value: false },
        title$: { value: 'Sơ đồ hệ thống' },
        updatedAt$: { value: 50 },
      },
      {
        id: 'doc-renamed',
        trash$: { value: false },
        title$: { value: '⚡ Kiến trúc Microservices & K8s' },
        updatedAt$: { value: 500 },
      },
    ];
    const result = findLatestDiagramDoc(docs, null);
    expect(result).toBe('doc-renamed');
  });

  it('recognizes explicit customProperty isDiagram=true', () => {
    const docs = [
      {
        id: 'doc-custom',
        trash$: { value: false },
        title$: { value: 'Kiến trúc thanh toán bảo mật' },
        updatedAt$: { value: 150 },
        customProperty$: (k: string) => ({
          value: k === 'isDiagram' ? 'true' : null,
        }),
      },
      {
        id: 'doc-other',
        trash$: { value: false },
        title$: { value: 'Ghi chú họp' },
        updatedAt$: { value: 200 },
      },
    ];
    const result = findLatestDiagramDoc(docs, null);
    expect(result).toBe('doc-custom');
  });

  it('returns null when no diagram doc exists in workspace', () => {
    const docs = [
      {
        id: 'doc-1',
        trash$: { value: false },
        title$: { value: 'Ghi chú ngày 15' },
        updatedAt$: { value: 100 },
      },
      {
        id: 'doc-2',
        trash$: { value: false },
        title$: { value: 'Kế hoạch tuần' },
        updatedAt$: { value: 200 },
      },
    ];
    const result = findLatestDiagramDoc(docs, null);
    expect(result).toBe(null);
  });
});
