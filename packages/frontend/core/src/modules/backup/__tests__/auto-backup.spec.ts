import { describe, expect, it } from 'vitest';

import { prepareBackupFiles } from '../auto-backup';

describe('Auto Backup File Preparation', () => {
  it('prepares markdown files for active docs and skips trashed docs', () => {
    const mockDocs = [
      {
        id: '1',
        title$: { value: 'Tài liệu thiết kế' },
        trash$: { value: false },
      },
      {
        id: '2',
        title$: { value: 'Ghi chú nháp' },
        trash$: { value: true },
      },
      {
        id: '3',
        title$: { value: '' },
        trash$: { value: false },
      },
    ];

    const mockCollection = {
      getDoc: (id: string) => ({
        getBlocks: () => [
          {
            model: {
              text: { toString: () => `Nội dung của doc ${id}` },
            },
          },
        ],
      }),
    };

    const files = prepareBackupFiles(mockDocs as any, mockCollection as any);

    expect(files).toHaveLength(2);
    expect(files[0].filename).toBe('Tài liệu thiết kế.md');
    expect(files[0].content).toContain('# Tài liệu thiết kế');
    expect(files[0].content).toContain('Nội dung của doc 1');

    expect(files[1].filename).toBe('Untitled.md');
    expect(files[1].content).toContain('# Untitled');
  });
});
