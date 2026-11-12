import { getStoreManager } from '@affine/core/blocksuite/manager/store';
import { MarkdownTransformer } from '@blocksuite/affine/widgets/linked-doc';

import type { DocsService } from '../doc';
import { getAFFiNEWorkspaceSchema, type WorkspaceService } from '../workspace';

/**
 * Plain helpers for writing into documents from code (MCP tools, the task
 * inbox). They take the services they need as arguments so any feature can use
 * them without depending on another feature.
 */

export type OpenedDoc = ReturnType<DocsService['open']>['doc'];

export function storeExtensions() {
  return getStoreManager().config.init().value.get('store');
}

/** Opens a doc, waits until it is loaded, runs `fn`, then releases it. */
export async function withDoc<T>(
  docsService: DocsService,
  docId: string,
  fn: (doc: OpenedDoc) => Promise<T> | T
): Promise<T> {
  const record = docsService.list.doc$(docId).value;
  if (!record || record.trash$.value) {
    throw new Error(`Không tìm thấy tài liệu "${docId}"`);
  }
  const { doc, release } = docsService.open(docId);
  try {
    const dispose = doc.addPriorityLoad(10);
    await doc.waitForSyncReady();
    dispose();
    return await fn(doc);
  } finally {
    release();
  }
}

/** Appends Markdown to the end of a doc's first note block. */
export async function appendMarkdown(
  docsService: DocsService,
  docId: string,
  markdown: string
) {
  await withDoc(docsService, docId, async doc => {
    const store = doc.blockSuiteDoc;
    let noteId = store.getBlocksByFlavour('affine:note')[0]?.id;
    if (!noteId) {
      const pageId = store.getBlocksByFlavour('affine:page')[0]?.id;
      if (!pageId) throw new Error('Tài liệu không có khối trang');
      noteId = store.addBlock('affine:note', {}, pageId);
    }
    await MarkdownTransformer.importMarkdownToBlock({
      doc: store,
      blockId: noteId,
      markdown,
      extensions: storeExtensions(),
    });
  });
}

export async function createDocFromMarkdown(
  workspaceService: WorkspaceService,
  title: string,
  markdown: string
): Promise<string> {
  const docId = await MarkdownTransformer.importMarkdownToDoc({
    collection: workspaceService.workspace.docCollection,
    schema: getAFFiNEWorkspaceSchema(),
    markdown,
    fileName: title,
    extensions: storeExtensions(),
  });
  if (!docId) throw new Error('Không tạo được tài liệu');
  return docId;
}
