import { describe, expect, test } from 'vitest';

import {
  digestKey,
  dueMoment,
  FRESH_WINDOW_MS,
  planReminders,
  reminderKey,
  type ReminderTask,
} from '../reminders';

const task = (
  id: string,
  due: string | null,
  time: string | null = null,
  extra: Partial<ReminderTask> = {}
): ReminderTask => ({
  docId: 'd',
  blockId: id,
  title: id,
  checked: false,
  due,
  time,
  ...extra,
});

// 2026-11-05 10:00 local time
const now = new Date(2026, 10, 5, 10, 0);
const plan = (tasks: ReminderTask[], notified: string[] = []) =>
  planReminders({ tasks, now, notified: new Set(notified) });

describe('dueMoment', () => {
  test('uses the task time or the start of the day', () => {
    expect(dueMoment(task('a', '2026-11-05', '14:30'))).toEqual(
      new Date(2026, 10, 5, 14, 30)
    );
    expect(dueMoment(task('a', '2026-11-05'))).toEqual(
      new Date(2026, 10, 5, 8, 0)
    );
    expect(dueMoment(task('a', '2026-11-05'), 6)).toEqual(
      new Date(2026, 10, 5, 6, 0)
    );
    expect(dueMoment(task('a', null))).toBeNull();
  });
});

describe('planReminders', () => {
  test('announces a task that is due now, once', () => {
    const t = task('a', '2026-11-05');
    const first = plan([t]);
    expect(first.individual).toEqual([t]);
    expect(first.keys).toContain(reminderKey(t));
    expect(plan([t], first.keys).individual).toEqual([]);
  });

  test('waits for a task time that has not arrived yet', () => {
    expect(plan([task('a', '2026-11-05', '15:00')]).individual).toEqual([]);
    expect(plan([task('a', '2026-11-05', '09:00')]).individual).toHaveLength(1);
  });

  test('ignores done tasks, tasks without a date and future tasks', () => {
    const result = plan([
      task('done', '2026-11-05', null, { checked: true }),
      task('none', null),
      task('future', '2026-11-06'),
    ]);
    expect(result.individual).toEqual([]);
    expect(result.digest).toBeNull();
  });

  test('moving the due date makes a new reminder', () => {
    const before = plan([task('a', '2026-11-04')]);
    const moved = plan([task('a', '2026-11-05')], before.keys);
    expect(moved.individual).toHaveLength(1);
  });

  test('folds many fresh reminders into one digest', () => {
    const tasks = ['a', 'b', 'c', 'd'].map(id => task(id, '2026-11-05'));
    const result = plan(tasks);
    expect(result.individual).toEqual([]);
    expect(result.digest).toEqual({ overdue: 0, today: 4 });
    expect(result.keys).toContain(digestKey(now));
    expect(result.keys).toHaveLength(5);
  });

  test('tasks overdue for long go into a daily digest, once a day', () => {
    const old = task('old', '2026-10-01');
    const first = plan([old]);
    expect(first.individual).toEqual([]);
    expect(first.digest).toEqual({ overdue: 1, today: 0 });
    expect(plan([old], first.keys).digest).toBeNull();
  });

  test('no digest before the start of the day', () => {
    const early = planReminders({
      tasks: [task('old', '2026-10-01')],
      now: new Date(2026, 10, 5, 6, 0),
      notified: new Set(),
    });
    expect(early.digest).toBeNull();
  });

  test('the freshness window is 36 hours', () => {
    expect(FRESH_WINDOW_MS).toBe(36 * 60 * 60 * 1000);
    // due 2026-11-04 08:00 is 26 hours before `now`: still fresh
    expect(plan([task('a', '2026-11-04')]).individual).toHaveLength(1);
    // due 2026-11-03 08:00 is 50 hours before `now`: stale
    expect(plan([task('a', '2026-11-03')]).individual).toEqual([]);
  });
});
