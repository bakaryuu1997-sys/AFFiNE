import { LiveData, Service } from '@toeverything/infra';
import { map } from 'rxjs';

import type { DocsService } from '../../doc/services/docs';
import type { TemplateDocService } from '../../template-doc';
import type { WorkspaceService } from '../../workspace';
import {
  bucketOf,
  nextDue,
  parseTodoText,
  type TodoBucket,
  type TodoRepeat,
} from '../utils/parse-todo';

export interface TodoItem {
  docId: string;
  blockId: string;
  checked: boolean;
  title: string;
  due: string | null;
  repeat: TodoRepeat | null;
  bucket: TodoBucket;
}

const stringField = (value: unknown) =>
  typeof value === 'string'
    ? value
    : Array.isArray(value) && typeof value[0] === 'string'
      ? value[0]
      : null;

function parseAdditional(value: unknown): {
  listType?: string;
  checked?: boolean;
} | null {
  const raw = stringField(value);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Collects every checkbox (`affine:list` of type todo) across the workspace
 * from the block indexer. Due dates and repeat rules are written inline in the
 * text: `@2026-11-10`, `@hôm nay`, `🔁 hàng tuần`.
 */
export class TodoInboxService extends Service {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly docsService: DocsService,
    private readonly templateDocService: TemplateDocService
  ) {
    super();
  }

  get indexer() {
    return this.workspaceService.workspace.engine.indexer;
  }

  readonly todos$ = LiveData.from<TodoItem[]>(
    this.indexer
      .search$(
        'block',
        { type: 'match', field: 'flavour', match: 'affine:list' },
        {
          pagination: { skip: 0, limit: Infinity },
          fields: ['docId', 'blockId', 'content', 'additional'],
        }
      )
      .pipe(
        map(({ nodes }) => {
          const now = new Date();
          const items: TodoItem[] = [];
          for (const node of nodes) {
            const docId = stringField(node.fields.docId);
            const blockId = stringField(node.fields.blockId);
            const additional = parseAdditional(node.fields.additional);
            if (!docId || !blockId || additional?.listType !== 'todo') continue;
            const record = this.docsService.list.doc$(docId).value;
            if (!record || record.trash$.value) continue;
            // checkboxes inside template docs are placeholders, not tasks
            if (this.templateDocService.list.listStore.isTemplateDoc(docId))
              continue;
            const todo = parseTodoText(
              stringField(node.fields.content) ?? '',
              !!additional.checked,
              now
            );
            items.push({
              docId,
              blockId,
              ...todo,
              bucket: bucketOf(todo.due, now),
            });
          }
          return items;
        })
      ),
    []
  );

  /**
   * Completes or reopens a task in its document. A repeating task with a due
   * date is not checked off: its due date moves to the next occurrence.
   */
  async toggle(item: TodoItem) {
    const { doc, release } = this.docsService.open(item.docId);
    try {
      const disposePriorityLoad = doc.addPriorityLoad(10);
      await doc.waitForSyncReady();
      disposePriorityLoad();

      const model = doc.blockSuiteDoc.getModelById(item.blockId) as {
        props: {
          checked: boolean;
          text: {
            toString(): string;
            replace(index: number, length: number, content: string): void;
          };
        };
      } | null;
      if (!model) return;

      if (!item.checked && item.repeat && item.due) {
        const text = model.props.text.toString();
        const token = text.match(/@\d{4}-\d{2}-\d{2}/);
        if (token && token.index !== undefined) {
          model.props.text.replace(
            token.index,
            token[0].length,
            `@${nextDue(item.due, item.repeat)}`
          );
          return;
        }
      }
      doc.blockSuiteDoc.updateBlock(model as never, {
        checked: !item.checked,
      });
    } finally {
      release();
    }
  }
}
