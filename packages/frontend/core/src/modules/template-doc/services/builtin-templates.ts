import { getStoreManager } from '@affine/core/blocksuite/manager/store';
import { MarkdownTransformer } from '@blocksuite/affine/widgets/linked-doc';
import { Service } from '@toeverything/infra';

import type { DocsService } from '../../doc';
import {
  getAFFiNEWorkspaceSchema,
  type WorkspaceService,
} from '../../workspace';
import {
  BUILTIN_TEMPLATES_VERSION,
  VI_TEMPLATES,
} from '../builtin/vi-templates';

/**
 * Installs the bundled Vietnamese templates into a workspace as template docs.
 * It runs once per workspace and template version; deleting a template does
 * not bring it back, bumping BUILTIN_TEMPLATES_VERSION does.
 */
export class BuiltinTemplatesService extends Service {
  private installing: Promise<void> | null = null;

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly docsService: DocsService
  ) {
    super();
  }

  private get storageKey() {
    return `builtin-templates:${this.workspaceService.workspace.id}`;
  }

  private readInstalled(): string[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.version === BUILTIN_TEMPLATES_VERSION) {
        return Array.isArray(parsed.ids) ? parsed.ids : [];
      }
    } catch {
      // storage unavailable: fall through and treat as not installed
    }
    return [];
  }

  private writeInstalled(ids: string[]) {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({ version: BUILTIN_TEMPLATES_VERSION, ids })
      );
    } catch {
      // ignore
    }
  }

  ensureInstalled(): Promise<void> {
    this.installing ??= this.install().finally(() => {
      this.installing = null;
    });
    return this.installing;
  }

  private async install() {
    const installed = new Set(this.readInstalled());
    const pending = VI_TEMPLATES.filter(t => !installed.has(t.id));
    if (!pending.length) return;

    const workspace = this.workspaceService.workspace;
    for (const template of pending) {
      try {
        const docId = await MarkdownTransformer.importMarkdownToDoc({
          collection: workspace.docCollection,
          schema: getAFFiNEWorkspaceSchema(),
          markdown: template.markdown,
          fileName: template.title,
          extensions: getStoreManager().config.init().value.get('store'),
        });
        if (!docId) continue;
        this.docsService.list
          .doc$(docId)
          .value?.setProperty('isTemplate', true);
        installed.add(template.id);
        this.writeInstalled([...installed]);
      } catch (error) {
        console.error('Failed to install template', template.id, error);
      }
    }
  }
}
