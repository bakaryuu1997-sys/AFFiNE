import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExportDoc } from '../../markdown-export/utils/layout';
import {
  blobToBase64,
  checkAndRunScheduledAutoBackup,
  convertExportFilesToBackupEntries,
  LAST_AUTO_BACKUP_KEY,
  type MarkdownCollector,
  runAutoBackupNow,
} from '../auto-backup';

vi.mock('../../mcp-bridge/tauri', () => ({
  invokeTauri: vi.fn(),
}));

import { invokeTauri } from '../../mcp-bridge/tauri';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => storage.set(key, val),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};
(globalThis as any).localStorage = localStorageMock;

describe('Auto Backup System', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('converts text and binary blob export files correctly to backup entries', async () => {
    const textBlob = new Blob(['PNG binary mock'], { type: 'image/png' });
    const b64 = await blobToBase64(textBlob);

    const exportFiles = [
      {
        path: 'Hệ thống AI.md',
        content: '# Hệ thống AI\n\nNội dung chi tiết kiến trúc.',
      },
      {
        path: 'Hệ thống AI/assets/arch.png',
        content: textBlob,
      },
    ];

    const entries = await convertExportFilesToBackupEntries(exportFiles);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      filename: 'Hệ thống AI.md',
      content: '# Hệ thống AI\n\nNội dung chi tiết kiến trúc.',
      is_base64: false,
    });
    expect(entries[1].filename).toBe('Hệ thống AI/assets/arch.png');
    expect(entries[1].is_base64).toBe(true);
    expect(entries[1].content).toBe(b64);
  });

  it('runs backup with MarkdownCollector, dedupes identical titles, and writes full content', async () => {
    const mockCollector: MarkdownCollector = {
      collect: vi.fn(async () => ({
        docs: [
          {
            id: 'doc-1',
            title: 'Sơ đồ hệ thống',
            markdown:
              '## Kiến trúc Microservices\n\n- API Gateway\n- Auth Service',
            assets: [],
          },
          {
            id: 'doc-2',
            title: 'Sơ đồ hệ thống',
            markdown: '## Kiến trúc Data Lake\n\n- Spark\n- BigQuery',
            assets: [],
          },
        ] as ExportDoc[],
        skipped: 0,
      })),
    };

    vi.mocked(invokeTauri).mockResolvedValueOnce({
      success: true,
      folder_path:
        'C:\\Users\\asus\\AppData\\Local\\AFFiNE Ca nhan\\Backups\\backup-2026-11-19',
      files_written: 2,
      total_backups_kept: 1,
      error: null,
    });

    const res = await runAutoBackupNow(mockCollector);
    expect(res.success).toBe(true);
    expect(res.files_written).toBe(2);

    expect(invokeTauri).toHaveBeenCalledTimes(1);
    const [[cmd, payload]] = vi.mocked(invokeTauri).mock.calls as unknown as [
      [
        string,
        {
          dateStr: string;
          files: Array<{ filename: string; content: string }>;
        },
      ],
    ];
    expect(cmd).toBe('save_backup');
    expect(payload.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.files).toHaveLength(2);

    // Verify deduplication: first is "Sơ đồ hệ thống.md", second is "Sơ đồ hệ thống (2).md"
    expect(payload.files[0].filename).toBe('Sơ đồ hệ thống.md');
    expect(payload.files[0].content).toContain('Kiến trúc Microservices');

    expect(payload.files[1].filename).toBe('Sơ đồ hệ thống (2).md');
    expect(payload.files[1].content).toContain('Kiến trúc Data Lake');

    // Only sets localStorage when succeeded
    expect(localStorage.getItem(LAST_AUTO_BACKUP_KEY)).toBe(payload.dateStr);
  });

  it('returns failure when collector returns no documents and does not update last backup date', async () => {
    const emptyCollector: MarkdownCollector = {
      collect: vi.fn(async () => ({ docs: [], skipped: 0 })),
    };

    const res = await runAutoBackupNow(emptyCollector);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(invokeTauri).not.toHaveBeenCalled();
    expect(localStorage.getItem(LAST_AUTO_BACKUP_KEY)).toBeNull();
  });

  it('checkAndRunScheduledAutoBackup skips if already backed up today', async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem(LAST_AUTO_BACKUP_KEY, today);

    const mockCollector: MarkdownCollector = {
      collect: vi.fn(),
    };

    const ran = await checkAndRunScheduledAutoBackup(mockCollector);
    expect(ran).toBe(false);
    expect(mockCollector.collect).not.toHaveBeenCalled();
  });
});
