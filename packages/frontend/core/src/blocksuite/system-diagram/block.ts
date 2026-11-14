import { BlockComponent } from '@blocksuite/affine/std';
import {
  html,
  nothing,
  type PropertyValues,
  svg,
  type TemplateResult,
} from 'lit';
import { state } from 'lit/decorators.js';

import {
  connectError,
  edgeMidpoint,
  edgePath,
  freePosition,
  particleCount,
  uniqueId,
  viewBoxOf,
} from './geometry';
import { NODE_BOX, nodeGlyph, TYPE_ACCENT } from './icons';
import { diagramToMermaid } from './mermaid';
import type { SystemDiagramBlockModel } from './model';
import {
  formatRate,
  type NodeResult,
  type SimResult,
  simulate,
  simulateTimeline,
  type TimelinePoint,
  trafficAt,
} from './simulate';
import {
  createEmptySpec,
  createFullSampleSpec,
  createOffshore3TierSpec,
  createOffshoreBatchEtlSpec,
  createOffshoreHaDrSpec,
  createOffshoreMicroservicesSpec,
  createOffshoreRagAiSpec,
  createSampleSpec,
  defaultNode,
  type DiagramNode,
  type DiagramSpec,
  type NodeType,
  normalizeSpec,
  TRAFFIC_PROFILES,
  type TrafficProfile,
} from './spec';
import { S, sampleNames } from './strings';
import { systemDiagramStyles } from './styles';

/** Wall-clock seconds one pass over the traffic profile takes at 1x speed. */
const RUN_WALL_SECONDS = 20;
/** Path lengths a particle travels per second at 1x speed. */
const PARTICLE_SPEED = 0.32;
const SPEEDS = [0.5, 1, 2, 4];

type Selection = { kind: 'node' | 'edge'; id: string } | null;

const stop = (event: Event) => event.stopPropagation();

const pillWidth = (text: string) => Math.max(34, text.length * 6.3 + 14);

export const TECH_SUGGESTIONS: Record<NodeType, string[]> = {
  database: [
    'MySQL',
    'PostgreSQL',
    'MongoDB',
    'Redis DB',
    'Elasticsearch',
    'ClickHouse',
    'SQLite',
    'Oracle DB',
    'DynamoDB',
  ],
  cache: ['Redis Cache', 'Memcached', 'Varnish', 'ElastiCache'],
  'load-balancer': [
    'AWS ALB',
    'Nginx',
    'HAProxy',
    'Cloudflare',
    'Traefik',
    'Kong Gateway',
  ],
  api: [
    'Node.js API',
    'FastAPI',
    'Spring Boot',
    'Go Gin',
    'NestJS',
    'GraphQL',
    'Next.js API',
  ],
  queue: ['RabbitMQ', 'Apache Kafka', 'AWS SQS', 'Redis Pub/Sub', 'Celery'],
  worker: [
    'Background Worker',
    'Celery Worker',
    'BullMQ Worker',
    'Cron Job',
    'ETL Worker',
    'Data Sync Worker',
  ],
  storage: [
    'AWS S3',
    'MinIO',
    'Google Cloud Storage',
    'Azure Blob',
    'NAS / NFS',
  ],
  search: [
    'Elasticsearch',
    'OpenSearch',
    'Vector DB (Qdrant)',
    'Meilisearch',
    'Milvus',
  ],
  client: [
    'Web Browser',
    'Mobile App (iOS/Android)',
    'SPA Frontend',
    'Desktop Client',
  ],
  dns: ['Route 53', 'Cloudflare DNS', 'CoreDNS', 'Google Cloud DNS'],
  cdn: ['Cloudflare CDN', 'AWS CloudFront', 'Fastly', 'Akamai'],
};


export interface ComponentCategory {
  id: string;
  name: string;
  icon: string;
  items: Array<{
    name: string;
    type: NodeType;
    desc?: string;
  }>;
}

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  {
    id: 'database',
    name: 'Cơ sở dữ liệu',
    icon: '🗄️',
    items: [
      { name: 'PostgreSQL', type: 'database', desc: 'CSDL quan hệ chuẩn ACID & JSON mạnh mẽ' },
      { name: 'MySQL', type: 'database', desc: 'Hệ quản trị CSDL quan hệ phổ biến nhất' },
      { name: 'MongoDB', type: 'database', desc: 'CSDL phi quan hệ dạng tài liệu (NoSQL)' },
      { name: 'Redis Database', type: 'database', desc: 'CSDL In-Memory tốc độ cực cao' },
      { name: 'ClickHouse', type: 'database', desc: 'CSDL cột phân tích OLAP & Data Warehouse' },
      { name: 'SQLite', type: 'database', desc: 'CSDL nhúng nhẹ cục bộ không cần server' },
      { name: 'Oracle DB', type: 'database', desc: 'Hệ CSDL doanh nghiệp quy mô lớn' },
    ],
  },
  {
    id: 'cache',
    name: 'Bộ nhớ đệm (Cache)',
    icon: '⚡',
    items: [
      { name: 'Redis Cache', type: 'cache', desc: 'Bộ nhớ đệm In-Memory giảm tải CSDL' },
      { name: 'Memcached', type: 'cache', desc: 'Bộ nhớ đệm phân tán hiệu năng cao' },
      { name: 'Varnish Cache', type: 'cache', desc: 'Bộ đệm tăng tốc nội dung web HTTP' },
    ],
  },
  {
    id: 'network',
    name: 'Cân bằng tải & Mạng',
    icon: '⚖️',
    items: [
      { name: 'AWS ALB', type: 'load-balancer', desc: 'Application Load Balancer tầng 7' },
      { name: 'Nginx Reverse Proxy', type: 'load-balancer', desc: 'Proxy ngược & cân bằng tải web' },
      { name: 'HAProxy', type: 'load-balancer', desc: 'Bộ cân bằng tải TCP/HTTP độ trễ siêu thấp' },
      { name: 'Kong API Gateway', type: 'load-balancer', desc: 'Cổng API Gateway quản lý routing & auth' },
      { name: 'AWS Route 53', type: 'dns', desc: 'Hệ thống định tuyến DNS toàn cầu' },
      { name: 'Cloudflare CDN & WAF', type: 'cdn', desc: 'Mạng phân phối nội dung & tường lửa bảo mật' },
    ],
  },
  {
    id: 'api',
    name: 'Máy chủ & Ứng dụng',
    icon: '🖥️',
    items: [
      { name: 'Node.js API', type: 'api', desc: 'Máy chủ backend xử lý I/O bất đồng bộ' },
      { name: 'FastAPI Backend', type: 'api', desc: 'Framework Python hiệu năng cao cho AI & API' },
      { name: 'Spring Boot API', type: 'api', desc: 'Nền tảng Java doanh nghiệp mạnh mẽ' },
      { name: 'Golang API Server', type: 'api', desc: 'Máy chủ Go siêu nhẹ và đồng thời cao' },
      { name: 'Microservice', type: 'api', desc: 'Dịch vụ nghiệp vụ độc lập theo kiến trúc vi dịch vụ' },
    ],
  },
  {
    id: 'queue',
    name: 'Hàng đợi & Xử lý nền',
    icon: '📬',
    items: [
      { name: 'RabbitMQ', type: 'queue', desc: 'Message Broker định tuyến thông điệp tin cậy' },
      { name: 'Apache Kafka', type: 'queue', desc: 'Hệ thống luồng dữ liệu sự kiện phân tán quy mô lớn' },
      { name: 'AWS SQS', type: 'queue', desc: 'Hàng đợi thông điệp đám mây không cần quản trị' },
      { name: 'Background Worker', type: 'worker', desc: 'Tiến trình xử lý công việc tác vụ chạy ngầm' },
      { name: 'Cron Job / Batch', type: 'worker', desc: 'Tác vụ chạy định kỳ theo lịch biểu' },
      { name: 'ETL Worker', type: 'worker', desc: 'Tiến trình trích xuất và biến đổi dữ liệu lớn' },
    ],
  },
  {
    id: 'storage',
    name: 'Lưu trữ tệp (Storage)',
    icon: '📦',
    items: [
      { name: 'AWS S3', type: 'storage', desc: 'Lưu trữ đối tượng đám mây mở rộng không giới hạn' },
      { name: 'MinIO', type: 'storage', desc: 'Lưu trữ đối tượng cục bộ tương thích chuẩn S3' },
      { name: 'Google Cloud Storage', type: 'storage', desc: 'Lưu trữ tệp & media trên Google Cloud' },
    ],
  },
  {
    id: 'search',
    name: 'Tìm kiếm & AI Vector',
    icon: '🔍',
    items: [
      { name: 'Elasticsearch', type: 'search', desc: 'Bộ máy tìm kiếm toàn văn & phân tích log' },
      { name: 'Vector DB (Qdrant)', type: 'search', desc: 'CSDL Vector chuyên dụng cho AI RAG & Embeddings' },
      { name: 'OpenSearch', type: 'search', desc: 'Tìm kiếm và phân tích phân tán mã nguồn mở' },
    ],
  },
  {
    id: 'client',
    name: 'Người dùng & Giao diện',
    icon: '👥',
    items: [
      { name: 'Trình duyệt Web', type: 'client', desc: 'Người dùng truy cập từ Desktop hoặc Web' },
      { name: 'Ứng dụng Di động', type: 'client', desc: 'Ứng dụng Native iOS / Android' },
    ],
  },
];

export class SystemDiagramBlockComponent extends BlockComponent<SystemDiagramBlockModel> {
  static override styles = systemDiagramStyles;

  @state() private accessor selected: Selection = null;
  @state() private accessor connecting = false;
  @state() private accessor connectFrom: string | null = null;
  @state() private accessor playing = true;
  @state() private accessor speed = 1;
  @state() private accessor time = 0;
  @state() private accessor dragging: {
    id: string;
    x: number;
    y: number;
  } | null = null;
  @state() private accessor notice: string | null = null;
  @state() private accessor zoom = 1;
  @state() private accessor isFullscreen = false;
  @state() private accessor panX = 0;
  @state() private accessor panY = 0;
  @state() private accessor isPanning = false;
  @state() private accessor showAddMenu = false;
  @state() private accessor activeCategory = 'database';

  private panStart = { x: 0, y: 0 };
  private panInitial = { x: 0, y: 0 };

  private version = 0;
  private cache: {
    version: number;
    spec: DiagramSpec;
    error: string | null;
  } | null = null;
  private timelineCache: { version: number; points: TimelinePoint[] } | null =
    null;
  private raf = 0;
  private lastFrame = 0;
  private lastStateAt = 0;
  private phase = 0;
  private clock = 0;
  private readonly paths = new Map<
    string,
    { el: SVGPathElement; length: number }
  >();
  private dots: SVGCircleElement[] = [];


  private readonly handleDocumentClick = (e: MouseEvent) => {
    if (!this.showAddMenu) return;
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.sd-add-menu-container')) {
      this.showAddMenu = false;
    }
  };

  override connectedCallback() {
    window.addEventListener('click', this.handleDocumentClick);
    super.connectedCallback();
    this.contentEditable = 'false';
    this.disposables.add(
      this.model.propsUpdated.subscribe(() => {
        this.version++;
        this.requestUpdate();
      })
    );
    this.raf = requestAnimationFrame(this.frame);
  }

  override disconnectedCallback() {
    window.removeEventListener('click', this.handleDocumentClick);
    cancelAnimationFrame(this.raf);
    super.disconnectedCallback();
  }

  override updated(changed: PropertyValues) {
    super.updated(changed);
    this.paths.clear();
    for (const el of this.querySelectorAll<SVGPathElement>('path.link')) {
      const id = el.dataset.edge;
      if (id) this.paths.set(id, { el, length: el.getTotalLength() });
    }
    this.dots = Array.from(this.querySelectorAll<SVGCircleElement>('circle.p'));
  }

  private readonly frame = (now: number) => {
    const dt = this.lastFrame
      ? Math.min(0.1, (now - this.lastFrame) / 1000)
      : 0;
    this.lastFrame = now;
    if (this.playing && this.isConnected) {
      const { spec } = this.getSpec();
      this.phase += dt * this.speed * PARTICLE_SPEED;
      this.clock +=
        dt * this.speed * (spec.traffic.durationSec / RUN_WALL_SECONDS);
      if (this.clock > spec.traffic.durationSec) this.clock = 0;
      if (now - this.lastStateAt > 100) {
        this.lastStateAt = now;
        this.time = this.clock;
      }
    }
    this.moveDots();
    this.raf = requestAnimationFrame(this.frame);
  };

  private moveDots() {
    for (const dot of this.dots) {
      const info = this.paths.get(dot.dataset.edge ?? '');
      if (!info) continue;
      const i = Number(dot.dataset.i);
      const n = Number(dot.dataset.n);
      const u = (this.phase + i / n) % 1;
      const p = info.el.getPointAtLength(u * info.length);
      dot.setAttribute('cx', p.x.toFixed(1));
      dot.setAttribute('cy', p.y.toFixed(1));
    }
  }

  private getSpec() {
    if (this.cache?.version === this.version) return this.cache;
    let spec: DiagramSpec;
    let error: string | null = null;
    try {
      spec = normalizeSpec(
        JSON.parse(JSON.stringify(this.model.props.spec ?? {}))
      );
    } catch (e) {
      spec = createEmptySpec();
      error = e instanceof Error ? e.message : String(e);
    }
    this.cache = { version: this.version, spec, error };
    return this.cache;
  }

  private getTimeline(spec: DiagramSpec) {
    if (this.timelineCache?.version !== this.version) {
      this.timelineCache = {
        version: this.version,
        points: simulateTimeline(spec, 60),
      };
    }
    return this.timelineCache.points;
  }

  private get isReadonly() {
    return Boolean(this.model.store.readonly);
  }

  // ---- editing -----------------------------------------------------------

  private commit(spec: DiagramSpec) {
    this.model.store.updateBlock(this.model, { spec });
  }

  private edit(mutate: (spec: DiagramSpec) => void) {
    if (this.isReadonly) return;
    const next = structuredClone(this.getSpec().spec);
    mutate(next);
    this.commit(next);
  }

  private addNode(type: NodeType, customLabel?: string) {
    let createdId = '';
    this.edit(spec => {
      const id = uniqueId(
        type,
        spec.nodes.map(n => n.id)
      );
      const { x, y } = freePosition(spec.nodes);
      const label = customLabel || S.types[type];
      spec.nodes.push(defaultNode(type, { id, x, y, label }));
      createdId = id;
    });
    if (createdId) this.selected = { kind: 'node', id: createdId };
  }

  private addNodeWithTech(type: NodeType, tech?: string) {
    this.addNode(type, tech);
  }

  private onSelectPreset(e: Event) {
    const select = e.target as HTMLSelectElement;
    const value = select.value;
    select.value = '';
    if (!value) return;

    const names = sampleNames();
    let newTitle = S.untitled;
    if (value === 'full') {
      this.commit(createFullSampleSpec(names));
      newTitle = S.templateFull;
    } else if (value === '3tier') {
      this.commit(createOffshore3TierSpec(names));
      newTitle = S.template3Tier;
    } else if (value === 'microservices') {
      this.commit(createOffshoreMicroservicesSpec(names));
      newTitle = S.templateMicroservices;
    } else if (value === 'batch') {
      this.commit(createOffshoreBatchEtlSpec(names));
      newTitle = S.templateBatchEtl;
    } else if (value === 'rag') {
      this.commit(createOffshoreRagAiSpec(names));
      newTitle = S.templateRagAi;
    } else if (value === 'hadr') {
      this.commit(createOffshoreHaDrSpec(names));
      newTitle = S.templateHaDr;
    } else if (value === 'sample') {
      this.commit(createSampleSpec(names));
      newTitle = S.templateBasic;
    }

    this.model.store.updateBlock(this.model, { title: newTitle });
    const input = this.querySelector<HTMLInputElement>('.sd-title');
    if (input) input.value = newTitle;
    try {
      const doc = (this.model.store as any).doc;
      if (doc?.meta && (!doc.meta.title || doc.meta.title === S.untitled || doc.meta.title === 'Sơ đồ hệ thống')) {
        doc.meta.title = newTitle;
      }
    } catch {}

    this.resetZoom();
    this.selected = null;
  }

  private onCanvasPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement | SVGElement | null;
    if (
      target?.closest('.node') ||
      target?.closest('.link') ||
      target?.closest('.pill') ||
      target?.closest('.sd-node-floating-toolbar') ||
      target?.closest('button') ||
      target?.closest('input')
    ) {
      return;
    }
    this.selected = null;
    if (this.connecting) this.connectFrom = null;

    this.isPanning = true;
    this.panStart = { x: e.clientX, y: e.clientY };
    this.panInitial = { x: this.panX, y: this.panY };

    const move = (ev: PointerEvent) => {
      if (!this.isPanning) return;
      const dx = (ev.clientX - this.panStart.x) / this.zoom;
      const dy = (ev.clientY - this.panStart.y) / this.zoom;
      this.panX = Math.round(this.panInitial.x - dx);
      this.panY = Math.round(this.panInitial.y - dy);
    };

    const up = () => {
      this.isPanning = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  private resetZoom() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  private removeSelected() {
    const selection = this.selected;
    if (!selection) return;
    this.edit(spec => {
      if (selection.kind === 'node') {
        spec.nodes = spec.nodes.filter(n => n.id !== selection.id);
        spec.edges = spec.edges.filter(
          e => e.from !== selection.id && e.to !== selection.id
        );
      } else {
        spec.edges = spec.edges.filter(e => e.id !== selection.id);
      }
    });
    this.selected = null;
  }

  private patchNode(id: string, patch: Partial<DiagramNode>) {
    this.edit(spec => {
      const node = spec.nodes.find(n => n.id === id);
      if (node) Object.assign(node, patch);
    });
  }

  private loadSample() {
    this.commit(createSampleSpec(sampleNames()));
    if (!this.model.props.title) {
      this.model.store.updateBlock(this.model, { title: S.untitled });
    }
    this.selected = null;
  }

  private handleConnectClick(id: string) {
    const { spec } = this.getSpec();
    if (!this.connectFrom) {
      this.connectFrom = id;
      this.notice = null;
      return;
    }
    const from = this.connectFrom;
    const error = connectError(spec, from, id);
    this.connectFrom = null;
    if (error) {
      this.notice = S.connectErrors[error];
      return;
    }
    this.edit(next => {
      next.edges.push({
        id: uniqueId(
          `${from}-${id}`,
          next.edges.map(e => e.id)
        ),
        from,
        to: id,
        weight: 1,
      });
    });
    this.connecting = false;
    this.notice = null;
  }

  private zoomIn() {
    this.zoom = Math.min(3.0, Number((this.zoom + 0.25).toFixed(2)));
  }

  private zoomOut() {
    this.zoom = Math.max(0.5, Number((this.zoom - 0.25).toFixed(2)));
  }

  private toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      this.classList.add('sd-fullscreen');
    } else {
      this.classList.remove('sd-fullscreen');
    }
  }

  private exportPng() {
    const svgEl = this.shadowRoot?.querySelector(
      'svg.sd-canvas'
    ) as SVGSVGElement | null;
    if (!svgEl) return;

    try {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2;
        canvas.width = (svgEl.clientWidth || 960) * scale;
        canvas.height = (svgEl.clientHeight || 540) * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e1e20';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const a = document.createElement('a');
          a.download = 'so-do-he-thong-11-thanh-phan.png';
          a.href = canvas.toDataURL('image/png');
          a.click();
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (err) {
      console.error('Failed to export PNG:', err);
    }
  }

  private copyMermaid() {
    let spec: DiagramSpec;
    try {
      spec = normalizeSpec(
        JSON.parse(JSON.stringify(this.model.props.spec ?? {}))
      );
    } catch {
      return;
    }
    if (spec.nodes.length === 0) return;

    navigator.clipboard
      .writeText(diagramToMermaid(spec))
      .then(() => {
        alert(S.copiedMermaid);
      })
      .catch(err => {
        console.error('Failed to copy mermaid code:', err);
      });
  }

  private toSvgPoint(svgEl: SVGSVGElement, event: PointerEvent) {
    const point = svgEl.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svgEl.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  }

  private onNodePointerDown(event: PointerEvent, node: DiagramNode) {
    event.stopPropagation();
    if (this.connecting && !this.isReadonly) {
      this.handleConnectClick(node.id);
      return;
    }
    this.selected = { kind: 'node', id: node.id };
    if (this.isReadonly) return;
    const svgEl = this.querySelector<SVGSVGElement>('svg.sd-svg');
    if (!svgEl) return;
    const start = this.toSvgPoint(svgEl, event);
    const origin = { x: node.x, y: node.y };
    const snap = (value: number) => Math.round(value / 10) * 10;

    const move = (ev: PointerEvent) => {
      const p = this.toSvgPoint(svgEl, ev);
      this.dragging = {
        id: node.id,
        x: snap(origin.x + p.x - start.x),
        y: snap(origin.y + p.y - start.y),
      };
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const drop = this.dragging;
      this.dragging = null;
      if (drop && (drop.x !== origin.x || drop.y !== origin.y)) {
        this.patchNode(drop.id, { x: drop.x, y: drop.y });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---- rendering ---------------------------------------------------------

  override render() {
    const { spec, error } = this.getSpec();
    const result = error
      ? null
      : simulate(spec, trafficAt(spec.traffic, this.time));
    return html`
      <div
        class="sd"
        @pointerdown=${stop}
        @keydown=${stop}
        @keyup=${stop}
        @paste=${stop}
        @copy=${stop}
        @cut=${stop}
      >
        ${this.renderBar(spec)} ${this.renderCanvas(spec, result, error)}
        ${this.renderChart(spec)} ${this.renderMetrics(spec, result)}
        ${this.renderInspector(spec, result)}
      </div>
    `;
  }

  private renderBar(spec: DiagramSpec) {
    const readonly = this.isReadonly;
    return html`
      <div class="sd-bar">
        <input
          class="sd-title"
          type="text"
          placeholder=${S.untitled}
          aria-label=${S.title}
          .value=${this.model.props.title ?? ''}
          ?disabled=${readonly}
          @change=${(e: Event) =>
            this.model.store.updateBlock(this.model, {
              title: (e.target as HTMLInputElement).value,
            })}
        />
        <button
          class="sd-btn"
          title=${this.playing ? S.pause : S.play}
          @click=${() => (this.playing = !this.playing)}
        >
          ${this.playing ? '❚❚' : '▶'}
        </button>
        <select
          aria-label=${S.speed}
          @change=${(e: Event) =>
            (this.speed = Number((e.target as HTMLSelectElement).value))}
        >
          ${SPEEDS.map(
            s =>
              html`<option value=${s} ?selected=${s === this.speed}>
                ${s}×
              </option>`
          )}
        </select>
        <input
          class="sd-time"
          type="range"
          aria-label=${S.time}
          min="0"
          max=${spec.traffic.durationSec}
          step=${Math.max(0.1, spec.traffic.durationSec / 200)}
          .value=${String(this.time)}
          @input=${(e: Event) => {
            const value = Number((e.target as HTMLInputElement).value);
            this.playing = false;
            this.clock = value;
            this.time = value;
          }}
        />
        ${
          readonly
            ? html`<span>${S.readonly}</span>`
            : html`
                <div class="sd-add-menu-container">
                  <button
                    class="sd-btn sd-add-btn ${this.showAddMenu ? 'active' : ''}"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.showAddMenu = !this.showAddMenu;
                    }}
                  >
                    + ${S.addComponent}... ▾
                  </button>
                  ${this.showAddMenu ? this.renderAddFlyoutMenu() : nothing}
                </div>
                <select
                  class="sd-preset-select"
                  aria-label=${S.presets}
                  @change=${(e: Event) => this.onSelectPreset(e)}
                >
                  <option value="">📁 ${S.presets}</option>
                  <option value="3tier">${S.template3Tier}</option>
                  <option value="microservices">
                    ${S.templateMicroservices}
                  </option>
                  <option value="batch">${S.templateBatchEtl}</option>
                  <option value="rag">${S.templateRagAi}</option>
                  <option value="hadr">${S.templateHaDr}</option>
                  <option value="full">${S.templateFull}</option>
                  <option value="sample">${S.templateBasic}</option>
                </select>
                <button
                  class="sd-btn ${this.connecting ? 'active' : ''}"
                  @click=${() => {
                    this.connecting = !this.connecting;
                    this.connectFrom = null;
                    this.notice = null;
                  }}
                >
                  ${S.connect}
                </button>
                <button
                  class="sd-btn"
                  ?disabled=${!this.selected}
                  @click=${() => this.removeSelected()}
                >
                  ${S.remove}
                </button>
                <div class="sd-zoom-controls">
                  <button
                    class="sd-btn sd-zoom-btn"
                    @click=${() => this.zoomOut()}
                    title=${S.zoomOut}
                  >
                    -
                  </button>
                  <span
                    class="sd-zoom-badge"
                    @click=${() => this.resetZoom()}
                    title=${S.resetZoom}
                  >
                    ${Math.round(this.zoom * 100)}%
                  </span>
                  <button
                    class="sd-btn sd-zoom-btn"
                    @click=${() => this.zoomIn()}
                    title=${S.zoomIn}
                  >
                    +
                  </button>
                </div>
                <span class="sd-save-badge" title="Tất cả thay đổi được tự động lưu cục bộ">
                  💾 Đã lưu
                </span>
                <button
                  class="sd-btn"
                  @click=${() => this.toggleFullscreen()}
                  title=${this.isFullscreen ? S.exitFullscreen : S.fullscreen}
                >
                  ${this.isFullscreen ? '✕ ' + S.exitFullscreen : '⛶ ' + S.fullscreen}
                </button>
                <button
                  class="sd-btn"
                  @click=${() => this.exportPng()}
                  title=${S.exportPng}
                >
                  📷 ${S.exportPng}
                </button>
                <button
                  class="sd-btn"
                  @click=${() => this.copyMermaid()}
                  title=${S.copyMermaid}
                >
                  📋 ${S.copyMermaid}
                </button>
                <button
                  class="sd-btn"
                  @click=${() => {
                    this.commit(createEmptySpec());
                    const freshTitle = 'Sơ đồ hệ thống mới';
                    this.model.store.updateBlock(this.model, { title: freshTitle });
                    const input = this.querySelector<HTMLInputElement>('.sd-title');
                    if (input) {
                      input.value = freshTitle;
                      input.focus();
                      input.select();
                    }
                    this.resetZoom();
                    this.selected = null;
                  }}
                  title=${S.newDiagram}
                >
                  ${S.newDiagram}
                </button>
              `
        }
      </div>
    `;
  }


  private renderAddFlyoutMenu() {
    const activeCat =
      COMPONENT_CATEGORIES.find(c => c.id === this.activeCategory) ??
      COMPONENT_CATEGORIES[0];

    return html`
      <div
        class="sd-flyout-menu"
        @click=${(e: Event) => e.stopPropagation()}
        @pointerdown=${(e: Event) => e.stopPropagation()}
      >
        <div class="sd-flyout-categories">
          ${COMPONENT_CATEGORIES.map(
            cat => html`
              <div
                class="sd-flyout-cat-item ${this.activeCategory === cat.id ? 'active' : ''}"
                @mouseenter=${() => {
                  this.activeCategory = cat.id;
                }}
                @click=${() => {
                  this.activeCategory = cat.id;
                }}
              >
                <span class="sd-cat-icon">${cat.icon}</span>
                <span class="sd-cat-name">${cat.name}</span>
                <span class="sd-cat-arrow">›</span>
              </div>
            `
          )}
        </div>
        <div class="sd-flyout-items">
          <div class="sd-flyout-items-header">
            <span>${activeCat?.icon} ${activeCat?.name}</span>
          </div>
          <div class="sd-flyout-items-list">
            ${(activeCat?.items ?? []).map(
              item => html`
                <div
                  class="sd-flyout-subitem"
                  @click=${() => {
                    this.addNodeWithTech(item.type, item.name);
                    this.showAddMenu = false;
                  }}
                >
                  <div class="sd-subitem-title">${item.name}</div>
                  ${item.desc
                    ? html`<div class="sd-subitem-desc">${item.desc}</div>`
                    : nothing}
                </div>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }

  private renderFloatingNodeToolbar(spec: DiagramSpec) {
    if (this.selected?.kind !== 'node') return nothing;
    const node = spec.nodes.find(n => n.id === this.selected?.id);
    if (!node) return nothing;

    const suggestions = TECH_SUGGESTIONS[node.type] || [];

    return html`
      <div
        class="sd-node-floating-toolbar"
        @pointerdown=${(e: Event) => e.stopPropagation()}
        @click=${(e: Event) => e.stopPropagation()}
      >
        <div class="sd-nft-title">
          <span>🛠️ ${S.node}: <b>${node.label}</b></span>
          <span class="sd-nft-type">${S.types[node.type]}</span>
        </div>
        <div class="sd-nft-edit-row">
          <input
            type="text"
            .value=${node.label}
            ?disabled=${this.isReadonly}
            placeholder=${S.editLabel}
            @input=${(e: Event) => {
              const val = (e.target as HTMLInputElement).value;
              this.patchNode(node.id, { label: val });
            }}
          />
          <button
            type="button"
            class="sd-btn"
            style="color:#f87171;border-color:rgba(248,113,113,0.3)"
            @click=${() => this.removeSelected()}
            title=${S.remove}
          >
            ✕ ${S.remove}
          </button>
        </div>
        ${
          suggestions.length > 0
            ? html`
                <div class="sd-nft-presets-row">
                  <span>${S.quickTech}</span>
                  <div class="sd-nft-badges">
                    ${suggestions.map(
                      tech => html`
                        <button
                          type="button"
                          class="sd-badge-btn ${node.label === tech ? 'active' : ''}"
                          @click=${() => this.patchNode(node.id, { label: tech })}
                        >
                          ${tech}
                        </button>
                      `
                    )}
                  </div>
                </div>
              `
            : nothing
        }
      </div>
    `;
  }

  private renderCanvas(
    spec: DiagramSpec,
    result: SimResult | null,
    error: string | null
  ) {
    const position = (node: DiagramNode) =>
      this.dragging?.id === node.id
        ? { ...node, x: this.dragging.x, y: this.dragging.y }
        : node;
    const placed = spec.nodes.map(position);
    const byId = new Map(placed.map(n => [n.id, n]));
    const baseBox = viewBoxOf(spec.nodes);
    const currentW = baseBox.w / this.zoom;
    const currentH = baseBox.h / this.zoom;
    const currentX = baseBox.x + (baseBox.w - currentW) / 2;
    const currentY = baseBox.y + (baseBox.h - currentH) / 2;

    const hint = this.connecting
      ? this.connectFrom
        ? S.connectPickTarget
        : S.connectHint
      : this.notice;

    return html`
      <div
        class="sd-canvas ${this.isPanning ? 'panning' : ''}"
        @pointerdown=${(e: PointerEvent) => this.onCanvasPointerDown(e)}
        @wheel=${(e: WheelEvent) => {
          if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) this.zoomIn();
            else this.zoomOut();
          }
        }}
      >
        <svg
          class="sd-svg"
          viewBox="${currentX + this.panX} ${currentY + this.panY} ${currentW} ${currentH}"
          style="aspect-ratio: ${baseBox.w} / ${baseBox.h}"
          preserveAspectRatio="xMidYMid meet"
        >
          ${spec.edges.map(edge => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return nothing;
            return this.renderEdge(edge.id, a, b, result);
          })}
          ${placed.map(node => this.renderNode(node, result?.nodes[node.id]))}
          ${spec.edges.map(edge => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return nothing;
            return this.renderEdgePill(edge.id, edge.label, a, b, result);
          })}
        </svg>
        ${this.renderFloatingNodeToolbar(spec)}
        ${hint ? html`<div class="sd-hint">${hint}</div>` : nothing}
        ${
          error
            ? html`<div class="sd-empty">
                <span>${S.invalid}: ${error}</span>
                ${
                  this.isReadonly
                    ? nothing
                    : html`<button
                        class="sd-btn"
                        @click=${() => this.loadSample()}
                      >
                        ${S.loadSample}
                      </button>`
                }
              </div>`
            : spec.nodes.length === 0
              ? html`<div class="sd-empty">
                  <span>${S.empty}</span>
                  ${
                    this.isReadonly
                      ? nothing
                      : html`<button
                          class="sd-btn"
                          @click=${() => this.loadSample()}
                        >
                          ${S.loadSample}
                        </button>`
                  }
                </div>`
              : nothing
        }
      </div>
    `;
  }

  private renderEdge(
    id: string,
    a: DiagramNode,
    b: DiagramNode,
    result: SimResult | null
  ) {
    const flow = result?.edges[id] ?? 0;
    const hot = result?.nodes[b.id]?.status === 'saturated';
    const d = edgePath(a, b);
    const selected = this.selected?.kind === 'edge' && this.selected.id === id;
    const count = particleCount(flow);
    const select = (e: Event) => {
      e.stopPropagation();
      this.selected = { kind: 'edge', id };
    };
    return svg`
      <path class="link ${flow > 0 ? 'live' : ''} ${hot ? 'hot' : ''} ${selected ? 'selected' : ''}"
        data-edge=${id} d=${d} />
      <path d=${d} fill="none" stroke="transparent" stroke-width="14" @pointerdown=${select} />
      ${Array.from(
        { length: count },
        (
          _,
          i
        ) => svg`<circle class="p ${hot ? 'hot' : ''}" r="3" cx="-100" cy="-100"
          data-edge=${id} data-i=${i} data-n=${count} />`
      )}`;
  }

  private renderEdgePill(
    id: string,
    label: string | undefined,
    a: DiagramNode,
    b: DiagramNode,
    result: SimResult | null
  ) {
    const flow = result?.edges[id] ?? 0;
    const hot = result?.nodes[b.id]?.status === 'saturated';
    const text = `${label ? `${label} ` : ''}${formatRate(flow)}`;
    const mid = edgeMidpoint(a, b);
    const w = pillWidth(text);
    const tone = hot ? 'bad' : '';
    return svg`
      <g @pointerdown=${(e: Event) => {
        e.stopPropagation();
        this.selected = { kind: 'edge', id };
      }} style="cursor:pointer">
        <rect class="pill ${tone}" x=${mid.x - w / 2} y=${mid.y - 9} width=${w} height="18" rx="9" />
        <text class="pill-text ${tone}" x=${mid.x} y=${mid.y}>${text}</text>
      </g>`;
  }

  private renderNode(node: DiagramNode, r: NodeResult | undefined) {
    const selected =
      this.selected?.kind === 'node' && this.selected.id === node.id;
    const source = this.connecting && this.connectFrom === node.id;
    const dragging = this.dragging?.id === node.id;
    const saturated = r?.status === 'saturated';
    const typeText = `${S.types[node.type]}${node.replicas > 1 ? ` ×${node.replicas}` : ''}`;

    let badge: TemplateResult | typeof nothing = nothing;
    if (r) {
      const unlimited = node.type === 'client';
      const percent = Math.min(999, Math.round(r.utilization * 100));
      const text = unlimited
        ? formatRate(r.load)
        : `${formatRate(r.load)} · ${percent}% ${S.busy}`;
      const tone =
        r.status === 'saturated' ? 'bad' : r.status === 'busy' ? 'warn' : '';
      const w = pillWidth(text);
      badge = html`${svg`
        <rect class="pill ${tone}" x=${-w / 2} y="42" width=${w} height="18" rx="9" />
        <text class="pill-text ${tone}" x="0" y="51">${text}</text>`}`;
    }

    return svg`
      <g class="node ${selected ? 'selected' : ''} ${source ? 'connect-source' : ''} ${dragging ? 'dragging' : ''}"
        transform="translate(${node.x} ${node.y})"
        style="--sd-accent:${TYPE_ACCENT[node.type]}"
        @pointerdown=${(e: PointerEvent) => this.onNodePointerDown(e, node)}>
        <rect class="node-box" x=${NODE_BOX.left} y=${NODE_BOX.top}
          width=${NODE_BOX.right - NODE_BOX.left} height=${NODE_BOX.bottom - NODE_BOX.top} />
        ${saturated ? svg`<circle class="pulse" cx="0" cy="-18" r="34" />` : nothing}
        ${nodeGlyph(node.type)}
        <text class="node-label" x="0" y="20">${node.label}</text>
        <text class="node-type" x="0" y="34">${typeText}</text>
        ${badge}
      </g>`;
  }

  private renderChart(spec: DiagramSpec) {
    if (spec.nodes.length === 0) return nothing;
    const points = this.getTimeline(spec);
    const width = 600;
    const height = 52;
    const maxRps = Math.max(1, ...points.map(p => p.rps));
    const x = (t: number) => (t / spec.traffic.durationSec) * width;
    const line = (value: (p: TimelinePoint) => number) =>
      points
        .map(
          p =>
            `${x(p.t).toFixed(1)},${(height - 6 - value(p) * (height - 12)).toFixed(1)}`
        )
        .join(' ');
    return html`
      <svg
        class="sd-chart"
        viewBox="0 0 ${width} ${height}"
        preserveAspectRatio="none"
        style="display:block;width:100%;height:${height}px;border-top:1px solid var(--sd-border)"
      >
        <polyline
          class="chart-line chart-rps"
          points=${line(p => p.rps / maxRps)}
        />
        <polyline
          class="chart-line chart-ok"
          points=${line(p => p.successRate)}
        />
        <line
          class="chart-now"
          x1=${x(this.time)}
          x2=${x(this.time)}
          y1="0"
          y2=${height}
        />
      </svg>
    `;
  }

  private renderMetrics(spec: DiagramSpec, result: SimResult | null) {
    if (!result || spec.nodes.length === 0) return nothing;
    const percent = Math.round(result.successRate * 1000) / 10;
    const tone = percent >= 99 ? '' : percent >= 90 ? 'warn' : 'bad';
    const bottleneck = result.bottleneck
      ? spec.nodes.find(n => n.id === result.bottleneck)?.label
      : null;
    return html`
      <div class="sd-metrics">
        <span>${S.offered}: <b>${formatRate(result.rps)}</b></span>
        <span class=${tone}>${S.success}: <b>${percent}%</b></span>
        <span>${S.latency}: <b>${result.latencyMs} ms</b></span>
        <span class=${bottleneck ? 'warn' : ''}>
          ${bottleneck ? html`${S.bottleneck}: <b>${bottleneck}</b>` : S.noBottleneck}
        </span>
      </div>
    `;
  }

  private numberField(
    label: string,
    value: number,
    onChange: (value: number) => void,
    attrs: { min?: number; max?: number; step?: number } = {}
  ) {
    return html`
      <label class="sd-field">
        ${label}
        <input
          type="number"
          min=${attrs.min ?? nothing}
          max=${attrs.max ?? nothing}
          step=${attrs.step ?? 'any'}
          .value=${String(value)}
          ?disabled=${this.isReadonly}
          @change=${(e: Event) => {
            const parsed = Number((e.target as HTMLInputElement).value);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
        />
      </label>
    `;
  }

  private renderInspector(spec: DiagramSpec, result: SimResult | null) {
    if (spec.nodes.length === 0) return nothing;
    const selection = this.selected;
    const node =
      selection?.kind === 'node'
        ? spec.nodes.find(n => n.id === selection.id)
        : null;
    const edge =
      selection?.kind === 'edge'
        ? spec.edges.find(e => e.id === selection.id)
        : null;

    return html`
      <div class="sd-inspector">
        ${node ? this.renderNodeFields(node, result?.nodes[node.id]) : nothing}
        ${edge ? this.renderEdgeFields(edge, spec) : nothing}
        <div class="sd-group-title">${S.traffic}</div>
        ${this.numberField(
          S.rps,
          spec.traffic.rps,
          rps => this.edit(s => (s.traffic.rps = Math.max(0, rps))),
          { min: 0 }
        )}
        <label class="sd-field">
          ${S.profile}
          <select
            ?disabled=${this.isReadonly}
            @change=${(e: Event) =>
              this.edit(
                s =>
                  (s.traffic.profile = (e.target as HTMLSelectElement)
                    .value as TrafficProfile)
              )}
          >
            ${TRAFFIC_PROFILES.map(
              p =>
                html`<option value=${p} ?selected=${p === spec.traffic.profile}>
                  ${S.profiles[p]}
                </option>`
            )}
          </select>
        </label>
        ${this.numberField(
          S.duration,
          spec.traffic.durationSec,
          value =>
            this.edit(
              s => (s.traffic.durationSec = Math.min(600, Math.max(1, value)))
            ),
          { min: 1, max: 600 }
        )}
      </div>
    `;
  }

  private renderNodeFields(node: DiagramNode, r: NodeResult | undefined) {
    const hasHit = node.type === 'cache' || node.type === 'cdn';
    return html`
      <div class="sd-group-title">
        ${S.node}${r ? html` · ${S.statuses[r.status]}` : nothing}
      </div>
      <label class="sd-field">
        ${S.label}
        <input
          type="text"
          .value=${node.label}
          ?disabled=${this.isReadonly}
          @change=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value.trim();
            if (value) this.patchNode(node.id, { label: value });
          }}
        />
      </label>
      <label class="sd-field">
        ${S.replicas}
        <div class="row">
          <button
            class="sd-btn"
            ?disabled=${this.isReadonly || node.replicas <= 1}
            @click=${() => this.patchNode(node.id, { replicas: node.replicas - 1 })}
          >
            −
          </button>
          <input
            type="number"
            min="1"
            max="1000"
            .value=${String(node.replicas)}
            ?disabled=${this.isReadonly}
            @change=${(e: Event) => {
              const value = Math.round(
                Number((e.target as HTMLInputElement).value)
              );
              if (Number.isFinite(value)) {
                this.patchNode(node.id, {
                  replicas: Math.min(1000, Math.max(1, value)),
                });
              }
            }}
          />
          <button
            class="sd-btn"
            ?disabled=${this.isReadonly || node.replicas >= 1000}
            @click=${() => this.patchNode(node.id, { replicas: node.replicas + 1 })}
          >
            +
          </button>
        </div>
      </label>
      ${
        node.type === 'client'
          ? nothing
          : this.numberField(
              S.capacity,
              node.capacityRps,
              value =>
                this.patchNode(node.id, { capacityRps: Math.max(1, value) }),
              { min: 1 }
            )
      }
      ${this.numberField(
        S.latencyMs,
        node.latencyMs,
        value => this.patchNode(node.id, { latencyMs: Math.max(0, value) }),
        { min: 0 }
      )}
      ${
        hasHit
          ? this.numberField(
              S.hitRatio,
              Math.round((node.hitRatio ?? 0) * 100),
              value =>
                this.patchNode(node.id, {
                  hitRatio: Math.min(100, Math.max(0, value)) / 100,
                }),
              { min: 0, max: 100, step: 1 }
            )
          : nothing
      }
    `;
  }

  private renderEdgeFields(
    edge: DiagramSpec['edges'][number],
    spec: DiagramSpec
  ) {
    const name = (id: string) => spec.nodes.find(n => n.id === id)?.label ?? id;
    return html`
      <div class="sd-group-title">
        ${S.edge}: ${name(edge.from)} → ${name(edge.to)}
      </div>
      ${this.numberField(
        S.weight,
        edge.weight,
        value =>
          this.edit(s => {
            const target = s.edges.find(e => e.id === edge.id);
            if (target) target.weight = Math.max(0, value);
          }),
        { min: 0 }
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-diagram-block': SystemDiagramBlockComponent;
  }
}
