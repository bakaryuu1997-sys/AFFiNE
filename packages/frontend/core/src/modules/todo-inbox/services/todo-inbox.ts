import { LiveData, Service } from '@toeverything/infra';
import { firstValueFrom, map, timeout } from 'rxjs';

import type { DocsService } from '../../doc/services/docs';
import {
  appendMarkdown,
  createDocFromMarkdown,
  withDoc,
} from '../../doc-writer/markdown-write';
import type { TemplateDocService } from '../../template-doc';
import type { WorkspaceService } from '../../workspace';
import { planDueEdit } from '../utils/edit-due';
import {
  bucketOf,
  DUE_TOKEN,
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
  /** `HH:mm` that goes with `due` */
  time: string | null;
  repeat: TodoRepeat | null;
  bucket: TodoBucket;
}

type CheckboxModel = {
  props: {
    checked: boolean;
    text: {
      toString(): string;
      replace(index: number, length: number, content: string): void;
    };
  };
};

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
 * from the block indexer. Due dates, times and repeat rules are written inline
 * in the text: `@2026-11-10 09:30`, `@hôm nay`, `🔁 hàng tuần`.
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

  private readonly source$ = this.indexer
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
    );

  readonly todos$ = LiveData.from<TodoItem[]>(this.source$, []);

  /**
   * The current tasks, waiting for the index to answer. Unlike `todos$` this
   * works without a subscriber, which is what the MCP tools and the reminders
   * need.
   */
  getTodos(): Promise<TodoItem[]> {
    return firstValueFrom(this.source$.pipe(timeout(10_000)));
  }

  /**
   * Completes or reopens a task in its document. A repeating task with a due
   * date is not checked off: its due date moves to the next occurrence (the
   * time of day stays).
   */
  async toggle(item: TodoItem) {
    await withDoc(this.docsService, item.docId, doc => {
      const model = doc.blockSuiteDoc.getModelById(
        item.blockId
      ) as CheckboxModel | null;
      if (!model) return;

      if (!item.checked && item.repeat && item.due) {
        const token = DUE_TOKEN.exec(model.props.text.toString());
        if (token) {
          // rewrite only "@<date or word>"; a time after it stays as it is
          model.props.text.replace(
            token.index + token[1].length,
            1 + token[2].length,
            `@${nextDue(item.due, item.repeat)}`
          );
          return;
        }
      }
      doc.blockSuiteDoc.updateBlock(model as never, {
        checked: !item.checked,
      });
    });
  }

  /** Sets, moves or clears (null) the due date of a task in its document. */
  async setDue(item: TodoItem, due: string | null) {
    await withDoc(this.docsService, item.docId, doc => {
      const model = doc.blockSuiteDoc.getModelById(
        item.blockId
      ) as CheckboxModel | null;
      if (!model) return;
      const patch = planDueEdit(model.props.text.toString(), due);
      if (patch.length === 0 && patch.insert === '') return;
      model.props.text.replace(patch.index, patch.length, patch.insert);
    });
  }

  /**
   * Adds a task to the inbox document, which is created on first use (with
   * `inboxTitle` as its title). Returns the id of that document.
   */
  async addTask(text: string, inboxTitle: string): Promise<string> {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) throw new Error('Task text is empty');
    const line = `- [ ] ${clean}`;

    const storageKey = `todo-inbox-doc:${this.workspaceService.workspace.id}`;
    let docId: string | null = null;
    try {
      docId = localStorage.getItem(storageKey);
    } catch {
      // storage unavailable: a new inbox doc is created every time
    }
    const record = docId ? this.docsService.list.doc$(docId).value : undefined;
    if (docId && record && !record.trash$.value) {
      await appendMarkdown(this.docsService, docId, line);
      return docId;
    }

    docId = await createDocFromMarkdown(
      this.workspaceService,
      inboxTitle,
      line
    );
    try {
      localStorage.setItem(storageKey, docId);
    } catch {
      // ignore
    }
    return docId;
  }
}
