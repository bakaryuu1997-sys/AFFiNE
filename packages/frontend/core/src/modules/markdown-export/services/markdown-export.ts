import {
  download,
  MarkdownTransformer,
  Zip,
} from '@blocksuite/affine/widgets/linked-doc';
import { Service } from '@toeverything/infra';

import type { DocsService } from '../../doc';
import type { TemplateDocService } from '../../template-doc';
import type { WorkspaceService } from '../../workspace';
import {
  type ExportDoc,
  type ExportFile,
  layoutMarkdownFiles,
} from '../utils/layout';

export interface MarkdownExportProgress {
  done: number;
  total: number;
}

export interface MarkdownExportResult {
  exported: number;
  skipped: number;
  files: number;
}

type DirectoryHandle = {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<DirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<{
    createWritable(): Promise<{
      write(data: Blob | string): Promise<void>;
      close(): Promise<void>;
    }>;
  }>;
};

type WindowWithPicker = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'readwrite';
  }) => Promise<DirectoryHandle>;
};

/**
 * Exports the whole workspace as a folder (or zip) of Markdown files, so it
 * can be kept in git or opened with Obsidian.
 */
export class MarkdownExportService extends Service {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly docsService: DocsService,
    private readonly templateDocService: TemplateDocService
  ) {
    super();
  }

  /** True when the browser can write straight into a chosen folder. */
  get canWriteToFolder() {
    return (
      typeof (window as WindowWithPicker).showDirectoryPicker === 'function'
    );
  }

  async collect(
    onProgress?: (progress: MarkdownExportProgress) => void
  ): Promise<{ docs: ExportDoc[]; skipped: number }> {
    const records = this.docsService.list.docs$.value.filter(
      record =>
        !record.trash$.value &&
        !this.templateDocService.list.listStore.isTemplateDoc(record.id)
    );
    const docs: ExportDoc[] = [];
    let skipped = 0;

    for (const record of records) {
      try {
        const { doc, release } = this.docsService.open(record.id);
        try {
          const dispose = doc.addPriorityLoad(10);
          await doc.waitForSyncReady();
          dispose();
          const converted = await MarkdownTransformer.docToMarkdownFiles(
            doc.blockSuiteDoc
          );
          if (!converted) {
            skipped++;
            continue;
          }
          docs.push({
            id: record.id,
            title: record.title$.value || 'Untitled',
            ...converted,
          });
        } finally {
          release();
        }
      } catch (error) {
        console.error('Failed to export doc', record.id, error);
        skipped++;
      }
      onProgress?.({ done: docs.length + skipped, total: records.length });
    }
    return { docs, skipped };
  }

  async exportToZip(
    onProgress?: (progress: MarkdownExportProgress) => void
  ): Promise<MarkdownExportResult> {
    const { docs, skipped } = await this.collect(onProgress);
    const files = layoutMarkdownFiles(docs);
    const zip = new Zip();
    for (const file of files) {
      await zip.file(file.path, file.content);
    }
    const name = this.workspaceService.workspace.name$.value || 'workspace';
    download(await zip.generate(), `${name}-markdown.zip`);
    return { exported: docs.length, skipped, files: files.length };
  }

  /** Returns null when the user cancels the folder picker. */
  async exportToFolder(
    onProgress?: (progress: MarkdownExportProgress) => void
  ): Promise<MarkdownExportResult | null> {
    const picker = (window as WindowWithPicker).showDirectoryPicker;
    if (!picker) throw new Error('Folder picker is not supported');
    let root: DirectoryHandle;
    try {
      root = await picker.call(window, { mode: 'readwrite' });
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return null;
      throw error;
    }

    const { docs, skipped } = await this.collect(onProgress);
    const files = layoutMarkdownFiles(docs);
    for (const file of files) {
      await this.writeFile(root, file);
    }
    return { exported: docs.length, skipped, files: files.length };
  }

  private async writeFile(root: DirectoryHandle, file: ExportFile) {
    const parts = file.path.split('/');
    const fileName = parts.pop() as string;
    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.content);
    await writable.close();
  }
}
