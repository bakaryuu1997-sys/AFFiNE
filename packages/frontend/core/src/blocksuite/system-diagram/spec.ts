/**
 * Data model of the system-design diagram block. The whole diagram is one
 * plain JSON value (DiagramSpec) so people, the renderer, the simulator and AI
 * agents (through MCP) all work on the same thing.
 */

export const NODE_TYPES = [
  'client',
  'dns',
  'cdn',
  'load-balancer',
  'api',
  'cache',
  'database',
  'queue',
  'worker',
  'storage',
  'search',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const TRAFFIC_PROFILES = ['constant', 'ramp', 'spike'] as const;
export type TrafficProfile = (typeof TRAFFIC_PROFILES)[number];

export interface DiagramNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  /** identical instances behind this node */
  replicas: number;
  /** requests per second one instance can serve */
  capacityRps: number;
  /** time one instance needs per request when idle */
  latencyMs: number;
  /** cache and cdn only: share of requests answered without going further */
  hitRatio?: number;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  /** share of the traffic leaving `from` that takes this edge */
  weight: number;
  label?: string;
}

export interface DiagramTraffic {
  /** requests per second produced by every client node together */
  rps: number;
  profile: TrafficProfile;
  /** length of one simulated run */
  durationSec: number;
}

export interface DiagramSpec {
  version: 1;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  traffic: DiagramTraffic;
}

interface TypeDefaults {
  label: string;
  capacityRps: number;
  latencyMs: number;
  hitRatio?: number;
}

export const TYPE_DEFAULTS: Record<NodeType, TypeDefaults> = {
  client: { label: 'Người dùng', capacityRps: 1e9, latencyMs: 0 },
  dns: { label: 'DNS', capacityRps: 50_000, latencyMs: 5 },
  cdn: { label: 'CDN', capacityRps: 20_000, latencyMs: 10, hitRatio: 0.85 },
  'load-balancer': { label: 'Cân bằng tải', capacityRps: 30_000, latencyMs: 1 },
  api: { label: 'API', capacityRps: 1000, latencyMs: 20 },
  cache: { label: 'Cache', capacityRps: 50_000, latencyMs: 1, hitRatio: 0.8 },
  database: { label: 'Cơ sở dữ liệu', capacityRps: 800, latencyMs: 8 },
  queue: { label: 'Hàng đợi', capacityRps: 20_000, latencyMs: 2 },
  worker: { label: 'Worker', capacityRps: 300, latencyMs: 50 },
  storage: { label: 'Lưu trữ tệp', capacityRps: 5000, latencyMs: 15 },
  search: { label: 'Tìm kiếm', capacityRps: 1500, latencyMs: 12 },
};

export const LIMITS = {
  maxNodes: 60,
  maxEdges: 200,
  maxRps: 10_000_000,
  maxReplicas: 1000,
  maxDurationSec: 600,
} as const;

export function defaultNode(
  type: NodeType,
  partial: Partial<DiagramNode> & { id: string }
): DiagramNode {
  const d = TYPE_DEFAULTS[type];
  return {
    type,
    label: d.label,
    x: 0,
    y: 0,
    replicas: 1,
    capacityRps: d.capacityRps,
    latencyMs: d.latencyMs,
    ...(d.hitRatio !== undefined ? { hitRatio: d.hitRatio } : {}),
    ...partial,
  };
}

export function createEmptySpec(): DiagramSpec {
  return {
    version: 1,
    nodes: [],
    edges: [],
    traffic: { rps: 1000, profile: 'constant', durationSec: 60 },
  };
}

/** Words the sample diagram is labelled with, in the language being shown. */
export interface SampleNames {
  label(type: NodeType): string;
  read: string;
  write: string;
}

function makeNode(
  names: SampleNames | undefined,
  id: string,
  type: NodeType,
  x: number,
  y: number,
  extra: Partial<DiagramNode> = {}
): DiagramNode {
  return defaultNode(type, {
    id,
    x,
    y,
    ...(names ? { label: names.label(type) } : {}),
    ...extra,
  });
}

/** A small but realistic starting point: web tier, cache and database. */
export function createSampleSpec(names?: SampleNames): DiagramSpec {
  const n = (
    id: string,
    type: NodeType,
    x: number,
    y: number,
    extra?: Partial<DiagramNode>
  ) => makeNode(names, id, type, x, y, extra);
  return {
    version: 1,
    traffic: { rps: 1500, profile: 'ramp', durationSec: 60 },
    nodes: [
      n('users', 'client', 80, 220),
      n('lb', 'load-balancer', 260, 220),
      n('api', 'api', 460, 220, { replicas: 2, label: 'API' }),
      n('cache', 'cache', 660, 120),
      n('db', 'database', 660, 320, { label: 'PostgreSQL' }),
    ],
    edges: [
      { id: 'e1', from: 'users', to: 'lb', weight: 1 },
      { id: 'e2', from: 'lb', to: 'api', weight: 1 },
      {
        id: 'e3',
        from: 'api',
        to: 'cache',
        weight: 0.7,
        label: names?.read ?? 'đọc',
      },
      {
        id: 'e4',
        from: 'api',
        to: 'db',
        weight: 0.3,
        label: names?.write ?? 'ghi',
      },
      { id: 'e5', from: 'cache', to: 'db', weight: 1 },
    ],
  };
}

/** Complete full-stack system architecture with all 11 component types. */
export function createFullSampleSpec(names?: SampleNames): DiagramSpec {
  const n = (
    id: string,
    type: NodeType,
    x: number,
    y: number,
    extra?: Partial<DiagramNode>
  ) => makeNode(names, id, type, x, y, extra);
  return {
    version: 1,
    traffic: { rps: 2000, profile: 'ramp', durationSec: 60 },
    nodes: [
      n('users', 'client', 80, 220),
      n('dns', 'dns', 260, 100),
      n('cdn', 'cdn', 260, 340),
      n('lb', 'load-balancer', 440, 220),
      n('api', 'api', 620, 220, { replicas: 3, label: 'API' }),
      n('cache', 'cache', 800, 100, { label: 'Cache' }),
      n('db', 'database', 800, 220, { label: 'PostgreSQL' }),
      n('search', 'search', 800, 340),
      n('queue', 'queue', 620, 380),
      n('worker', 'worker', 800, 460, { replicas: 2 }),
      n('storage', 'storage', 980, 340),
    ],
    edges: [
      { id: 'e_dns', from: 'users', to: 'dns', weight: 0.1, label: 'DNS' },
      { id: 'e_cdn', from: 'users', to: 'cdn', weight: 0.3, label: 'tĩnh' },
      { id: 'e_lb', from: 'users', to: 'lb', weight: 0.6, label: 'API' },
      { id: 'e_api', from: 'lb', to: 'api', weight: 1 },
      {
        id: 'e_cache',
        from: 'api',
        to: 'cache',
        weight: 0.45,
        label: names?.read ?? 'đọc',
      },
      { id: 'e_cache_miss', from: 'cache', to: 'db', weight: 0.2 },
      {
        id: 'e_db',
        from: 'api',
        to: 'db',
        weight: 0.25,
        label: names?.write ?? 'ghi',
      },
      { id: 'e_search', from: 'api', to: 'search', weight: 0.15 },
      { id: 'e_queue', from: 'api', to: 'queue', weight: 0.15 },
      { id: 'e_worker', from: 'queue', to: 'worker', weight: 1 },
      { id: 'e_worker_db', from: 'worker', to: 'db', weight: 0.5 },
      { id: 'e_worker_storage', from: 'worker', to: 'storage', weight: 0.5 },
      { id: 'e_cdn_storage', from: 'cdn', to: 'storage', weight: 0.15 },
    ],
  };
}

/** 1. Mẫu Kiến trúc Web 3-Tier Chuẩn Offshore (AWS/Cloud Production) */
export function createOffshore3TierSpec(names?: SampleNames): DiagramSpec {
  const n = (
    id: string,
    type: NodeType,
    x: number,
    y: number,
    extra?: Partial<DiagramNode>
  ) => makeNode(names, id, type, x, y, extra);
  return {
    version: 1,
    traffic: { rps: 3000, profile: 'ramp', durationSec: 60 },
    nodes: [
      n('users', 'client', 80, 220, { label: 'Người dùng Web/App' }),
      n('route53', 'dns', 260, 100, { label: 'AWS Route 53' }),
      n('cf', 'cdn', 260, 340, { label: 'Cloudflare WAF/CDN' }),
      n('alb', 'load-balancer', 440, 220, { label: 'AWS ALB' }),
      n('ec2', 'api', 620, 220, { replicas: 3, label: 'Cụm Web/API (Auto Scaling)' }),
      n('elasticache', 'cache', 820, 100, { label: 'Redis ElastiCache' }),
      n('aurora_master', 'database', 820, 220, { label: 'Aurora MySQL Master' }),
      n('aurora_replica', 'database', 820, 340, { label: 'Aurora Read Replica' }),
      n('s3', 'storage', 1020, 340, { label: 'AWS S3 Storage' }),
      n('cloudwatch', 'search', 1020, 220, { label: 'CloudWatch & Grafana' }),
    ],
    edges: [
      { id: 'e_r53', from: 'users', to: 'route53', weight: 0.08, label: 'DNS' },
      { id: 'e_cf', from: 'users', to: 'cf', weight: 0.35, label: 'Static/WAF' },
      { id: 'e_alb', from: 'users', to: 'alb', weight: 0.57, label: 'HTTPS API' },
      { id: 'e_api', from: 'alb', to: 'ec2', weight: 1 },
      { id: 'e_cache', from: 'ec2', to: 'elasticache', weight: 0.5, label: 'Cache hit' },
      { id: 'e_master', from: 'ec2', to: 'aurora_master', weight: 0.25, label: 'Write' },
      { id: 'e_replica', from: 'ec2', to: 'aurora_replica', weight: 0.25, label: 'Read' },
      { id: 'e_sync', from: 'aurora_master', to: 'aurora_replica', weight: 0.3, label: 'Sync' },
      { id: 'e_cf_s3', from: 'cf', to: 's3', weight: 0.15 },
      { id: 'e_api_s3', from: 'ec2', to: 's3', weight: 0.1, label: 'Upload' },
      { id: 'e_logs', from: 'ec2', to: 'cloudwatch', weight: 0.15, label: 'Logs' },
    ],
  };
}

/** 2. Mẫu Kiến trúc Microservices & Xử lý Sự kiện (Kafka Streaming) */
export function createOffshoreMicroservicesSpec(names?: SampleNames): DiagramSpec {
  const n = (
    id: string,
    type: NodeType,
    x: number,
    y: number,
    extra?: Partial<DiagramNode>
  ) => makeNode(names, id, type, x, y, extra);
  return {
    version: 1,
    traffic: { rps: 4500, profile: 'spike', durationSec: 60 },
    nodes: [
      n('users', 'client', 60, 240, { label: 'Khách hàng (Web/Mobile)' }),
      n('kong', 'load-balancer', 240, 240, { label: 'Kong API Gateway' }),
      n('auth_svc', 'api', 440, 100, { label: 'Auth Service' }),
      n('order_svc', 'api', 440, 240, { replicas: 2, label: 'Order Service' }),
      n('payment_svc', 'api', 440, 380, { label: 'Payment Service' }),
      n('kafka', 'queue', 660, 240, { label: 'Kafka Event Bus' }),
      n('notify_worker', 'worker', 860, 160, { label: 'Notification Worker' }),
      n('analytics_worker', 'worker', 860, 320, { label: 'Analytics Worker' }),
      n('order_db', 'database', 660, 380, { label: 'PostgreSQL (Order)' }),
      n('user_db', 'database', 660, 100, { label: 'PostgreSQL (User)' }),
      n('es', 'search', 860, 440, { label: 'Elasticsearch Log/Order' }),
    ],
    edges: [
      { id: 'e_gw', from: 'users', to: 'kong', weight: 1 },
      { id: 'e_auth', from: 'kong', to: 'auth_svc', weight: 0.2 },
      { id: 'e_order', from: 'kong', to: 'order_svc', weight: 0.6 },
      { id: 'e_pay', from: 'kong', to: 'payment_svc', weight: 0.2 },
      { id: 'e_auth_db', from: 'auth_svc', to: 'user_db', weight: 0.8 },
      { id: 'e_order_db', from: 'order_svc', to: 'order_db', weight: 0.5 },
      { id: 'e_order_kafka', from: 'order_svc', to: 'kafka', weight: 0.5, label: 'OrderCreated' },
      { id: 'e_pay_kafka', from: 'payment_svc', to: 'kafka', weight: 0.7, label: 'PaymentDone' },
      { id: 'e_k_notify', from: 'kafka', to: 'notify_worker', weight: 0.5 },
      { id: 'e_k_analytics', from: 'kafka', to: 'analytics_worker', weight: 0.5 },
      { id: 'e_es', from: 'analytics_worker', to: 'es', weight: 0.6 },
    ],
  };
}

/** 3. Mẫu Hệ thống Xử lý Tác vụ Nền & ETL Báo cáo Lớn (Batch Processing) */
export function createOffshoreBatchEtlSpec(names?: SampleNames): DiagramSpec {
  const n = (
    id: string,
    type: NodeType,
    x: number,
    y: number,
    extra?: Partial<DiagramNode>
  ) => makeNode(names, id, type, x, y, extra);
  return {
    version: 1,
    traffic: { rps: 2500, profile: 'constant', durationSec: 60 },
    nodes: [
      n('api', 'api', 80, 240, { replicas: 2, label: 'Core Backend API' }),
      n('celery_redis', 'cache', 260, 120, { label: 'Redis Broker & State' }),
      n('rabbitmq', 'queue', 260, 280, { label: 'RabbitMQ Task Queue' }),
      n('etl_worker', 'worker', 460, 160, { replicas: 2, label: 'ETL Data Worker' }),
      n('report_worker', 'worker', 460, 360, { replicas: 2, label: 'PDF/Excel Report Worker' }),
      n('oltp_db', 'database', 680, 140, { label: 'PostgreSQL (OLTP DB)' }),
      n('clickhouse', 'database', 680, 280, { label: 'ClickHouse (OLAP Data Warehouse)' }),
      n('s3_export', 'storage', 880, 280, { label: 'S3 Export Storage' }),
      n('ses', 'worker', 880, 400, { label: 'Amazon SES Email' }),
    ],
    edges: [
      { id: 'e_task', from: 'api', to: 'rabbitmq', weight: 0.7, label: 'Async Task' },
      { id: 'e_state', from: 'api', to: 'celery_redis', weight: 0.3 },
      { id: 'e_w1', from: 'rabbitmq', to: 'etl_worker', weight: 0.5 },
      { id: 'e_w2', from: 'rabbitmq', to: 'report_worker', weight: 0.5 },
      { id: 'e_w1_oltp', from: 'etl_worker', to: 'oltp_db', weight: 0.6, label: 'Extract' },
      { id: 'e_w1_ch', from: 'etl_worker', to: 'clickhouse', weight: 0.6, label: 'Transform & Load' },
      { id: 'e_w2_ch', from: 'report_worker', to: 'clickhouse', weight: 0.5, label: 'Aggregate Query' },
      { id: 'e_w2_s3', from: 'report_worker', to: 's3_export', weight: 0.4, label: 'Upload' },
      { id: 'e_w2_ses', from: 'report_worker', to: 'ses', weight: 0.3, label: 'Send Mail' },
    ],
  };
}

/** 4. Mẫu Hệ thống Ứng dụng AI Doanh nghiệp (RAG & LLM Pipeline) */
export function createOffshoreRagAiSpec(names?: SampleNames): DiagramSpec {
  const n = (
    id: string,
    type: NodeType,
    x: number,
    y: number,
    extra?: Partial<DiagramNode>
  ) => makeNode(names, id, type, x, y, extra);
  return {
    version: 1,
    traffic: { rps: 1800, profile: 'ramp', durationSec: 60 },
    nodes: [
      n('users', 'client', 80, 220, { label: 'Nhân sự Doanh nghiệp' }),
      n('nextjs', 'api', 260, 220, { label: 'Next.js Frontend App' }),
      n('fastapi', 'api', 440, 220, { label: 'FastAPI AI Gateway' }),
      n('redis_mem', 'cache', 440, 90, { label: 'Redis Session & Chat History' }),
      n('qdrant', 'search', 640, 100, { label: 'Qdrant Vector Database' }),
      n('llm', 'worker', 640, 220, { replicas: 2, label: 'Ollama / OpenAI Inference' }),
      n('doc_parser', 'worker', 640, 360, { label: 'Doc Parser & Embedding Worker' }),
      n('pg_meta', 'database', 840, 100, { label: 'PostgreSQL (Metastore)' }),
      n('s3_docs', 'storage', 840, 360, { label: 'MinIO / S3 Knowledge Vault' }),
    ],
    edges: [
      { id: 'e_ui', from: 'users', to: 'nextjs', weight: 1 },
      { id: 'e_gw', from: 'nextjs', to: 'fastapi', weight: 1 },
      { id: 'e_mem', from: 'fastapi', to: 'redis_mem', weight: 0.4, label: 'Session' },
      { id: 'e_vec', from: 'fastapi', to: 'qdrant', weight: 0.5, label: 'Semantic Search' },
      { id: 'e_llm', from: 'fastapi', to: 'llm', weight: 0.5, label: 'Prompt + Context' },
      { id: 'e_doc_s3', from: 'doc_parser', to: 's3_docs', weight: 0.5, label: 'Raw Docs' },
      { id: 'e_doc_vec', from: 'doc_parser', to: 'qdrant', weight: 0.5, label: 'Embeddings' },
      { id: 'e_q_meta', from: 'qdrant', to: 'pg_meta', weight: 0.3 },
    ],
  };
}

/** 5. Mẫu Kiến trúc Dự phòng Thảm họa & Sẵn sàng Cao (Multi-AZ HA & Failover) */
export function createOffshoreHaDrSpec(names?: SampleNames): DiagramSpec {
  const n = (
    id: string,
    type: NodeType,
    x: number,
    y: number,
    extra?: Partial<DiagramNode>
  ) => makeNode(names, id, type, x, y, extra);
  return {
    version: 1,
    traffic: { rps: 3500, profile: 'constant', durationSec: 60 },
    nodes: [
      n('r53', 'dns', 80, 220, { label: 'Route53 Health Check & Failover' }),
      n('alb_pri', 'load-balancer', 280, 130, { label: 'Primary AZ-A ALB' }),
      n('api_pri', 'api', 480, 130, { replicas: 2, label: 'Primary AZ-A API Cluster' }),
      n('rds_master', 'database', 680, 130, { label: 'RDS MySQL Master (AZ-A)' }),
      n('s3_pri', 'storage', 880, 130, { label: 'S3 Tokyo Primary' }),
      n('alb_stb', 'load-balancer', 280, 320, { label: 'Standby AZ-B ALB' }),
      n('api_stb', 'api', 480, 320, { replicas: 2, label: 'Standby AZ-B API Cluster' }),
      n('rds_replica', 'database', 680, 320, { label: 'RDS MySQL Read Replica (AZ-B)' }),
      n('s3_stb', 'storage', 880, 320, { label: 'S3 Osaka Replica (DR)' }),
    ],
    edges: [
      { id: 'e_pri', from: 'r53', to: 'alb_pri', weight: 0.85, label: 'Active 85%' },
      { id: 'e_stb', from: 'r53', to: 'alb_stb', weight: 0.15, label: 'Standby 15%' },
      { id: 'e_api_pri', from: 'alb_pri', to: 'api_pri', weight: 1 },
      { id: 'e_api_stb', from: 'alb_stb', to: 'api_stb', weight: 1 },
      { id: 'e_db_pri', from: 'api_pri', to: 'rds_master', weight: 0.7 },
      { id: 'e_db_stb', from: 'api_stb', to: 'rds_replica', weight: 0.7 },
      { id: 'e_sync', from: 'rds_master', to: 'rds_replica', weight: 0.5, label: 'Sync Replication' },
      { id: 'e_s3_pri', from: 'api_pri', to: 's3_pri', weight: 0.2 },
      { id: 'e_s3_stb', from: 'api_stb', to: 's3_stb', weight: 0.2 },
      { id: 'e_s3_sync', from: 's3_pri', to: 's3_stb', weight: 0.2, label: 'Cross-Region Backup' },
    ],
  };
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function slug(text: string) {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'node'
  );
}

/** Finds a cycle and returns the ids on it, or null for a DAG. */
export function findCycle(spec: DiagramSpec): string[] | null {
  const next = new Map<string, string[]>();
  for (const edge of spec.edges) {
    next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to]);
  }
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const to of next.get(id) ?? []) {
      if (state.get(to) === 1) return [...stack.slice(stack.indexOf(to)), to];
      if (!state.has(to)) {
        const cycle = visit(to);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const node of spec.nodes) {
    if (!state.has(node.id)) {
      const cycle = visit(node.id);
      if (cycle) return cycle;
    }
  }
  return null;
}

/**
 * Turns untrusted input (a stored block, a tool argument) into a valid spec:
 * missing fields get defaults, numbers are clamped, ids are made unique. Throws
 * an Error with a readable message when the diagram cannot be repaired.
 */
export function normalizeSpec(input: unknown): DiagramSpec {
  if (!input || typeof input !== 'object') {
    throw new Error('Đặc tả sơ đồ phải là một đối tượng JSON');
  }
  const raw = input as Record<string, unknown>;
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];
  if (rawNodes.length > LIMITS.maxNodes) {
    throw new Error(`Tối đa ${LIMITS.maxNodes} thành phần`);
  }
  if (rawEdges.length > LIMITS.maxEdges) {
    throw new Error(`Tối đa ${LIMITS.maxEdges} đường nối`);
  }

  const usedIds = new Set<string>();
  const nodes: DiagramNode[] = rawNodes.map((value, index) => {
    const item = (value ?? {}) as Record<string, unknown>;
    const type = NODE_TYPES.includes(item.type as NodeType)
      ? (item.type as NodeType)
      : null;
    if (!type) {
      throw new Error(
        `Thành phần #${index + 1} có "type" không hợp lệ. Chọn một trong: ${NODE_TYPES.join(', ')}`
      );
    }
    const d = TYPE_DEFAULTS[type];
    const label =
      typeof item.label === 'string' && item.label.trim()
        ? item.label.trim().slice(0, 60)
        : d.label;
    let id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 60)
        : slug(label);
    const base = id;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);

    const node: DiagramNode = {
      id,
      type,
      label,
      x: finite(item.x) ? clamp(item.x, -5000, 5000) : 80 + (index % 6) * 180,
      y: finite(item.y)
        ? clamp(item.y, -5000, 5000)
        : 80 + Math.floor(index / 6) * 160,
      replicas: finite(item.replicas)
        ? clamp(Math.round(item.replicas), 1, LIMITS.maxReplicas)
        : 1,
      capacityRps: finite(item.capacityRps)
        ? clamp(item.capacityRps, 1, 1e12)
        : d.capacityRps,
      latencyMs: finite(item.latencyMs)
        ? clamp(item.latencyMs, 0, 60_000)
        : d.latencyMs,
    };
    if (type === 'cache' || type === 'cdn') {
      node.hitRatio = finite(item.hitRatio)
        ? clamp(item.hitRatio, 0, 1)
        : (d.hitRatio ?? 0.8);
    }
    return node;
  });

  const ids = new Set(nodes.map(node => node.id));
  const usedEdgeIds = new Set<string>();
  const edges: DiagramEdge[] = rawEdges.map((value, index) => {
    const item = (value ?? {}) as Record<string, unknown>;
    const from = String(item.from ?? '');
    const to = String(item.to ?? '');
    if (!ids.has(from) || !ids.has(to)) {
      throw new Error(
        `Đường nối #${index + 1} trỏ tới thành phần không tồn tại ("${from}" → "${to}")`
      );
    }
    if (from === to) {
      throw new Error(
        `Đường nối #${index + 1} nối một thành phần với chính nó`
      );
    }
    let id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 60)
        : `${from}-${to}`;
    const base = id;
    for (let n = 2; usedEdgeIds.has(id); n++) id = `${base}-${n}`;
    usedEdgeIds.add(id);
    return {
      id,
      from,
      to,
      weight: finite(item.weight) ? clamp(item.weight, 0, 1e6) : 1,
      ...(typeof item.label === 'string' && item.label.trim()
        ? { label: item.label.trim().slice(0, 40) }
        : {}),
    };
  });

  const t = (raw.traffic ?? {}) as Record<string, unknown>;
  const spec: DiagramSpec = {
    version: 1,
    nodes,
    edges,
    traffic: {
      rps: finite(t.rps) ? clamp(t.rps, 0, LIMITS.maxRps) : 1000,
      profile: TRAFFIC_PROFILES.includes(t.profile as TrafficProfile)
        ? (t.profile as TrafficProfile)
        : 'constant',
      durationSec: finite(t.durationSec)
        ? clamp(t.durationSec, 1, LIMITS.maxDurationSec)
        : 60,
    },
  };

  const cycle = findCycle(spec);
  if (cycle) {
    throw new Error(
      `Sơ đồ có vòng lặp (${cycle.join(' → ')}). Mô phỏng chỉ hỗ trợ luồng một chiều.`
    );
  }
  return spec;
}
