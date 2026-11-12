import { I18n } from '@affine/i18n';
import { Service } from '@toeverything/infra';

import type { WorkbenchService } from '../../workbench';
import type { WorkspaceService } from '../../workspace';
import { getReminderSettings } from '../reminder-settings';
import { planReminders, type ReminderTask } from '../utils/reminders';
import type { TodoInboxService } from './todo-inbox';

const CHECK_EVERY_MS = 60_000;
const FIRST_CHECK_MS = 4_000;
const MAX_REMEMBERED = 500;

/**
 * Shows a browser notification when a task with a due date arrives (at its
 * time, or at the start of the day when it has none). It only runs while the
 * app is open. Reminders already shown are remembered per workspace so a
 * reload does not repeat them.
 */
export class TodoReminderService extends Service {
  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private checking = false;

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly todoInbox: TodoInboxService,
    private readonly workbenchService: WorkbenchService
  ) {
    super();
  }

  private get storageKey() {
    return `todo-reminders-shown:${this.workspaceService.workspace.id}`;
  }

  /** True when the browser can show notifications at all. */
  static get supported() {
    return typeof Notification !== 'undefined';
  }

  /** Asks for permission; resolves to whether notifications may be shown. */
  static async requestPermission(): Promise<boolean> {
    if (!TodoReminderService.supported) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  }

  start() {
    if (this.started) return;
    this.started = true;
    const first = setTimeout(() => void this.check(), FIRST_CHECK_MS);
    this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    this.disposables.push(() => {
      clearTimeout(first);
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.started = false;
    });
  }

  private readShown(): Set<string> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set();
    }
  }

  private writeShown(keys: Set<string>) {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify([...keys].slice(-MAX_REMEMBERED))
      );
    } catch {
      // ignore: reminders may repeat after a reload, nothing worse
    }
  }

  /** One pass: finds due tasks and shows the notifications that are owed. */
  async check(now: Date = new Date()) {
    const settings = getReminderSettings();
    if (!settings.enabled || this.checking) return;
    if (
      !TodoReminderService.supported ||
      Notification.permission !== 'granted'
    ) {
      return;
    }
    this.checking = true;
    try {
      const todos = await this.todoInbox.getTodos();
      const shown = this.readShown();
      const plan = planReminders({
        tasks: todos,
        now,
        notified: shown,
        dayStartHour: settings.dayStartHour,
      });

      for (const task of plan.individual) this.notifyTask(task);
      if (plan.digest) this.notifyDigest(plan.digest);

      if (plan.keys.length > 0) {
        for (const key of plan.keys) shown.add(key);
        this.writeShown(shown);
      }
    } catch (error) {
      console.error('Task reminder check failed', error);
    } finally {
      this.checking = false;
    }
  }

  private notifyTask(task: ReminderTask) {
    const when = task.time ? `${task.due} ${task.time}` : (task.due ?? '');
    const notification = new Notification(
      task.title || I18n.t('com.affine.todoInbox.untitled'),
      {
        body: I18n.t('com.affine.todoInbox.reminder.due', { when }),
        tag: `${task.docId}:${task.blockId}`,
      }
    );
    notification.onclick = () => {
      window.focus();
      this.workbenchService.workbench.openDoc({
        docId: task.docId,
        mode: 'page',
        blockIds: [task.blockId],
      });
      notification.close();
    };
  }

  private notifyDigest(digest: { overdue: number; today: number }) {
    const notification = new Notification(
      I18n.t('com.affine.todoInbox.reminder.digest.title'),
      {
        body: I18n.t('com.affine.todoInbox.reminder.digest.body', {
          overdue: String(digest.overdue),
          today: String(digest.today),
        }),
        tag: 'todo-digest',
      }
    );
    notification.onclick = () => {
      window.focus();
      this.workbenchService.workbench.open('/todo');
      notification.close();
    };
  }
}
