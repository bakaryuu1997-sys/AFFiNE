import { Button, Checkbox, IconButton, Input, Modal } from '@affine/component';
import { DocsService } from '@affine/core/modules/doc';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { CollaborationIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { memo, useCallback, useMemo, useState } from 'react';

import {
  buildKnowledgeGraphData,
  type DocReferenceItem,
  type RawDocItem,
} from './graph-builder';

export const KnowledgeGraphButton = memo(function KnowledgeGraphButton() {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hideSamples, setHideSamples] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const docsService = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;
  const docs = useLiveData(docsService.list.docs$);

  // Extract real cross-doc links from block collections
  const references = useMemo<DocReferenceItem[]>(() => {
    if (!docs || docs.length === 0) return [];
    const docCollection = (docsService.list as any).docCollection;
    const refs: DocReferenceItem[] = [];
    const seen = new Set<string>();

    for (const docRecord of docs) {
      if (docRecord.trash$.value) continue;
      const sourceId = docRecord.id;
      const bsDoc = docCollection?.getDoc
        ? docCollection.getDoc(sourceId)
        : null;
      if (!bsDoc) continue;

      const blocks = bsDoc.getBlocks ? bsDoc.getBlocks() : [];
      for (const b of blocks) {
        // affine:reference block or embed-linked-doc block
        const targetId =
          b.model?.pageId ||
          b.model?.refDocId ||
          (b.model?.referenceInfo && b.model.referenceInfo.pageId);

        if (typeof targetId === 'string' && targetId && targetId !== sourceId) {
          const key = `${sourceId}->${targetId}`;
          if (!seen.has(key)) {
            seen.add(key);
            refs.push({ sourceId, targetId });
          }
        }
      }
    }
    return refs;
  }, [docs, docsService.list]);

  const rawDocs = useMemo<RawDocItem[]>(() => {
    if (!docs) return [];
    return docs.map(d => ({
      id: d.id,
      title: d.title$.value || '',
      isTrash: Boolean(d.trash$.value),
    }));
  }, [docs]);

  const graphData = useMemo(() => {
    return buildKnowledgeGraphData({
      docs: rawDocs,
      hideSamples,
      references,
      width: 740,
      height: 480,
    });
  }, [rawDocs, hideSamples, references]);

  // Connected nodes map for hover highlighting
  const neighborIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const set = new Set<string>([hoveredNodeId]);
    for (const edge of graphData.edges) {
      if (edge.sourceId === hoveredNodeId) set.add(edge.targetId);
      if (edge.targetId === hoveredNodeId) set.add(edge.sourceId);
    }
    return set;
  }, [hoveredNodeId, graphData.edges]);

  const handleOpenDoc = useCallback(
    (docId: string) => {
      workbench.openDoc(docId);
      setOpen(false);
    },
    [workbench]
  );

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return graphData.nodes;
    return graphData.nodes.filter(n => n.title.toLowerCase().includes(q));
  }, [graphData.nodes, searchQuery]);

  const matchedIdSet = useMemo(() => {
    return new Set(filteredNodes.map(n => n.id));
  }, [filteredNodes]);

  return (
    <>
      <IconButton
        tooltip="Bản đồ Mạng lưới Tri thức (Knowledge Graph)"
        aria-label="Bản đồ Mạng lưới Tri thức"
        onClick={() => setOpen(true)}
        style={{
          color: 'var(--affine-primary-color, #1e96eb)',
          marginRight: '6px',
        }}
      >
        <CollaborationIcon />
      </IconButton>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="🌐 Bản đồ Mạng lưới Tri thức (Knowledge Graph)"
        width={820}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Header Controls: Filters, search, zoom */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '13px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <Checkbox
                  checked={hideSamples}
                  onChange={() => setHideSamples(v => !v)}
                />
                <span>Ẩn tài liệu mẫu hệ thống</span>
              </label>

              <span
                style={{
                  color: 'var(--affine-text-secondary-color, #888)',
                  fontSize: '12px',
                }}
              >
                {graphData.totalDocs} tài liệu · {graphData.edges.length} liên
                kết thực tế
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Input
                placeholder="Tìm tài liệu..."
                value={searchQuery}
                onChange={setSearchQuery}
                style={{ width: '150px', height: '28px', fontSize: '12px' }}
              />

              <div style={{ display: 'flex', gap: '2px' }}>
                <Button
                  size="small"
                  onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
                >
                  -
                </Button>
                <Button size="small" onClick={() => setZoom(1)}>
                  100%
                </Button>
                <Button
                  size="small"
                  onClick={() => setZoom(z => Math.min(2.0, z + 0.2))}
                >
                  +
                </Button>
              </div>
            </div>
          </div>

          {/* SVG Graph Canvas */}
          <div
            style={{
              width: '100%',
              height: '500px',
              background: 'var(--affine-background-primary-color, #121316)',
              borderRadius: '12px',
              border: '1px solid var(--affine-border-color, #2b2c30)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${740 / zoom} ${480 / zoom}`}
              style={{ display: 'block' }}
            >
              <defs>
                <linearGradient
                  id="kg-edge-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#1e96eb" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
                </linearGradient>
                <radialGradient id="kg-hub-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1e96eb" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#1e96eb" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Real Edges between docs */}
              {graphData.edges.map(e => {
                const isHighlighted =
                  neighborIds &&
                  neighborIds.has(e.sourceId) &&
                  neighborIds.has(e.targetId);

                const opacity = neighborIds
                  ? isHighlighted
                    ? 0.9
                    : 0.08
                  : 0.45;
                const strokeWidth = isHighlighted ? 2.2 : 1.2;

                return (
                  <line
                    key={e.id}
                    x1={e.sourceX}
                    y1={e.sourceY}
                    x2={e.targetX}
                    y2={e.targetY}
                    stroke={
                      isHighlighted ? '#1e96eb' : 'rgba(100, 150, 220, 0.4)'
                    }
                    strokeWidth={strokeWidth}
                    strokeOpacity={opacity}
                    strokeDasharray={isHighlighted ? undefined : '3 2'}
                  />
                );
              })}

              {/* Document Nodes */}
              {graphData.nodes.map(n => {
                const isHovered = n.id === hoveredNodeId;
                const isNeighbor = neighborIds && neighborIds.has(n.id);
                const isMatch = matchedIdSet.has(n.id);

                const opacity =
                  searchQuery && !isMatch
                    ? 0.2
                    : neighborIds
                      ? isNeighbor
                        ? 1
                        : 0.25
                      : 1;

                const hasLinks = n.degree > 0;
                const fillColor = hasLinks
                  ? 'var(--affine-primary-color, #1e96eb)'
                  : 'var(--affine-border-color, #444)';

                return (
                  <g
                    key={n.id}
                    opacity={opacity}
                    onMouseEnter={() => setHoveredNodeId(n.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => handleOpenDoc(n.id)}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                  >
                    {/* Hub glow for linked docs */}
                    {hasLinks && (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={n.radius + 8}
                        fill="url(#kg-hub-glow)"
                      />
                    )}

                    {/* Node circle */}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={isHovered ? n.radius + 3 : n.radius}
                      fill={
                        isHovered
                          ? '#2563eb'
                          : 'var(--affine-background-secondary-color, #1e2025)'
                      }
                      stroke={fillColor}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />

                    {/* Node Icon / Degree Badge */}
                    <text
                      x={n.x}
                      y={n.y + 3.5}
                      textAnchor="middle"
                      fill={hasLinks ? '#38bdf8' : '#aaa'}
                      fontSize={hasLinks ? '10' : '9'}
                      fontWeight="bold"
                    >
                      {n.degree > 0 ? n.degree : '·'}
                    </text>

                    {/* Node Label */}
                    <text
                      x={n.x}
                      y={n.y + n.radius + 14}
                      textAnchor="middle"
                      fill={
                        isHovered
                          ? '#ffffff'
                          : 'var(--affine-text-primary-color, #e0e0e0)'
                      }
                      fontSize="10.5"
                      fontWeight={isHovered || hasLinks ? '600' : '400'}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {n.title.length > 20
                        ? n.title.slice(0, 20) + '…'
                        : n.title}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </Modal>
    </>
  );
});
