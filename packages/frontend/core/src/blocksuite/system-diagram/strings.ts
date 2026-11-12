import { I18n } from '@affine/i18n';

import type { SampleNames } from './spec';

/**
 * Every visible string of the system-diagram block lives here, in the three
 * supported languages. `S` always answers in the language the app is showing.
 */
const vi = {
  slashName: 'Sơ đồ hệ thống',
  slashDescription: 'Vẽ kiến trúc hệ thống và xem lưu lượng chạy qua nó.',
  title: 'Tên sơ đồ',
  untitled: 'Sơ đồ hệ thống',
  play: 'Chạy',
  pause: 'Tạm dừng',
  speed: 'Tốc độ',
  time: 'Thời điểm',
  addComponent: 'Thêm thành phần',
  connect: 'Nối',
  connectHint: 'Chọn thành phần nguồn, rồi chọn thành phần đích.',
  connectPickTarget: 'Giờ chọn thành phần đích.',
  remove: 'Xóa',
  loadSample: 'Dùng sơ đồ mẫu',
  empty: 'Sơ đồ trống. Thêm thành phần hoặc dùng sơ đồ mẫu.',
  invalid: 'Không đọc được đặc tả sơ đồ',
  readonly: 'Chỉ xem',
  success: 'Thành công',
  latency: 'Độ trễ',
  bottleneck: 'Nghẽn ở',
  noBottleneck: 'Không nghẽn',
  offered: 'Lưu lượng',
  busy: 'bận',
  inFlight: 'đang xử lý',
  traffic: 'Lưu lượng vào',
  rps: 'Yêu cầu/giây',
  profile: 'Kiểu tải',
  duration: 'Thời lượng (giây)',
  profiles: {
    constant: 'Ổn định',
    ramp: 'Tăng dần',
    spike: 'Đột biến',
  },
  node: 'Thành phần',
  edge: 'Đường nối',
  label: 'Tên',
  replicas: 'Số bản sao',
  capacity: 'Công suất mỗi bản sao (yêu cầu/giây)',
  latencyMs: 'Độ trễ khi rảnh (ms)',
  hitRatio: 'Tỉ lệ trúng cache (%)',
  weight: 'Tỉ trọng',
  edgeFrom: 'Từ',
  edgeTo: 'Đến',
  sampleRead: 'đọc',
  sampleWrite: 'ghi',
  connectErrors: {
    self: 'Không thể nối một thành phần với chính nó',
    duplicate: 'Hai thành phần này đã được nối',
    limit: 'Đã đạt số đường nối tối đa',
    cycle: 'Nối như vậy sẽ tạo vòng lặp',
  },
  types: {
    client: 'Người dùng',
    dns: 'DNS',
    cdn: 'CDN',
    'load-balancer': 'Cân bằng tải',
    api: 'Máy chủ API',
    cache: 'Cache',
    database: 'Cơ sở dữ liệu',
    queue: 'Hàng đợi',
    worker: 'Worker',
    storage: 'Lưu trữ tệp',
    search: 'Tìm kiếm',
  },
  statuses: {
    idle: 'rảnh',
    ok: 'ổn',
    busy: 'bận',
    saturated: 'quá tải',
  },
};

export type Strings = typeof vi;

const en: Strings = {
  slashName: 'System diagram',
  slashDescription:
    'Draw a system architecture and watch traffic flow through it.',
  title: 'Diagram name',
  untitled: 'System diagram',
  play: 'Play',
  pause: 'Pause',
  speed: 'Speed',
  time: 'Time',
  addComponent: 'Add component',
  connect: 'Connect',
  connectHint: 'Pick the source component, then the target.',
  connectPickTarget: 'Now pick the target component.',
  remove: 'Delete',
  loadSample: 'Use the sample diagram',
  empty: 'Empty diagram. Add a component or use the sample.',
  invalid: 'Cannot read the diagram spec',
  readonly: 'View only',
  success: 'Success',
  latency: 'Latency',
  bottleneck: 'Bottleneck',
  noBottleneck: 'No bottleneck',
  offered: 'Traffic',
  busy: 'busy',
  inFlight: 'in flight',
  traffic: 'Incoming traffic',
  rps: 'Requests/second',
  profile: 'Load profile',
  duration: 'Duration (seconds)',
  profiles: {
    constant: 'Steady',
    ramp: 'Ramp up',
    spike: 'Spike',
  },
  node: 'Component',
  edge: 'Connection',
  label: 'Name',
  replicas: 'Replicas',
  capacity: 'Capacity per replica (requests/second)',
  latencyMs: 'Idle latency (ms)',
  hitRatio: 'Cache hit ratio (%)',
  weight: 'Weight',
  edgeFrom: 'From',
  edgeTo: 'To',
  sampleRead: 'read',
  sampleWrite: 'write',
  connectErrors: {
    self: 'A component cannot be connected to itself',
    duplicate: 'These components are already connected',
    limit: 'The maximum number of connections is reached',
    cycle: 'That connection would create a loop',
  },
  types: {
    client: 'Users',
    dns: 'DNS',
    cdn: 'CDN',
    'load-balancer': 'Load balancer',
    api: 'API server',
    cache: 'Cache',
    database: 'Database',
    queue: 'Queue',
    worker: 'Worker',
    storage: 'File storage',
    search: 'Search',
  },
  statuses: {
    idle: 'idle',
    ok: 'ok',
    busy: 'busy',
    saturated: 'overloaded',
  },
};

const ja: Strings = {
  slashName: 'システム構成図',
  slashDescription: 'システムの構成を描いて、トラフィックの流れを確認します。',
  title: '図の名前',
  untitled: 'システム構成図',
  play: '再生',
  pause: '一時停止',
  speed: '速度',
  time: '時刻',
  addComponent: 'コンポーネントを追加',
  connect: '接続',
  connectHint: '接続元のコンポーネント、次に接続先を選んでください。',
  connectPickTarget: '次に接続先のコンポーネントを選んでください。',
  remove: '削除',
  loadSample: 'サンプルの図を使う',
  empty: '図が空です。コンポーネントを追加するか、サンプルを使ってください。',
  invalid: '図の仕様を読み取れません',
  readonly: '閲覧のみ',
  success: '成功率',
  latency: 'レイテンシ',
  bottleneck: 'ボトルネック',
  noBottleneck: 'ボトルネックなし',
  offered: 'トラフィック',
  busy: '使用中',
  inFlight: '処理中',
  traffic: '流入トラフィック',
  rps: 'リクエスト/秒',
  profile: '負荷パターン',
  duration: '期間（秒）',
  profiles: {
    constant: '一定',
    ramp: '徐々に増加',
    spike: 'スパイク',
  },
  node: 'コンポーネント',
  edge: '接続',
  label: '名前',
  replicas: 'レプリカ数',
  capacity: 'レプリカあたりの処理能力（リクエスト/秒）',
  latencyMs: '無負荷時のレイテンシ（ms）',
  hitRatio: 'キャッシュヒット率（%）',
  weight: '比率',
  edgeFrom: '接続元',
  edgeTo: '接続先',
  sampleRead: '読み取り',
  sampleWrite: '書き込み',
  connectErrors: {
    self: 'コンポーネントを自分自身に接続することはできません',
    duplicate: 'これらのコンポーネントはすでに接続されています',
    limit: '接続の上限数に達しています',
    cycle: 'この接続はループを作ってしまいます',
  },
  types: {
    client: 'ユーザー',
    dns: 'DNS',
    cdn: 'CDN',
    'load-balancer': 'ロードバランサー',
    api: 'API サーバー',
    cache: 'キャッシュ',
    database: 'データベース',
    queue: 'キュー',
    worker: 'ワーカー',
    storage: 'ファイルストレージ',
    search: '検索',
  },
  statuses: {
    idle: '待機',
    ok: '正常',
    busy: '高負荷',
    saturated: '過負荷',
  },
};

const TABLE: Record<'vi' | 'en' | 'ja', Strings> = { vi, en, ja };

/** The strings of the language the app is currently showing. */
export function currentStrings(): Strings {
  const language = String(I18n.language ?? 'en');
  if (language.startsWith('vi')) return TABLE.vi;
  if (language.startsWith('ja')) return TABLE.ja;
  return TABLE.en;
}

/** Looks the language up on every access, so a language switch shows at once. */
export const S: Strings = new Proxy({} as Strings, {
  get: (_, key: string) => currentStrings()[key as keyof Strings],
});

/** Labels for the sample diagram, in the language being shown. */
export function sampleNames(): SampleNames {
  const strings = currentStrings();
  return {
    label: type => strings.types[type],
    read: strings.sampleRead,
    write: strings.sampleWrite,
  };
}
