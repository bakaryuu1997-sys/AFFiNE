import { Checkbox } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';

import { DocsService } from '../../doc';
import { WorkbenchService } from '../../workbench';
import { TodoInboxService, type TodoItem } from '../services/todo-inbox';
import type { TodoBucket } from '../utils/parse-todo';
import * as styles from './todo-inbox.css';

const BUCKETS: TodoBucket[] = ['overdue', 'today', 'week', 'later', 'none'];

const TodoRow = ({ item }: { item: TodoItem }) => {
  const t = useI18n();
  const docsService = useService(DocsService);
  const inbox = useService(TodoInboxService);
  const workbench = useService(WorkbenchService).workbench;
  const record = useLiveData(docsService.list.doc$(item.docId));
  const docTitle = useLiveData(record?.title$);

  const open = useCallback(() => {
    workbench.openDoc({
      docId: item.docId,
      mode: 'page',
      blockIds: [item.blockId],
    });
  }, [item, workbench]);

  return (
    <div className={styles.row} onClick={open} data-testid="todo-inbox-row">
      <span onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={item.checked}
          onChange={() => {
            inbox.toggle(item).catch(console.error);
          }}
        />
      </span>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {item.title || t['com.affine.todoInbox.untitled']()}
        </span>
        <span className={styles.rowDoc}>
          {typeof docTitle === 'string' ? docTitle : ''}
        </span>
      </div>
      {item.repeat ? (
        <span className={styles.rowMeta}>
          🔁 {t[`com.affine.todoInbox.repeat.${item.repeat}`]()}
        </span>
      ) : null}
      {item.due ? <span className={styles.rowMeta}>{item.due}</span> : null}
    </div>
  );
};

export const TodoInboxView = () => {
  const t = useI18n();
  const inbox = useService(TodoInboxService);
  const todos = useLiveData(inbox.todos$);
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<TodoBucket, TodoItem[]>();
    for (const item of todos) {
      if (item.checked && !showDone) continue;
      const key: TodoBucket = item.checked ? 'none' : item.bucket;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
    }
    return map;
  }, [todos, showDone]);

  const total = BUCKETS.reduce((n, b) => n + (groups.get(b)?.length ?? 0), 0);

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.hint}>{t['com.affine.todoInbox.hint']()}</div>
        <label className={styles.doneToggle}>
          <Checkbox
            checked={showDone}
            onChange={(_, checked) => setShowDone(checked)}
          />
          {t['com.affine.todoInbox.showDone']()}
        </label>
        {total === 0 ? (
          <div className={styles.empty}>
            {t['com.affine.todoInbox.empty']()}
          </div>
        ) : (
          BUCKETS.map(bucket => {
            const list = groups.get(bucket);
            if (!list?.length) return null;
            return (
              <div className={styles.group} key={bucket}>
                <div
                  className={
                    bucket === 'overdue'
                      ? styles.overdueTitle
                      : styles.groupTitle
                  }
                >
                  {t[`com.affine.todoInbox.bucket.${bucket}`]()} ({list.length})
                </div>
                {list.map(item => (
                  <TodoRow key={`${item.docId}:${item.blockId}`} item={item} />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
