import { describe, expect, test } from 'vitest';

import { canChiDay, canChiYear, getDayInfo, solarToLunar } from '../lunar';

describe('solarToLunar', () => {
  test.each([
    // Tết Nguyên đán (mùng 1 tháng Giêng)
    [2023, 1, 22, 1, 1, 2023],
    [2024, 2, 10, 1, 1, 2024],
    [2025, 1, 29, 1, 1, 2025],
    [2026, 2, 17, 1, 1, 2026],
    // Tết Trung Thu (rằm tháng 8)
    [2024, 9, 17, 15, 8, 2024],
    [2025, 10, 6, 15, 8, 2025],
    // Giỗ Tổ Hùng Vương (10/3)
    [2024, 4, 18, 10, 3, 2024],
    [2025, 4, 7, 10, 3, 2025],
  ])('%i-%i-%i -> %i/%i/%i', (y, m, d, ld, lm, ly) => {
    const l = solarToLunar(d, m, y);
    expect([l.day, l.month, l.year, l.leap]).toEqual([ld, lm, ly, false]);
  });

  test('detects the leap month (nhuận) of 2020', () => {
    const l = solarToLunar(23, 5, 2020);
    expect([l.day, l.month, l.year, l.leap]).toEqual([1, 4, 2020, true]);
    // the month before is the regular month 4
    const before = solarToLunar(22, 5, 2020);
    expect(before.month).toBe(4);
    expect(before.leap).toBe(false);
  });

  test('dates around the solar new year belong to the previous lunar year', () => {
    const l = solarToLunar(1, 1, 2026);
    expect(l.year).toBe(2025);
    expect(l.month).toBe(11);
  });
});

describe('can chi', () => {
  test('year', () => {
    expect(canChiYear(2024)).toBe('Giáp Thìn');
    expect(canChiYear(2025)).toBe('Ất Tỵ');
    expect(canChiYear(2026)).toBe('Bính Ngọ');
  });

  test('day', () => {
    // 2000-01-01 is a Mậu Ngọ day
    expect(canChiDay(1, 1, 2000)).toBe('Mậu Ngọ');
  });
});

describe('getDayInfo', () => {
  test('labels the 1st of a lunar month with day/month', () => {
    const info = getDayInfo(17, 2, 2026);
    expect(info.lunarLabel).toBe('1/1');
    expect(info.holiday).toBe('Tết Nguyên đán');
    expect(info.officialHoliday).toBe(true);
    expect(info.isMajorLunarDay).toBe(true);
  });

  test('regular days show the lunar day number', () => {
    expect(getDayInfo(20, 2, 2026).lunarLabel).toBe('4');
  });

  test('solar and lunar holidays', () => {
    expect(getDayInfo(30, 4, 2026).holiday).toBe('Giải phóng miền Nam');
    expect(getDayInfo(2, 9, 2026).officialHoliday).toBe(true);
    expect(getDayInfo(17, 9, 2024).holiday).toBe('Tết Trung Thu');
  });

  test('Giao thừa is the day before Tết', () => {
    const eve = getDayInfo(16, 2, 2026);
    expect(eve.holiday).toBe('Giao thừa');
  });
});
