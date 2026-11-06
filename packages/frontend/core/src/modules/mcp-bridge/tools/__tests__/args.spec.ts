import { describe, expect, test } from 'vitest';

import {
  buildTaskLine,
  readBool,
  readEnum,
  readInt,
  readIsoDate,
  readString,
  summarizeArgs,
} from '../args';

describe('readString', () => {
  test('requires and type-checks', () => {
    expect(readString({ a: 'x' }, 'a', { required: true })).toBe('x');
    expect(() => readString({}, 'a', { required: true })).toThrow(/Thiếu/);
    expect(() => readString({ a: 1 }, 'a')).toThrow(/chuỗi/);
    expect(readString({}, 'a')).toBeUndefined();
  });

  test('enforces the length limit', () => {
    expect(() => readString({ a: 'xxxx' }, 'a', { max: 3 })).toThrow(/quá dài/);
  });
});

describe('readInt / readBool / readEnum', () => {
  test('clamps numbers and applies the fallback', () => {
    const range = { min: 1, max: 200, fallback: 50 };
    expect(readInt({}, 'n', range)).toBe(50);
    expect(readInt({ n: 9999 }, 'n', range)).toBe(200);
    expect(readInt({ n: -3 }, 'n', range)).toBe(1);
    expect(readInt({ n: 7.9 }, 'n', range)).toBe(7);
    expect(() => readInt({ n: '5' }, 'n', range)).toThrow(/số/);
  });

  test('reads booleans strictly', () => {
    expect(readBool({}, 'b', true)).toBe(true);
    expect(readBool({ b: false }, 'b', true)).toBe(false);
    expect(() => readBool({ b: 'yes' }, 'b', true)).toThrow();
  });

  test('restricts enums', () => {
    expect(readEnum({ e: 'daily' }, 'e', ['daily', 'weekly'])).toBe('daily');
    expect(readEnum({}, 'e', ['daily'])).toBeUndefined();
    expect(() => readEnum({ e: 'hourly' }, 'e', ['daily'])).toThrow(/daily/);
  });
});

describe('readIsoDate', () => {
  test('accepts real dates only', () => {
    expect(readIsoDate({ d: '2026-11-10' }, 'd')).toBe('2026-11-10');
    expect(() => readIsoDate({ d: '2026-02-31' }, 'd')).toThrow(/YYYY-MM-DD/);
    expect(() => readIsoDate({ d: '10/11/2026' }, 'd')).toThrow();
    expect(readIsoDate({}, 'd')).toBeUndefined();
  });
});

describe('buildTaskLine', () => {
  test('uses the inbox syntax', () => {
    expect(
      buildTaskLine({ text: 'Tập gym', due: '2026-11-10', repeat: 'weekly' })
    ).toBe('- [ ] Tập gym @2026-11-10 repeat:weekly');
    expect(buildTaskLine({ text: 'Mua  sữa\n' })).toBe('- [ ] Mua sữa');
  });

  test('rejects empty text', () => {
    expect(() => buildTaskLine({ text: '  \n ' })).toThrow();
  });
});

describe('summarizeArgs', () => {
  test('truncates long arguments', () => {
    expect(summarizeArgs({ a: 'x'.repeat(500) }).length).toBe(120);
    expect(summarizeArgs({ a: 1 })).toBe('{"a":1}');
  });
});
