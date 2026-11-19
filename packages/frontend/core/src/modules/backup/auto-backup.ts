import { invokeTauri } from '../mcp-bridge/tauri';

export interface BackupFileEntry {
  filename: string;
  content: string;
}

export interface BackupResult {
  success: boolean;
  folder_path: string;
  files_written: usize;
  total_backups_kept: usize;
  error?: string | null;
}

export interface BackupStatus {
  backup_dir: string;
  total_backups: number;
  last_backup_date: string | null;
  backup_folders: string[];
}

type usize = number;

interface MinimalDocRecord {
  id: string;
  title$: { value: string };
  trash$: { value: boolean };
}

interface MinimalDocCollection {
  getDoc?: (id: string) => {
    getBlocks?: () => Array<{
      model?: {
        flavour?: string;
        text?: { toString: () => string };
        title?: string;
        spec?: unknown;
      };
    }>;
  } | null;
}

const LAST_AUTO_BACKUP_KEY = 'affine:last-auto-backup-date';

/**
 * Transforms active workspace documents into clean Markdown files for backup.
 */
export function prepareBackupFiles(
  docs: MinimalDocRecord[],
  collection?: MinimalDocCollection | null
): BackupFileEntry[] {
  const activeDocs = docs.filter(d => !d.trash$.value);
  const files: BackupFileEntry[] = [];

  for (const doc of activeDocs) {
    const rawTitle = doc.title$.value.trim();
    const title = rawTitle.length > 0 ? rawTitle : 'Untitled';
    const lines: string[] = [`# ${title}\n`];

    const bsDoc = collection?.getDoc ? collection.getDoc(doc.id) : null;
    if (bsDoc?.getBlocks) {
      const blocks = bsDoc.getBlocks();
      for (const b of blocks) {
        const text = b.model?.text?.toString();
        if (text && text.trim().length > 0) {
          lines.push(text);
        } else if (b.model?.flavour === 'affine:system-diagram') {
          lines.push(
            `\n> [!NOTE] Sơ đồ hệ thống kiến trúc: ${b.model.title || title}\n`
          );
        }
      }
    }

    files.push({
      filename: `${title}.md`,
      content: lines.join('\n\n'),
    });
  }

  return files;
}

/**
 * Triggers an immediate full workspace backup to the local filesystem.
 */
export async function runAutoBackupNow(
  docs: MinimalDocRecord[],
  collection?: MinimalDocCollection | null
): Promise<BackupResult> {
  const files = prepareBackupFiles(docs, collection);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const res = (await invokeTauri('save_backup', {
    dateStr,
    files,
  })) as BackupResult;

  if (typeof localStorage !== 'undefined') {
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
  docs: MinimalDocRecord[],
  collection?: MinimalDocCollection | null
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
    await runAutoBackupNow(docs, collection);
    return true;
  } catch (err) {
    console.error('Scheduled daily auto-backup failed:', err);
    return false;
  }
}
