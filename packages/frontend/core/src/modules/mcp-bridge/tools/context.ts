import { getStoreManager } from '@affine/core/blocksuite/manager/store';
import { MarkdownTransformer } from '@blocksuite/affine/widgets/linked-doc';

import type { DocRecord, DocsService } from '../../doc';
import type { DocsSearchService } from '../../docs-search';
import type { TemplateDocService } from '../../template-doc';
import type { TodoInboxService } from '../../todo-inbox';
import type { WorkspaceService } from '../../workspace';
import { getAFFiNEWorkspaceSchema } from '../../workspace';
import type { ToolArgs } from './args';

export interface McpToolDefinition {
  name: string;
  description: string;
  /** JSON schema of the arguments */
  inputSchema: Record<string, unknown>;
  /** changes the workspace; blocked while write access is switched off */
  write: boolean;
  handler: (args: ToolArgs) => Promise<unknown>;
}

export interface ToolContext {
  workspaceService: WorkspaceService;
  docsService: DocsService;
  templateDocService: TemplateDocService;
  docsSearchService: DocsSearchService;
  todoInbox: TodoInboxService;
}

type OpenedDoc = ReturnType<DocsService['open']>['doc'];

export function storeExtensions() {
  return getStoreManager().config.init().value.get('store');
}

/** Docs an agent should see: not trashed and not a template. */
export function isVisibleDoc(ctx: ToolContext, record: DocRecord) {
  return (
    !record.trash$.value &&
    !ctx.templateDocService.list.listStore.isTemplateDoc(record.id)
  );
}

/** Opens a doc, waits until it is loaded, runs `fn`, then releases it. */
export async function withDoc<T>(
  ctx: ToolContext,
  docId: string,
  fn: (doc: OpenedDoc) => Promise<T> | T
): Promise<T> {
  const record = ctx.docsService.list.doc$(docId).value;
  if (!record || record.trash$.value) {
    throw new Error(`Không tìm thấy tài liệu "${docId}"`);
  }
  const { doc, release } = ctx.docsService.open(docId);
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
  ctx: ToolContext,
  docId: string,
  markdown: string
) {
  await withDoc(ctx, docId, async doc => {
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
  ctx: ToolContext,
  title: string,
  markdown: string
): Promise<string> {
  const docId = await MarkdownTransformer.importMarkdownToDoc({
    collection: ctx.workspaceService.workspace.docCollection,
    schema: getAFFiNEWorkspaceSchema(),
    markdown,
    fileName: title,
    extensions: storeExtensions(),
  });
  if (!docId) throw new Error('Không tạo được tài liệu');
  return docId;
}
