import {
  buildTaskLine,
  readBool,
  readEnum,
  readIsoDate,
  readString,
} from './args';
import {
  appendMarkdown,
  type McpToolDefinition,
  type ToolContext,
} from './context';

const BUCKETS = ['overdue', 'today', 'week', 'later', 'none'] as const;
const REPEATS = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export function createTaskTools(ctx: ToolContext): McpToolDefinition[] {
  return [
    {
      name: 'list_tasks',
      write: false,
      description:
        'List checkboxes from every document (the task inbox) with due date, repeat rule and the bucket they fall in: overdue, today, week (next 7 days), later, none (no due date). Open tasks only unless includeDone is true. A task added a moment ago may take a few seconds to appear while the index catches up.',
      inputSchema: {
        type: 'object',
        properties: {
          bucket: { type: 'string', enum: [...BUCKETS] },
          includeDone: { type: 'boolean' },
        },
      },
      handler: async args => {
        const bucket = readEnum(args, 'bucket', BUCKETS);
        const includeDone = readBool(args, 'includeDone', false);
        return (await ctx.todoInbox.getTodos())
          .filter(
            item =>
              (includeDone || !item.checked) &&
              (!bucket || item.bucket === bucket)
          )
          .map(item => ({
            docId: item.docId,
            blockId: item.blockId,
            docTitle:
              ctx.docsService.list.doc$(item.docId).value?.title$.value ?? '',
            title: item.title,
            done: item.checked,
            due: item.due,
            repeat: item.repeat,
            bucket: item.bucket,
          }));
      },
    },
    {
      name: 'set_task_done',
      write: true,
      description:
        'Mark a task done or open again, using docId and blockId from list_tasks. A repeating task with a due date is not checked off: its due date moves to the next occurrence.',
      inputSchema: {
        type: 'object',
        properties: {
          docId: { type: 'string' },
          blockId: { type: 'string' },
          done: { type: 'boolean' },
        },
        required: ['docId', 'blockId', 'done'],
      },
      handler: async args => {
        const docId = readString(args, 'docId', { required: true }) as string;
        const blockId = readString(args, 'blockId', {
          required: true,
        }) as string;
        const done = readBool(args, 'done', true);
        const item = (await ctx.todoInbox.getTodos()).find(
          todo => todo.docId === docId && todo.blockId === blockId
        );
        if (!item) {
          throw new Error(
            'Không thấy việc này (có thể chỉ mục chưa cập nhật). Gọi list_tasks để lấy lại.'
          );
        }
        if (item.checked === done) return { changed: false };
        await ctx.todoInbox.toggle(item);
        return {
          changed: true,
          movedToNextOccurrence: Boolean(done && item.repeat && item.due),
        };
      },
    },
    {
      name: 'add_task',
      write: true,
      description:
        'Add a checkbox task to the end of an existing document, optionally with a due date (YYYY-MM-DD) and a repeat rule.',
      inputSchema: {
        type: 'object',
        properties: {
          docId: { type: 'string' },
          text: { type: 'string' },
          due: { type: 'string', description: 'YYYY-MM-DD' },
          repeat: { type: 'string', enum: [...REPEATS] },
        },
        required: ['docId', 'text'],
      },
      handler: async args => {
        const docId = readString(args, 'docId', { required: true }) as string;
        const text = readString(args, 'text', {
          required: true,
          max: 1000,
        }) as string;
        const line = buildTaskLine({
          text,
          due: readIsoDate(args, 'due'),
          repeat: readEnum(args, 'repeat', REPEATS),
        });
        await appendMarkdown(ctx, docId, line);
        return { docId, added: line };
      },
    },
  ];
}
