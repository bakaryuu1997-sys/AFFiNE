import { describe, expect, test } from 'vitest';

import { bucketOf, nextDue, parseTodo, parseTodoText } from '../parse-todo';

const now = new Date(2026, 10, 5); // 2026-11-05

describe('parseTodo', () => {
  test('rejects non-checkbox lines', () => {
    expect(parseTodo('- plain bullet')).toBeNull();
    expect(parseTodo('hello')).toBeNull();
  });

  test('reads checked state and plain title', () => {
    expect(parseTodo('- [ ] Mua sữa')).toMatchObject({
      checked: false,
      title: 'Mua sữa',
      due: null,
      repeat: null,
    });
    expect(parseTodo('  - [x] Xong rồi\n')?.checked).toBe(true);
  });

  test('parses ISO due date and strips it', () => {
    const todo = parseTodo('- [ ] Nộp báo cáo @2026-11-10 gấp', now);
    expect(todo?.due).toBe('2026-11-10');
    expect(todo?.title).toBe('Nộp báo cáo gấp');
  });

  test('ignores impossible dates', () => {
    expect(parseTodo('- [ ] x @2026-02-31', now)?.due).toBeNull();
  });

  test('resolves relative words', () => {
    expect(parseTodo('- [ ] a @hôm nay', now)?.due).toBe('2026-11-05');
    expect(parseTodo('- [ ] a @ngày mai', now)?.due).toBe('2026-11-06');
    expect(parseTodo('- [ ] a @tomorrow', now)?.due).toBe('2026-11-06');
  });

  test('parses repeat rules', () => {
    expect(parseTodo('- [ ] Tập gym 🔁 hàng tuần', now)).toMatchObject({
      title: 'Tập gym',
      repeat: 'weekly',
    });
    expect(parseTodo('- [ ] a repeat:monthly', now)?.repeat).toBe('monthly');
  });
});

describe('parseTodoText', () => {
  test('parses plain block text with the given checked state', () => {
    expect(
      parseTodoText('Tập gym @2026-11-05 repeat:weekly', true, now)
    ).toEqual({
      checked: true,
      title: 'Tập gym',
      due: '2026-11-05',
      time: null,
      repeat: 'weekly',
    });
  });

  test('reads a time of day after the date', () => {
    expect(parseTodoText('Họp @2026-11-10 9:30 gấp', false, now)).toMatchObject(
      {
        title: 'Họp gấp',
        due: '2026-11-10',
        time: '09:30',
      }
    );
    expect(parseTodoText('Gọi @today 14:05', false, now)).toMatchObject({
      title: 'Gọi',
      due: '2026-11-05',
      time: '14:05',
    });
  });

  test('ignores an impossible time but keeps the date', () => {
    const todo = parseTodoText('x @2026-11-10 25:99', false, now);
    expect(todo.due).toBe('2026-11-10');
    expect(todo.time).toBeNull();
  });
});

describe('bucketOf', () => {
  test('groups by due date', () => {
    expect(bucketOf(null, now)).toBe('none');
    expect(bucketOf('2026-11-04', now)).toBe('overdue');
    expect(bucketOf('2026-11-05', now)).toBe('today');
    expect(bucketOf('2026-11-12', now)).toBe('week');
    expect(bucketOf('2026-11-13', now)).toBe('later');
  });
});

describe('nextDue', () => {
  test('advances by rule', () => {
    expect(nextDue('2026-11-05', 'daily')).toBe('2026-11-06');
    expect(nextDue('2026-11-05', 'weekly')).toBe('2026-11-12');
    expect(nextDue('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextDue('2024-02-29', 'yearly')).toBe('2025-02-28');
  });
});
