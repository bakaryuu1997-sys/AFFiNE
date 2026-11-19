export interface RawDocItem {
  id: string;
  title: string;
  isTrash: boolean;
}

export interface DocReferenceItem {
  sourceId: string;
  targetId: string;
}

export interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  radius: number;
  degree: number;
  isSample: boolean;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  totalDocs: number;
  connectedDocs: number;
}

const SAMPLE_DOC_INDICATORS = [
  'getting started',
  'bắt đầu sử dụng',
  'write, draw, plan with affine',
  'how to use folder and tags in affine',
  "affine's edge",
  'workspace overview',
  'welcome to affine',
  'はじめる',
];

export function isSampleDoc(title?: string | null): boolean {
  if (!title) return false;
  const lower = title.trim().toLowerCase();
  return SAMPLE_DOC_INDICATORS.some(indicator => lower.includes(indicator));
}

export function buildKnowledgeGraphData(options: {
  docs: RawDocItem[];
  hideSamples: boolean;
  references: DocReferenceItem[];
  width?: number;
  height?: number;
}): KnowledgeGraphData {
  const width = options.width ?? 720;
  const height = options.height ?? 460;
  const centerX = width / 2;
  const centerY = height / 2;

  // 1. Filter out trash and optional sample docs
  const filtered = options.docs.filter(d => {
    if (d.isTrash) return false;
    if (options.hideSamples && isSampleDoc(d.title)) return false;
    return true;
  });

  const validDocIdSet = new Set(filtered.map(d => d.id));

  // 2. Filter valid references between remaining docs
  const validRefs = options.references.filter(
    r =>
      r.sourceId !== r.targetId &&
      validDocIdSet.has(r.sourceId) &&
      validDocIdSet.has(r.targetId)
  );

  // 3. Calculate degrees for each node
  const degreeMap = new Map<string, number>();
  filtered.forEach(d => degreeMap.set(d.id, 0));

  validRefs.forEach(r => {
    degreeMap.set(r.sourceId, (degreeMap.get(r.sourceId) ?? 0) + 1);
    degreeMap.set(r.targetId, (degreeMap.get(r.targetId) ?? 0) + 1);
  });

  // 4. Position calculation:
  // Nodes with connections are clustered towards the center;
  // isolated nodes orbit evenly around the outer circle.
  const connectedNodes: RawDocItem[] = [];
  const isolatedNodes: RawDocItem[] = [];

  filtered.forEach(d => {
    const deg = degreeMap.get(d.id) ?? 0;
    if (deg > 0) {
      connectedNodes.push(d);
    } else {
      isolatedNodes.push(d);
    }
  });

  const nodeMap = new Map<string, GraphNode>();

  // Layout connected nodes in an inner cluster with slight jitter
  const innerRadius = Math.min(width, height) * 0.28;
  connectedNodes.forEach((doc, idx) => {
    const angle = (idx / Math.max(1, connectedNodes.length)) * 2 * Math.PI;
    const deg = degreeMap.get(doc.id) ?? 0;
    // higher degree nodes gravitate slightly closer to center
    const dist = innerRadius * (0.6 + 0.4 * Math.max(0, 1 - deg * 0.1));
    const x = Math.round(centerX + dist * Math.cos(angle));
    const y = Math.round(centerY + dist * Math.sin(angle));
    const radius = Math.min(26, Math.max(16, 16 + deg * 2.5));

    const node: GraphNode = {
      id: doc.id,
      title: doc.title || 'Chưa đặt tên',
      x,
      y,
      radius,
      degree: deg,
      isSample: isSampleDoc(doc.title),
    };
    nodeMap.set(doc.id, node);
  });

  // Layout isolated nodes along an outer ring
  const outerRadius = Math.min(width, height) * 0.42;
  isolatedNodes.forEach((doc, idx) => {
    const angle =
      (idx / Math.max(1, isolatedNodes.length)) * 2 * Math.PI +
      (connectedNodes.length ? 0.35 : 0);
    const x = Math.round(centerX + outerRadius * Math.cos(angle));
    const y = Math.round(centerY + outerRadius * Math.sin(angle));

    const node: GraphNode = {
      id: doc.id,
      title: doc.title || 'Chưa đặt tên',
      x,
      y,
      radius: 14,
      degree: 0,
      isSample: isSampleDoc(doc.title),
    };
    nodeMap.set(doc.id, node);
  });

  const nodes = filtered
    .map(d => nodeMap.get(d.id))
    .filter((n): n is GraphNode => Boolean(n));

  // 5. Build edge lines
  const edges: GraphEdge[] = [];
  for (let idx = 0; idx < validRefs.length; idx++) {
    const r = validRefs[idx];
    const src = nodeMap.get(r.sourceId);
    const tgt = nodeMap.get(r.targetId);
    if (!src || !tgt) continue;

    edges.push({
      id: `edge-${idx}-${r.sourceId}-${r.targetId}`,
      sourceId: r.sourceId,
      targetId: r.targetId,
      sourceX: src.x,
      sourceY: src.y,
      targetX: tgt.x,
      targetY: tgt.y,
    });
  }

  return {
    nodes,
    edges,
    width,
    height,
    totalDocs: filtered.length,
    connectedDocs: connectedNodes.length,
  };
}
