import {
  type ExportDoc,
  type ExportFile,
  layoutMarkdownFiles,
} from '../markdown-export/utils/layout';
import { invokeTauri } from '../mcp-bridge/tauri';

export interface BackupFileEntry {
  filename: string;
  content: string;
  is_base64?: boolean;
}

export interface BackupResult {
  success: boolean;
  folder_path: string;
  files_written: number;
  total_backups_kept: number;
  error?: string | null;
}

export interface BackupStatus {
  backup_dir: string;
  total_backups: number;
  last_backup_date: string | null;
  backup_folders: string[];
}

export interface MarkdownCollector {
  collect(
    onProgress?: (progress: { done: number; total: number }) => void
  ): Promise<{ docs: ExportDoc[]; skipped: number }>;
}

export const LAST_AUTO_BACKUP_KEY = 'affine:last-auto-backup-date';

/**
 * Converts a browser Blob to a base64 encoded string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Transforms layout Markdown and asset files into Tauri backup entries.
 */
export async function convertExportFilesToBackupEntries(
  files: ExportFile[]
): Promise<BackupFileEntry[]> {
  const entries: BackupFileEntry[] = [];
  for (const file of files) {
    if (typeof file.content === 'string') {
      entries.push({
        filename: file.path,
        content: file.content,
        is_base64: false,
      });
    } else {
      const b64 = await blobToBase64(file.content);
      entries.push({
        filename: file.path,
        content: b64,
        is_base64: true,
      });
    }
  }
  return entries;
}

/**
 * Triggers an immediate full workspace backup using MarkdownExportService.
 * Properly exports all document content and attachments without empty files.
 */
export async function runAutoBackupNow(
  collector: MarkdownCollector,
  onProgress?: (progress: { done: number; total: number }) => void
): Promise<BackupResult> {
  const { docs } = await collector.collect(onProgress);
  if (!docs || docs.length === 0) {
    return {
      success: false,
      folder_path: '',
      files_written: 0,
      total_backups_kept: 0,
      error: 'Không có tài liệu nào để sao lưu trong không gian làm việc.',
    };
  }

  const exportFiles = layoutMarkdownFiles(docs);
  const backupEntries = await convertExportFilesToBackupEntries(exportFiles);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const res = (await invokeTauri('save_backup', {
    dateStr,
    files: backupEntries,
  })) as BackupResult;

  // Only record backup date if files were actually written successfully
  if (res.success && typeof localStorage !== 'undefined') {
    localStorage.setItem(LAST_AUTO_BACKUP_KEY, dateStr);
  }

  return res;
}

/**
 * Gets the current backup status from the Tauri shell.
 */
export async function fetchBackupStatus(): Promise<BackupStatus | null> {
  try {
    const res = (await invokeTauri('get_backup_status')) as BackupStatus;
    return res;
  } catch {
    return null;
  }
}

/**
 * Opens the backup directory in the OS native file explorer.
 */
export async function openBackupFolder(): Promise<void> {
  await invokeTauri('open_backup_folder');
}

/**
 * Automatically checks and runs daily backup once per calendar day.
 */
export async function checkAndRunScheduledAutoBackup(
  collector: MarkdownCollector
): Promise<boolean> {
  if (typeof localStorage === 'undefined') return false;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const lastBackup = localStorage.getItem(LAST_AUTO_BACKUP_KEY);
  if (lastBackup === todayStr) {
    return false; // Already backed up today
  }

  try {
    const res = await runAutoBackupNow(collector);
    return res.success;
  } catch (err) {
    console.error('Scheduled daily auto-backup failed:', err);
    return false;
  }
}
