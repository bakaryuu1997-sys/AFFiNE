use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct BackupFileEntry {
  pub filename: String,
  pub content: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct BackupResult {
  pub success: bool,
  pub folder_path: String,
  pub files_written: usize,
  pub total_backups_kept: usize,
  pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct BackupStatus {
  pub backup_dir: String,
  pub total_backups: usize,
  pub last_backup_date: Option<String>,
  pub backup_folders: Vec<String>,
}

/// Sanitizes doc titles into safe Windows / POSIX filenames.
pub fn sanitize_filename(name: &str) -> String {
  let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
  let mut clean: String = name
    .chars()
    .map(|c| if invalid_chars.contains(&c) { '_' } else { c })
    .collect();

  clean = clean.trim().to_string();
  if clean.is_empty() {
    clean = "Untitled".to_string();
  }

  // Cap length to prevent MAX_PATH issues on Windows
  if clean.chars().count() > 80 {
    clean = clean.chars().take(80).collect();
  }

  if !clean.ends_with(".md") {
    clean.push_str(".md");
  }

  clean
}

/// Returns the persistent local backup root directory.
pub fn get_default_backup_dir() -> PathBuf {
  #[cfg(target_os = "windows")]
  {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
      return PathBuf::from(local_app_data).join("AFFiNE Ca nhan").join("Backups");
    }
  }

  if let Ok(home) = std::env::var("HOME") {
    PathBuf::from(home)
      .join(".local")
      .join("share")
      .join("AFFiNE Ca nhan")
      .join("Backups")
  } else {
    PathBuf::from("Backups")
  }
}

/// Keeps the latest `max_keep` backup snapshots (typically 7-14), pruning older ones.
pub fn rotate_old_backups(backup_root: &Path, max_keep: usize) -> Result<usize, String> {
  if !backup_root.exists() {
    return Ok(0);
  }

  let mut backup_dirs: Vec<PathBuf> = Vec::new();
  let entries = fs::read_dir(backup_root).map_err(|e| e.to_string())?;

  for entry in entries.flatten() {
    let path = entry.path();
    if path.is_dir() {
      if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name.starts_with("backup-") {
          backup_dirs.push(path);
        }
      }
    }
  }

  // Sort ascending by folder name (which contains YYYY-MM-DD)
  backup_dirs.sort();

  let mut pruned = 0;
  if backup_dirs.len() > max_keep {
    let to_remove = backup_dirs.len() - max_keep;
    for dir in backup_dirs.iter().take(to_remove) {
      if let Err(e) = fs::remove_dir_all(dir) {
        eprintln!("Failed to prune old backup folder {:?}: {}", dir, e);
      } else {
        pruned += 1;
      }
    }
  }

  Ok(pruned)
}

/// Performs a full workspace backup by writing sanitized Markdown files into a date snapshot.
pub fn execute_workspace_backup(
  backup_root: &Path,
  date_str: &str,
  files: &[BackupFileEntry],
  max_retention: usize,
) -> Result<BackupResult, String> {
  let target_folder = backup_root.join(format!("backup-{}", date_str));
  fs::create_dir_all(&target_folder).map_err(|e| format!("Không tạo được thư mục sao lưu: {e}"))?;

  let mut written = 0;
  for file in files {
    let clean_name = sanitize_filename(&file.filename);
    let target_file = target_folder.join(clean_name);
    if let Err(e) = fs::write(&target_file, &file.content) {
      eprintln!("Lỗi ghi file sao lưu {:?}: {}", target_file, e);
    } else {
      written += 1;
    }
  }

  let _ = rotate_old_backups(backup_root, max_retention);

  // Count remaining backup folders
  let mut total_kept = 0;
  if let Ok(entries) = fs::read_dir(backup_root) {
    for entry in entries.flatten() {
      if entry.path().is_dir() {
        let name_os = entry.file_name();
        if let Some(name) = name_os.to_str() {
          if name.starts_with("backup-") {
            total_kept += 1;
          }
        }
      }
    }
  }

  Ok(BackupResult {
    success: true,
    folder_path: target_folder.to_string_lossy().to_string(),
    files_written: written,
    total_backups_kept: total_kept,
    error: None,
  })
}

/// Queries current backup directory status and history.
pub fn query_backup_status(backup_root: &Path) -> BackupStatus {
  let mut folders = Vec::new();
  if let Ok(entries) = fs::read_dir(backup_root) {
    for entry in entries.flatten() {
      if entry.path().is_dir() {
        let name_os = entry.file_name();
        if let Some(name) = name_os.to_str() {
          if name.starts_with("backup-") {
            folders.push(name.to_string());
          }
        }
      }
    }
  }
  folders.sort();

  let last_backup_date = folders.last().map(|s| s.trim_start_matches("backup-").to_string());

  BackupStatus {
    backup_dir: backup_root.to_string_lossy().to_string(),
    total_backups: folders.len(),
    last_backup_date,
    backup_folders: folders,
  }
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn save_backup(
  window: tauri::WebviewWindow,
  date_str: String,
  files: Vec<BackupFileEntry>,
) -> Result<BackupResult, String> {
  crate::ensure_trusted_window(&window)?;
  let root = get_default_backup_dir();
  execute_workspace_backup(&root, &date_str, &files, 14)
}

#[tauri::command]
pub fn get_backup_status(window: tauri::WebviewWindow) -> Result<BackupStatus, String> {
  crate::ensure_trusted_window(&window)?;
  let root = get_default_backup_dir();
  Ok(query_backup_status(&root))
}

#[tauri::command]
pub fn open_backup_folder(window: tauri::WebviewWindow) -> Result<(), String> {
  crate::ensure_trusted_window(&window)?;
  let root = get_default_backup_dir();
  let _ = fs::create_dir_all(&root);

  #[cfg(target_os = "windows")]
  {
    let _ = std::process::Command::new("explorer").arg(&root).spawn();
  }
  #[cfg(target_os = "macos")]
  {
    let _ = std::process::Command::new("open").arg(&root).spawn();
  }
  #[cfg(target_os = "linux")]
  {
    let _ = std::process::Command::new("xdg-open").arg(&root).spawn();
  }

  Ok(())
}

// ---------------------------------------------------------------------------
// Unit Tests (TDD)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
  use super::*;
  use std::env::temp_dir;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn unique_test_dir() -> PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    temp_dir().join(format!("affine-backup-test-{}", nanos))
  }

  #[test]
  fn test_sanitize_filename() {
    assert_eq!(
      sanitize_filename("Kiến trúc: Web & API / Cloud*"),
      "Kiến trúc_ Web & API _ Cloud_.md"
    );
    assert_eq!(sanitize_filename("   "), "Untitled.md");
    assert_eq!(sanitize_filename("Tài liệu họp 15-11.md"), "Tài liệu họp 15-11.md");
  }

  #[test]
  fn test_backup_and_rotation_preserves_latest_14() {
    let tmp = unique_test_dir();
    fs::create_dir_all(&tmp).unwrap();

    // Create 18 dummy backup folders (dates 2026-11-01 through 2026-11-18)
    for day in 1..=18 {
      let dir_name = format!("backup-2026-11-{:02}", day);
      fs::create_dir_all(tmp.join(&dir_name)).unwrap();
    }

    let status_before = query_backup_status(&tmp);
    assert_eq!(status_before.total_backups, 18);

    // Run rotation with max_keep = 14
    let pruned = rotate_old_backups(&tmp, 14).unwrap();
    assert_eq!(pruned, 4);

    let status_after = query_backup_status(&tmp);
    assert_eq!(status_after.total_backups, 14);
    assert_eq!(status_after.last_backup_date.as_deref(), Some("2026-11-18"));
    // Oldest 4 (01, 02, 03, 04) should be pruned
    assert!(!tmp.join("backup-2026-11-01").exists());
    assert!(!tmp.join("backup-2026-11-04").exists());
    // Newest should be preserved
    assert!(tmp.join("backup-2026-11-05").exists());
    assert!(tmp.join("backup-2026-11-18").exists());

    let _ = fs::remove_dir_all(&tmp);
  }

  #[test]
  fn test_execute_workspace_backup_writes_markdown() {
    let tmp = unique_test_dir();
    let files = vec![
      BackupFileEntry {
        filename: "Kế hoạch phát triển.md".to_string(),
        content: "# Kế hoạch\n\nNội dung chi tiết dự án.".to_string(),
      },
      BackupFileEntry {
        filename: "Kiến trúc hệ thống".to_string(),
        content: "# Kiến trúc\n\nSơ đồ Microservices.".to_string(),
      },
    ];

    let res = execute_workspace_backup(&tmp, "2026-11-19", &files, 14).unwrap();
    assert!(res.success);
    assert_eq!(res.files_written, 2);
    assert_eq!(res.total_backups_kept, 1);

    let written_file = tmp.join("backup-2026-11-19").join("Kế hoạch phát triển.md");
    assert!(written_file.exists());
    let content = fs::read_to_string(written_file).unwrap();
    assert!(content.contains("Nội dung chi tiết dự án."));

    let _ = fs::remove_dir_all(&tmp);
  }
}
