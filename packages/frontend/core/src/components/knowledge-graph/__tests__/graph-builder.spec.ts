import { describe, expect, it } from 'vitest';

import { buildKnowledgeGraphData, isSampleDoc } from '../graph-builder';

describe('Knowledge Graph Data Builder', () => {
  it('correctly identifies default sample documents', () => {
    expect(isSampleDoc('Getting Started')).toBe(true);
    expect(isSampleDoc('Write, Draw, Plan with AFFiNE')).toBe(true);
    expect(isSampleDoc('How to use folder and Tags in AFFiNE')).toBe(true);
    expect(isSampleDoc("AFFiNE's Edge")).toBe(true);
    expect(isSampleDoc('Bắt đầu sử dụng AFFiNE')).toBe(true);
    expect(isSampleDoc('Tài liệu thiết kế hệ thống')).toBe(false);
    expect(isSampleDoc('Kế hoạch Sprint 4')).toBe(false);
  });

  it('filters out trash and sample docs when hideSamples is true', () => {
    const rawDocs = [
      { id: '1', title: 'Getting Started', isTrash: false },
      { id: '2', title: 'Write, Draw, Plan with AFFiNE', isTrash: false },
      { id: '3', title: 'Dự án Backend API', isTrash: false },
      { id: '4', title: 'Tài liệu bị xóa', isTrash: true },
    ];

    const graph = buildKnowledgeGraphData({
      docs: rawDocs,
      hideSamples: true,
      references: [],
    });

    expect(graph.nodes.map(n => n.id)).toEqual(['3']);
  });

  it('includes sample docs when hideSamples is false', () => {
    const rawDocs = [
      { id: '1', title: 'Getting Started', isTrash: false },
      { id: '2', title: 'Dự án Backend API', isTrash: false },
      { id: '3', title: 'Tài liệu bị xóa', isTrash: true },
    ];

    const graph = buildKnowledgeGraphData({
      docs: rawDocs,
      hideSamples: false,
      references: [],
    });

    expect(graph.nodes.map(n => n.id)).toEqual(['1', '2']);
  });

  it('builds real edges between referenced docs and calculates degree', () => {
    const rawDocs = [
      { id: 'doc-a', title: 'Kiến trúc Core', isTrash: false },
      { id: 'doc-b', title: 'Module Auth & JWT', isTrash: false },
      { id: 'doc-c', title: 'Ghi chú độc lập', isTrash: false },
    ];

    const references = [
      { sourceId: 'doc-a', targetId: 'doc-b' }, // doc-a cites doc-b
    ];

    const graph = buildKnowledgeGraphData({
      docs: rawDocs,
      hideSamples: false,
      references,
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      sourceId: 'doc-a',
      targetId: 'doc-b',
    });

    const nodeA = graph.nodes.find(n => n.id === 'doc-a');
    const nodeB = graph.nodes.find(n => n.id === 'doc-b');
    const nodeC = graph.nodes.find(n => n.id === 'doc-c');

    expect(nodeA?.degree).toBe(1);
    expect(nodeB?.degree).toBe(1);
    expect(nodeC?.degree).toBe(0);
  });
});
