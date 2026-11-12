import { MenuLinkItem } from '@affine/core/modules/app-sidebar/views';
import {
  TodoInboxService,
  TodoReminderService,
} from '@affine/core/modules/todo-inbox';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import { DoneIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useMemo } from 'react';

import * as styles from './todo-button.css';

export const AppSidebarTodoButton = () => {
  const t = useI18n();
  const workbench = useService(WorkbenchService).workbench;
  const inbox = useService(TodoInboxService);
  const reminders = useService(TodoReminderService);
  const todos = useLiveData(inbox.todos$);
  const active = useLiveData(
    workbench.location$.selector(location => location.pathname === '/todo')
  );

  // reminders run for as long as the sidebar is mounted
  useEffect(() => {
    reminders.start();
  }, [reminders]);

  const { overdue, today } = useMemo(
    () => ({
      overdue: todos.filter(todo => !todo.checked && todo.bucket === 'overdue')
        .length,
      today: todos.filter(todo => !todo.checked && todo.bucket === 'today')
        .length,
    }),
    [todos]
  );
  const count = overdue + today;

  return (
    <MenuLinkItem
      data-testid="slider-bar-todo-button"
      active={active}
      to={'/todo'}
      icon={<DoneIcon />}
      postfix={
        count > 0 ? (
          <span
            className={overdue > 0 ? styles.badgeOverdue : styles.badge}
            data-testid="todo-badge"
          >
            {count}
          </span>
        ) : undefined
      }
      postfixDisplay="always"
    >
      {t['com.affine.todoInbox.title']()}
    </MenuLinkItem>
  );
};
