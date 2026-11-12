import { Checkbox, notify, Switch } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { type FormEvent, useCallback, useMemo, useState } from 'react';

import { DocsService } from '../../doc';
import { WorkbenchService } from '../../workbench';
import {
  updateReminderSettings,
  useReminderSettings,
} from '../reminder-settings';
import { TodoInboxService, type TodoItem } from '../services/todo-inbox';
import { TodoReminderService } from '../services/todo-reminder';
import type { TodoBucket } from '../utils/parse-todo';
import * as styles from './todo-inbox.css';

const BUCKETS: TodoBucket[] = ['overdue', 'today', 'week', 'later', 'none'];

const sortKey = (item: TodoItem) =>
  `${item.due ?? '9999-99-99'} ${item.time ?? '00:00'}`;

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
      {item.time ? <span className={styles.rowMeta}>{item.time}</span> : null}
      <input
        type="date"
        className={styles.dateInput}
        aria-label={t['com.affine.todoInbox.dueDate']()}
        value={item.due ?? ''}
        onClick={e => e.stopPropagation()}
        onChange={e => {
          inbox.setDue(item, e.target.value || null).catch(console.error);
        }}
        data-testid="todo-inbox-due"
      />
    </div>
  );
};

const QuickAdd = () => {
  const t = useI18n();
  const inbox = useService(TodoInboxService);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (busy || !text.trim()) return;
      setBusy(true);
      try {
        await inbox.addTask(
          text,
          t['com.affine.todoInbox.quickAdd.docTitle']()
        );
        setText('');
        notify.success({ title: t['com.affine.todoInbox.quickAdd.added']() });
      } catch (error) {
        notify.error({
          title: t['com.affine.todoInbox.quickAdd.failed'](),
          message: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, inbox, t, text]
  );

  return (
    <form className={styles.quickAdd} onSubmit={event => void submit(event)}>
      <input
        className={styles.quickAddInput}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t['com.affine.todoInbox.quickAdd.placeholder']()}
        disabled={busy}
        data-testid="todo-inbox-quick-add"
      />
      <button
        type="submit"
        className={styles.quickAddButton}
        disabled={busy || !text.trim()}
      >
        {t['com.affine.todoInbox.quickAdd.button']()}
      </button>
    </form>
  );
};

const ReminderToggle = () => {
  const t = useI18n();
  const settings = useReminderSettings();
  const [denied, setDenied] = useState(false);
  const supported = TodoReminderService.supported;

  const onChange = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const granted = await TodoReminderService.requestPermission();
      setDenied(!granted);
      if (!granted) return;
    } else {
      setDenied(false);
    }
    updateReminderSettings({ enabled });
  }, []);

  return (
    <div className={styles.reminder}>
      <div className={styles.reminderText}>
        <strong>{t['com.affine.todoInbox.reminder.title']()}</strong>
        <span className={styles.hint}>
          {!supported
            ? t['com.affine.todoInbox.reminder.unsupported']()
            : denied
              ? t['com.affine.todoInbox.reminder.denied']()
              : t['com.affine.todoInbox.reminder.description']()}
        </span>
      </div>
      <Switch
        checked={settings.enabled && supported}
        disabled={!supported}
        onChange={enabled => void onChange(enabled)}
        data-testid="todo-inbox-reminders"
      />
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
      list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    }
    return map;
  }, [todos, showDone]);

  const total = BUCKETS.reduce((n, b) => n + (groups.get(b)?.length ?? 0), 0);

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <QuickAdd />
        <div className={styles.hint}>{t['com.affine.todoInbox.hint']()}</div>
        <ReminderToggle />
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
