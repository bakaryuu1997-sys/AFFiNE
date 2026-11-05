import { describe, expect, test } from 'vitest';

import { layoutMarkdownFiles, sanitizeFileName } from '../layout';

describe('sanitizeFileName', () => {
  test('removes characters that are invalid in file names', () => {
    expect(sanitizeFileName('a/b:c*d?')).toBe('a b c d');
    expect(sanitizeFileName('  Họp nhóm ngày 5/11  ')).toBe(
      'Họp nhóm ngày 5 11'
    );
  });

  test('handles empty, dotted and reserved names', () => {
    expect(sanitizeFileName('')).toBe('Untitled');
    expect(sanitizeFileName('...')).toBe('Untitled');
    expect(sanitizeFileName('CON')).toBe('_CON');
  });

  test('limits the length', () => {
    expect(sanitizeFileName('x'.repeat(300)).length).toBe(120);
  });
});

describe('layoutMarkdownFiles', () => {
  const doc = (id: string, title: string, assets: string[] = []) => ({
    id,
    title,
    markdown: `# ${title}`,
    assets: assets.map(name => ({ name, blob: new Blob([name]) })),
  });

  test('writes front matter with title and id', () => {
    const [file] = layoutMarkdownFiles([doc('d1', 'Mẫu "OKR"')]);
    expect(file.path).toBe('Mẫu OKR.md');
    expect(file.content).toContain('title: "Mẫu \\"OKR\\""');
    expect(file.content).toContain('id: "d1"');
  });

  test('keeps names unique ignoring case', () => {
    const paths = layoutMarkdownFiles([
      doc('1', 'Ghi chú'),
      doc('2', 'ghi chú'),
      doc('3', 'Ghi chú'),
    ]).map(f => f.path);
    expect(paths).toEqual(['Ghi chú.md', 'ghi chú (2).md', 'Ghi chú (3).md']);
  });

  test('puts docs with attachments in their own folder', () => {
    const paths = layoutMarkdownFiles([doc('1', 'Ảnh', ['a.png'])]).map(
      f => f.path
    );
    expect(paths).toEqual(['Ảnh/index.md', 'Ảnh/assets/a.png']);
  });
});
