import { formatDate } from './parse-todo';

/** What the reminder planner needs to know about a task. */
export interface ReminderTask {
  docId: string;
  blockId: string;
  title: string;
  checked: boolean;
  /** `YYYY-MM-DD` */
  due: string | null;
  /** `HH:mm` */
  time: string | null;
}

export interface ReminderPlan {
  /** tasks to announce one by one */
  individual: ReminderTask[];
  /** a single summary instead of (or besides) individual notices */
  digest: { overdue: number; today: number } | null;
  /** keys to remember as announced once the notices are shown */
  keys: string[];
}

/** A reminder is only sent while it is this fresh; older ones go in a digest. */
export const FRESH_WINDOW_MS = 36 * 60 * 60 * 1000;
/** Above this many fresh reminders they are folded into one digest. */
export const MAX_INDIVIDUAL = 3;
export const DEFAULT_DAY_START_HOUR = 8;

export const reminderKey = (task: ReminderTask) =>
  `${task.docId}:${task.blockId}:${task.due}${task.time ? ` ${task.time}` : ''}`;

export const digestKey = (now: Date) => `digest:${formatDate(now)}`;

/** When a task becomes due: its time, or the start of the day without one. */
export function dueMoment(
  task: ReminderTask,
  dayStartHour = DEFAULT_DAY_START_HOUR
): Date | null {
  if (!task.due) return null;
  const [y, m, d] = task.due.split('-').map(Number);
  const [hour, minute] = task.time
    ? task.time.split(':').map(Number)
    : [dayStartHour, 0];
  return new Date(y, m - 1, d, hour, minute);
}

/**
 * Decides which reminders to show right now. Pure: the caller keeps the set of
 * keys that were already announced and passes it back in.
 */
export function planReminders(options: {
  tasks: ReminderTask[];
  now: Date;
  notified: ReadonlySet<string>;
  dayStartHour?: number;
}): ReminderPlan {
  const {
    tasks,
    now,
    notified,
    dayStartHour = DEFAULT_DAY_START_HOUR,
  } = options;
  const today = formatDate(now);

  const open = tasks.filter(task => !task.checked && task.due);
  const arrived = open.filter(task => {
    const moment = dueMoment(task, dayStartHour);
    return moment !== null && moment.getTime() <= now.getTime();
  });

  const fresh = arrived.filter(task => {
    const age =
      now.getTime() - (dueMoment(task, dayStartHour) as Date).getTime();
    return age < FRESH_WINDOW_MS && !notified.has(reminderKey(task));
  });

  const counts = () => ({
    overdue: open.filter(task => (task.due as string) < today).length,
    today: open.filter(task => task.due === today).length,
  });

  if (fresh.length > MAX_INDIVIDUAL) {
    return {
      individual: [],
      digest: counts(),
      keys: [...fresh.map(reminderKey), digestKey(now)],
    };
  }

  const plan: ReminderPlan = {
    individual: fresh,
    digest: null,
    keys: fresh.map(reminderKey),
  };

  const stale = arrived.filter(task => (task.due as string) < today);
  const digestSeen = notified.has(digestKey(now));
  if (!digestSeen && now.getHours() >= dayStartHour && stale.length > 0) {
    plan.digest = counts();
    plan.keys.push(digestKey(now));
  }
  return plan;
}
