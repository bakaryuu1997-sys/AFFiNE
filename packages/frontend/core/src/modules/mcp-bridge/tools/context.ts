import type { DocRecord, DocsService } from '../../doc';
import {
  appendMarkdown as appendMarkdownTo,
  createDocFromMarkdown as createDocFromMarkdownIn,
  type OpenedDoc,
  withDoc as withDocIn,
} from '../../doc-writer/markdown-write';
import type { DocsSearchService } from '../../docs-search';
import type { TemplateDocService } from '../../template-doc';
import type { TodoInboxService } from '../../todo-inbox';
import type { WorkspaceService } from '../../workspace';
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

/** Docs an agent should see: not trashed and not a template. */
export function isVisibleDoc(ctx: ToolContext, record: DocRecord) {
  return (
    !record.trash$.value &&
    !ctx.templateDocService.list.listStore.isTemplateDoc(record.id)
  );
}

/** Opens a doc, waits until it is loaded, runs `fn`, then releases it. */
export function withDoc<T>(
  ctx: ToolContext,
  docId: string,
  fn: (doc: OpenedDoc) => Promise<T> | T
): Promise<T> {
  return withDocIn(ctx.docsService, docId, fn);
}

/** Appends Markdown to the end of a doc's first note block. */
export function appendMarkdown(
  ctx: ToolContext,
  docId: string,
  markdown: string
) {
  return appendMarkdownTo(ctx.docsService, docId, markdown);
}

export function createDocFromMarkdown(
  ctx: ToolContext,
  title: string,
  markdown: string
): Promise<string> {
  return createDocFromMarkdownIn(ctx.workspaceService, title, markdown);
}
