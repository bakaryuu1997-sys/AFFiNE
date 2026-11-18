import { describe, expect, test } from 'vitest';

import { getWeekDayLabels } from '../week-date-picker-locale';

describe('getWeekDayLabels', () => {
  test('returns Vietnamese weekday abbreviations for vi locale', () => {
    expect(getWeekDayLabels('vi')).toEqual([
      'CN',
      'T2',
      'T3',
      'T4',
      'T5',
      'T6',
      'T7',
    ]);
  });

  test('returns Japanese weekday labels for ja locale', () => {
    expect(getWeekDayLabels('ja')).toEqual([
      '日',
      '月',
      '火',
      '水',
      '木',
      '金',
      '土',
    ]);
  });

  test('returns English weekday abbreviations by default', () => {
    expect(getWeekDayLabels('en')).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
  });
});
