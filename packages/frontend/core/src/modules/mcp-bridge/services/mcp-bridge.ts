import { LiveData, Service } from '@toeverything/infra';

import type { DocsService } from '../../doc';
import type { DocsSearchService } from '../../docs-search';
import type { TemplateDocService } from '../../template-doc';
import type { TodoInboxService } from '../../todo-inbox';
import type { WorkspaceService } from '../../workspace';
import {
  getMcpBridgeSettings,
  type McpBridgeSettings,
  subscribeMcpBridgeSettings,
} from '../settings';
import { summarizeArgs, type ToolArgs } from '../tools/args';
import type { McpToolDefinition, ToolContext } from '../tools/context';
import { createDocTools } from '../tools/doc-tools';
import { createTaskTools } from '../tools/task-tools';

export type BridgeStatus =
  | 'off'
  | 'needs-token'
  | 'connecting'
  | 'connected'
  | 'error';

export interface AuditEntry {
  id: string;
  time: number;
  tool: string;
  write: boolean;
  args: string;
  outcome: 'ok' | 'error' | 'blocked';
  message?: string;
}

const MAX_AUDIT = 100;
const MAX_RETRY_MS = 30_000;

/**
 * Connects this app to the local MCP bridge (scripts/mcp) and answers the tool
 * calls that AI agents send through it. Features register their tools here.
 * Write tools are refused while write access is switched off in settings.
 */
export class McpBridgeService extends Service {
  readonly status$ = new LiveData<BridgeStatus>('off');
  readonly audit$ = new LiveData<AuditEntry[]>([]);

  private readonly tools = new Map<string, McpToolDefinition>();
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1000;
  private started = false;
  private lastConnection = '';
  private nextAuditId = 1;

  constructor(
    private readonly workspaceService: WorkspaceService,
    docsService: DocsService,
    templateDocService: TemplateDocService,
    docsSearchService: DocsSearchService,
    todoInbox: TodoInboxService
  ) {
    super();
    const ctx: ToolContext = {
      workspaceService,
      docsService,
      templateDocService,
      docsSearchService,
      todoInbox,
    };
    for (const tool of [...createDocTools(ctx), ...createTaskTools(ctx)]) {
      this.tools.set(tool.name, tool);
    }
  }

  /** Lets other features add tools; republishes the list when connected. */
  registerTool(tool: McpToolDefinition) {
    this.tools.set(tool.name, tool);
    this.sendTools();
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.disposables.push(
      subscribeMcpBridgeSettings(() => this.onSettingsChanged()),
      () => this.stop()
    );
    this.connect();
  }

  private stop() {
    this.started = false;
    this.teardown();
    this.status$.next('off');
  }

  private connectionKey(settings: McpBridgeSettings) {
    return `${settings.enabled}|${settings.url}|${settings.token}`;
  }

  private onSettingsChanged() {
    const key = this.connectionKey(getMcpBridgeSettings());
    if (key === this.lastConnection) return;
    this.teardown();
    this.retryDelay = 1000;
    this.connect();
  }

  private teardown() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private scheduleRetry() {
    if (!this.started || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS);
  }

  private connect() {
    const settings = getMcpBridgeSettings();
    this.lastConnection = this.connectionKey(settings);
    if (!this.started || !settings.enabled) {
      this.status$.next('off');
      return;
    }
    if (!settings.token) {
      this.status$.next('needs-token');
      return;
    }

    this.status$.next('connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(settings.url, [
        'affine-mcp',
        `token.${settings.token}`,
      ]);
    } catch {
      this.status$.next('error');
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.retryDelay = 1000;
      this.status$.next('connected');
      const workspace = this.workspaceService.workspace;
      socket.send(
        JSON.stringify({
          type: 'hello',
          workspaceId: workspace.id,
          workspaceName: workspace.name$.value ?? '',
        })
      );
      this.sendTools();
    };
    socket.onmessage = event => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      this.handleMessage(socket, event.data).catch(console.error);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.status$.next('connecting');
      this.scheduleRetry();
    };
  }

  private sendTools() {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: 'tools',
        tools: [...this.tools.values()].map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          write: tool.write,
        })),
      })
    );
  }

  private record(entry: Omit<AuditEntry, 'id' | 'time'>) {
    const next: AuditEntry = {
      ...entry,
      id: String(this.nextAuditId++),
      time: Date.now(),
    };
    this.audit$.next([next, ...this.audit$.value].slice(0, MAX_AUDIT));
  }

  clearAudit() {
    this.audit$.next([]);
  }

  private async handleMessage(socket: WebSocket, data: string) {
    let message: { type?: string; id?: string; tool?: string; args?: ToolArgs };
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (message.type !== 'call' || !message.id) return;

    const reply = (payload: {
      ok: boolean;
      result?: unknown;
      error?: string;
    }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: 'result', id: message.id, ...payload })
        );
      }
    };

    const tool = message.tool ? this.tools.get(message.tool) : undefined;
    const args =
      message.args && typeof message.args === 'object' ? message.args : {};
    const base = {
      tool: message.tool ?? '?',
      write: Boolean(tool?.write),
      args: summarizeArgs(args),
    };

    if (!tool) {
      this.record({ ...base, outcome: 'error', message: 'unknown tool' });
      return reply({ ok: false, error: `Không có công cụ "${message.tool}"` });
    }
    if (tool.write && !getMcpBridgeSettings().writeEnabled) {
      const error =
        'Quyền ghi đang tắt. Bật lại trong Cài đặt → Lưu trữ → Cầu nối MCP.';
      this.record({ ...base, outcome: 'blocked', message: error });
      return reply({ ok: false, error });
    }
    try {
      const result = await tool.handler(args);
      this.record({ ...base, outcome: 'ok' });
      reply({ ok: true, result });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.record({ ...base, outcome: 'error', message: text });
      reply({ ok: false, error: text });
    }
  }
}
