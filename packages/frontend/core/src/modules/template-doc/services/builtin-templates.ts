import { getStoreManager } from '@affine/core/blocksuite/manager/store';
import { I18n } from '@affine/i18n';
import { MarkdownTransformer } from '@blocksuite/affine/widgets/linked-doc';
import { Service } from '@toeverything/infra';

import type { DocsService } from '../../doc';
import {
  getAFFiNEWorkspaceSchema,
  type WorkspaceService,
} from '../../workspace';
import {
  BUILTIN_TEMPLATES_VERSION,
  templatesForLanguage,
} from '../builtin/templates';

/**
 * Installs the bundled templates (in the language the app is showing) into a
 * workspace as template docs. It runs once per workspace, language and
 * template version; deleting a template does not bring it back, bumping
 * BUILTIN_TEMPLATES_VERSION does. Switching language later installs that
 * language's set as well.
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
    const pending = templatesForLanguage(String(I18n.language ?? 'en')).filter(
      t => !installed.has(t.id)
    );
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
