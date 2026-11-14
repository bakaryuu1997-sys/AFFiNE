import { Button, IconButton, Modal } from '@affine/component';
import { DocsService } from '@affine/core/modules/doc';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { CollaborationIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { memo, useCallback, useMemo, useState } from 'react';

export const KnowledgeGraphButton = memo(function KnowledgeGraphButton() {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const docsService = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;
  const docs = useLiveData(docsService.list.docs$);

  const graphData = useMemo(() => {
    if (!docs || docs.length === 0) return { nodes: [], edges: [] };

    const centerX = 360;
    const centerY = 240;
    const radius = 170;

    const nodes = docs.map((doc, idx) => {
      const angle = (idx / docs.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      const title = doc.title || 'Chưa đặt tên';
      return {
        id: doc.id,
        title,
        x,
        y,
      };
    });

    const edges = nodes.map(n => ({
      fromX: centerX,
      fromY: centerY,
      toX: n.x,
      toY: n.y,
    }));

    return { nodes, edges, centerX, centerY };
  }, [docs]);

  const handleOpenDoc = useCallback(
    (docId: string) => {
      workbench.openDoc(docId);
      setOpen(false);
    },
    [workbench]
  );

  return (
    <>
      <IconButton
        tooltip="Bản đồ Tri thức 2D (Graph View)"
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
        width={780}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                color: 'var(--affine-text-secondary-color)',
              }}
            >
              Tổng số {docs.length} tài liệu trong không gian làm việc. Nhấp vào
              nút để mở nhanh.
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
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

          <div
            style={{
              width: '100%',
              height: '480px',
              background: 'var(--affine-background-primary-color, #141416)',
              borderRadius: '10px',
              border: '1px solid var(--affine-border-color, #333)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${720 / zoom} ${480 / zoom}`}
              style={{ display: 'block' }}
            >
              <defs>
                <radialGradient id="kg-center-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1e96eb" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#1e96eb" stopOpacity="0.2" />
                </radialGradient>
              </defs>

              {/* Edges from center to docs */}
              {graphData.edges.map((e, idx) => (
                <line
                  key={`edge-${idx}`}
                  x1={e.fromX}
                  y1={e.fromY}
                  x2={e.toX}
                  y2={e.toY}
                  stroke="rgba(30, 150, 235, 0.25)"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              ))}

              {/* Center workspace node */}
              <circle
                cx={graphData.centerX}
                cy={graphData.centerY}
                r="32"
                fill="url(#kg-center-grad)"
                stroke="#1e96eb"
                strokeWidth="2"
              />
              <text
                x={graphData.centerX}
                y={graphData.centerY + 4}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="bold"
              >
                Không gian
              </text>

              {/* Document Nodes */}
              {graphData.nodes.map(n => (
                <g
                  key={n.id}
                  onClick={() => handleOpenDoc(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r="18"
                    fill="var(--affine-hover-color, #2a2a2e)"
                    stroke="var(--affine-primary-color, #1e96eb)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    fill="#1e96eb"
                    fontSize="10"
                    fontWeight="600"
                  >
                    📄
                  </text>
                  <text
                    x={n.x}
                    y={n.y + 32}
                    textAnchor="middle"
                    fill="var(--affine-text-primary-color, #eee)"
                    fontSize="11"
                    fontWeight="500"
                    style={{ pointerEvents: 'none' }}
                  >
                    {n.title.length > 18
                      ? n.title.slice(0, 18) + '...'
                      : n.title}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </Modal>
    </>
  );
});
