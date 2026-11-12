import { describe, expect, test } from 'vitest';

import { applyPatch, planDueEdit } from '../edit-due';

const edit = (text: string, due: string | null) =>
  applyPatch(text, planDueEdit(text, due));

describe('planDueEdit', () => {
  test('appends a due date when there is none', () => {
    expect(edit('Mua sữa', '2026-11-10')).toBe('Mua sữa @2026-11-10');
    expect(edit('Mua sữa ', '2026-11-10')).toBe('Mua sữa @2026-11-10');
    expect(edit('', '2026-11-10')).toBe('@2026-11-10');
  });

  test('rewrites an existing date in place', () => {
    expect(edit('Mua sữa @2026-11-05 gấp', '2026-11-12')).toBe(
      'Mua sữa @2026-11-12 gấp'
    );
    expect(edit('@2026-11-05 Mua sữa', '2026-11-12')).toBe(
      '@2026-11-12 Mua sữa'
    );
  });

  test('replaces a due word and keeps the time of day', () => {
    expect(edit('Gọi @today 14:05 repeat:weekly', '2026-12-01')).toBe(
      'Gọi @2026-12-01 14:05 repeat:weekly'
    );
    expect(edit('Gọi @hôm nay', '2026-12-01')).toBe('Gọi @2026-12-01');
  });

  test('clears the due date together with the space before it', () => {
    expect(edit('Mua sữa @2026-11-05 gấp', null)).toBe('Mua sữa gấp');
    expect(edit('Mua sữa @2026-11-05', null)).toBe('Mua sữa');
  });

  test('clearing a task without a date changes nothing', () => {
    const patch = planDueEdit('Mua sữa', null);
    expect(patch.length).toBe(0);
    expect(patch.insert).toBe('');
  });
});
