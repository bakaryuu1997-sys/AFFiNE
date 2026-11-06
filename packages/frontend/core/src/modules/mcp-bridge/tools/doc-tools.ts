import { MarkdownTransformer } from '@blocksuite/affine/widgets/linked-doc';
import { firstValueFrom, timeout } from 'rxjs';

import { readInt, readString } from './args';
import {
  appendMarkdown,
  createDocFromMarkdown,
  isVisibleDoc,
  type McpToolDefinition,
  type ToolContext,
  withDoc,
} from './context';

const stripHighlight = (text: string | undefined) =>
  (text ?? '').replace(/<\/?b>/g, '').trim();

const iso = (value: number | undefined) =>
  value ? new Date(value).toISOString() : undefined;

export function createDocTools(ctx: ToolContext): McpToolDefinition[] {
  return [
    {
      name: 'list_docs',
      write: false,
      description:
        'List documents in the open workspace, newest first. With "query", full-text search titles and content instead (accent-insensitive). Trashed docs and templates are skipped.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional search text' },
          limit: {
            type: 'integer',
            description: 'Maximum results (1-200, default 50)',
          },
        },
      },
      handler: async args => {
        const query = readString(args, 'query', { max: 500 });
        const limit = readInt(args, 'limit', {
          min: 1,
          max: 200,
          fallback: 50,
        });

        if (query) {
          const hits = await firstValueFrom(
            ctx.docsSearchService.search$(query).pipe(timeout(10_000))
          );
          return hits
            .filter(hit => {
              const record = ctx.docsService.list.doc$(hit.docId).value;
              return !!record && isVisibleDoc(ctx, record);
            })
            .slice(0, limit)
            .map(hit => ({
              id: hit.docId,
              title: hit.title,
              snippet: stripHighlight(hit.blockContent),
            }));
        }

        return ctx.docsService.list.docs$.value
          .filter(record => isVisibleDoc(ctx, record))
          .map(record => ({
            id: record.id,
            title: record.title$.value || 'Untitled',
            updatedAt: record.meta$.value.updatedDate,
          }))
          .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          .slice(0, limit)
          .map(doc => ({ ...doc, updatedAt: iso(doc.updatedAt) }));
      },
    },
    {
      name: 'read_doc',
      write: false,
      description:
        'Read one document as Markdown. Checkboxes are "- [ ]" / "- [x]"; due dates and repeats are written inline as "@YYYY-MM-DD" and "repeat:weekly".',
      inputSchema: {
        type: 'object',
        properties: { docId: { type: 'string' } },
        required: ['docId'],
      },
      handler: async args => {
        const docId = readString(args, 'docId', { required: true }) as string;
        return withDoc(ctx, docId, async doc => {
          const converted = await MarkdownTransformer.docToMarkdownFiles(
            doc.blockSuiteDoc
          );
          if (!converted) throw new Error('Không đọc được tài liệu');
          return {
            id: docId,
            title: doc.record.title$.value || 'Untitled',
            markdown: converted.markdown,
            attachments: converted.assets.map(asset => asset.name),
          };
        });
      },
    },
    {
      name: 'create_doc',
      write: true,
      description:
        'Create a new document from Markdown. The title is separate from the body, so do not repeat it as a first heading.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          markdown: { type: 'string', description: 'Body in Markdown' },
        },
        required: ['title', 'markdown'],
      },
      handler: async args => {
        const title = readString(args, 'title', {
          required: true,
          max: 300,
        }) as string;
        const markdown = readString(args, 'markdown', {
          required: true,
        }) as string;
        const id = await createDocFromMarkdown(ctx, title, markdown);
        return { id, title };
      },
    },
    {
      name: 'append_to_doc',
      write: true,
      description:
        'Append Markdown to the end of an existing document. Existing content is never removed.',
      inputSchema: {
        type: 'object',
        properties: {
          docId: { type: 'string' },
          markdown: { type: 'string' },
        },
        required: ['docId', 'markdown'],
      },
      handler: async args => {
        const docId = readString(args, 'docId', { required: true }) as string;
        const markdown = readString(args, 'markdown', {
          required: true,
        }) as string;
        await appendMarkdown(ctx, docId, markdown);
        return { docId, appended: true };
      },
    },
  ];
}
