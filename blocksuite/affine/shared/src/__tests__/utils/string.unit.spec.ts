import { describe, expect, it } from 'vitest';

import {
  foldDiacritics,
  isFuzzyMatch,
  substringMatchScore,
} from '../../utils/string.js';

describe('fuzzyMatch', () => {
  it('basic case', () => {
    expect(isFuzzyMatch('John Smith', 'j')).toEqual(true);
    expect(isFuzzyMatch('John Smith', 'js')).toEqual(true);
    expect(isFuzzyMatch('John Smith', 'jsa')).toEqual(false);
  });

  it('should works with CJK', () => {
    expect(isFuzzyMatch('中', '中')).toEqual(true);
    expect(isFuzzyMatch('中文', '中')).toEqual(true);
    expect(isFuzzyMatch('中文字符', '中字')).toEqual(true);
    expect(isFuzzyMatch('中文字符', '字中')).toEqual(false);
  });

  it('should works with IME', () => {
    // IME will generate a space between 'da' and 't'
    expect(isFuzzyMatch('database', 'da t')).toEqual(true);
  });
});

describe('substringMatchScore', () => {
  it('should return a fraction if there exists a common maximal length substring. ', () => {
    const result = substringMatchScore('testing the function', 'tet');
    expect(result).toBeLessThan(1);
    expect(result).toBeGreaterThan(0);
  });

  it('should return bigger score for longer match', () => {
    const result = substringMatchScore('testing the function', 'functin');
    const result2 = substringMatchScore('testing the function', 'tet');
    // because th length of common substring of 'functin' is bigger than 'tet'
    expect(result).toBeGreaterThan(result2);
  });

  it('should return bigger score when using same query to search a shorter string', () => {
    const result = substringMatchScore('test', 'test');
    const result2 = substringMatchScore('testing the function', 'test');
    expect(result).toBeGreaterThan(result2);
  });

  it('should return 0 when there is no match', () => {
    const result = substringMatchScore('abc', 'defghijk');
    expect(result).toBe(0);
  });

  it('should handle cases where the query is longer than the string', () => {
    const result = substringMatchScore('short', 'longer substring');
    expect(result).toBe(0);
  });

  it('should handle empty strings correctly', () => {
    const result = substringMatchScore('any string', '');
    expect(result).toBe(0);
  });

  it('should handle both strings being empty', () => {
    const result = substringMatchScore('', '');
    expect(result).toBe(0);
  });

  it('should handle cases where both strings are identical', () => {
    const result = substringMatchScore('identical', 'identical');
    expect(result).toBe(1);
  });
});

describe('foldDiacritics', () => {
  it('removes Vietnamese diacritics and maps đ to d', () => {
    expect(foldDiacritics('Việt Nam')).toBe('viet nam');
    expect(foldDiacritics('Đường đi')).toBe('duong di');
    expect(foldDiacritics('Tiếng Việt')).toBe('tieng viet');
  });

  it('keeps CJK and kana untouched (only lower-cased)', () => {
    expect(foldDiacritics('中文')).toBe('中文');
    expect(foldDiacritics('がっこう')).toBe('がっこう');
  });

  it('makes fuzzy matching accent-insensitive in both directions', () => {
    expect(isFuzzyMatch('Việt Nam', 'viet')).toBe(true);
    expect(isFuzzyMatch('Viet Nam', 'việt')).toBe(true);
    expect(isFuzzyMatch('Đà Nẵng', 'da nang')).toBe(true);
  });
});
