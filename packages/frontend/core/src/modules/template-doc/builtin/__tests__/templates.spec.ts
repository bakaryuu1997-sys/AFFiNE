import { describe, expect, test } from 'vitest';

import { templatesForLanguage } from '../templates';

describe('templatesForLanguage', () => {
  test.each([
    ['vi', 'vi-'],
    ['en', 'en-'],
    ['ja', 'ja-'],
  ])('%s has the five templates with unique ids and titles', (lang, prefix) => {
    const templates = templatesForLanguage(lang);
    expect(templates).toHaveLength(5);
    expect(templates.every(t => t.id.startsWith(prefix))).toBe(true);
    expect(new Set(templates.map(t => t.id)).size).toBe(5);
    expect(new Set(templates.map(t => t.title)).size).toBe(5);
  });

  test('picks the set by the language prefix, English for the rest', () => {
    expect(templatesForLanguage('ja-JP')[0].id).toBe('ja-journal');
    expect(templatesForLanguage('vi-VN')[0].id).toBe('vi-journal');
    expect(templatesForLanguage('fr')[0].id).toBe('en-journal');
  });

  test('the sets mirror each other (same ids after the prefix)', () => {
    const ids = (lang: string) =>
      templatesForLanguage(lang).map(t => t.id.slice(3));
    expect(ids('en')).toEqual(ids('vi'));
    expect(ids('ja')).toEqual(ids('vi'));
  });

  test('every template has content and no dated task tokens', () => {
    for (const lang of ['vi', 'en', 'ja']) {
      for (const template of templatesForLanguage(lang)) {
        expect(template.markdown.trim().length).toBeGreaterThan(50);
        expect(template.markdown).not.toMatch(/@\d{4}-\d{2}-\d{2}/);
      }
    }
  });
});
