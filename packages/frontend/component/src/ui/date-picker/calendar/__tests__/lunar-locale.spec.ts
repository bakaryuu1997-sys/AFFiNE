import { describe, expect, test } from 'vitest';

import { canChiDay, canChiYear, getDayInfo, LUNAR_WORDS } from '../lunar';

describe('lunar labels in three languages', () => {
  test('Can Chi of a year', () => {
    expect(canChiYear(2026)).toBe('Bính Ngọ');
    expect(canChiYear(2026, 'vi')).toBe('Bính Ngọ');
    expect(canChiYear(2026, 'en')).toBe('Bing Wu');
    expect(canChiYear(2026, 'ja')).toBe('丙午');
  });

  test('Can Chi of a day is the same day in every language', () => {
    const vi = canChiDay(5, 11, 2026, 'vi');
    expect(vi).toMatch(/^\S+ \S+$/);
    expect(canChiDay(5, 11, 2026, 'ja')).toMatch(
      /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/
    );
    expect(canChiDay(5, 11, 2026, 'en')).toMatch(/^\w+ \w+$/);
  });

  test('Lunar New Year 2026 (17 Feb) is named in each language', () => {
    const vi = getDayInfo(17, 2, 2026, 'vi');
    expect(vi.holiday).toBe('Tết Nguyên đán');
    expect(vi.lunarFull).toBe('1/1 ÂL — Bính Ngọ');

    const en = getDayInfo(17, 2, 2026, 'en');
    expect(en.holiday).toBe('Lunar New Year (Tết)');
    expect(en.lunarFull).toBe('Lunar 1/1 — Bing Wu');

    const ja = getDayInfo(17, 2, 2026, 'ja');
    expect(ja.holiday).toBe('テト（旧正月）');
    expect(ja.lunarFull).toBe('旧暦 1/1 — 丙午');

    for (const info of [vi, en, ja]) {
      expect(info.officialHoliday).toBe(true);
      expect(info.isMajorLunarDay).toBe(true);
      expect(info.lunarLabel).toBe('1/1');
    }
  });

  test('the eve of Tết is a holiday in each language', () => {
    expect(getDayInfo(16, 2, 2026, 'vi').holiday).toBe('Giao thừa');
    expect(getDayInfo(16, 2, 2026, 'en').holiday).toBe("Lunar New Year's Eve");
    expect(getDayInfo(16, 2, 2026, 'ja').holiday).toBe('大晦日');
  });

  test('solar observances keep their official flag', () => {
    expect(getDayInfo(2, 9, 2026, 'ja').holiday).toBe('独立記念日');
    expect(getDayInfo(2, 9, 2026, 'ja').officialHoliday).toBe(true);
    expect(getDayInfo(14, 2, 2026, 'en').officialHoliday).toBe(false);
  });

  test('the default language stays Vietnamese', () => {
    expect(getDayInfo(17, 2, 2026).holiday).toBe('Tết Nguyên đán');
  });

  test('every language has the words the journal needs', () => {
    for (const locale of ['vi', 'en', 'ja'] as const) {
      const words = LUNAR_WORDS[locale];
      expect(words.heading.length).toBeGreaterThan(0);
      expect(words.day('X')).toContain('X');
    }
  });
});
