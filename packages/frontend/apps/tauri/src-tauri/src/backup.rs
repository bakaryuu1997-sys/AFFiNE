use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct BackupFileEntry {
  pub filename: String,
  pub content: String,
  #[serde(default)]
  pub is_base64: bool,
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

/// Decodes standard base64 strings into raw bytes.
pub fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
  let input = input.trim();
  let mut buffer: u32 = 0;
  let mut bits: u8 = 0;
  let mut output = Vec::with_capacity((input.len() * 3) / 4);

  for &b in input.as_bytes() {
    let val = match b {
      b'A'..=b'Z' => b - b'A',
      b'a'..=b'z' => b - b'a' + 26,
      b'0'..=b'9' => b - b'0' + 52,
      b'+' => 62,
      b'/' => 63,
      b'=' => continue,
      b'\r' | b'\n' | b' ' | b'\t' => continue,
      _ => return Err(format!("Ký tự base64 không hợp lệ: {}", b as char)),
    };
    buffer = (buffer << 6) | (val as u32);
    bits += 6;
    if bits >= 8 {
      bits -= 8;
      output.push((buffer >> bits) as u8);
    }
  }
  Ok(output)
}

/// Validates that date_str strictly matches YYYY-MM-DD format to prevent path traversal.
pub fn validate_date_str(date_str: &str) -> Result<(), String> {
  if date_str.len() != 10 {
    return Err("Ngày sao lưu phải có định dạng YYYY-MM-DD".to_string());
  }
  let bytes = date_str.as_bytes();
  if bytes[4] != b'-' || bytes[7] != b'-' {
    return Err("Ngày sao lưu phải có định dạng YYYY-MM-DD".to_string());
  }
  for (idx, &b) in bytes.iter().enumerate() {
    if idx == 4 || idx == 7 {
      continue;
    }
    if !b.is_ascii_digit() {
      return Err("Ngày sao lưu chỉ được chứa chữ số".to_string());
    }
  }
  Ok(())
}

/// Sanitizes relative file paths, allowing safe nested subdirectories while strictly blocking traversal.
pub fn sanitize_relpath(rel_path: &str) -> Result<PathBuf, String> {
  let normalized = rel_path.replace('\\', "/");
  let mut safe_path = PathBuf::new();

  for segment in normalized.split('/') {
    let trimmed = segment.trim();
    if trimmed.is_empty() || trimmed == "." {
      continue;
    }
    if trimmed == ".." {
      return Err(format!("Đường dẫn không an toàn (chứa '..'): {rel_path}"));
    }
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    let mut clean_seg: String = trimmed
      .chars()
      .map(|c| if invalid_chars.contains(&c) { '_' } else { c })
      .collect();
    clean_seg = clean_seg.trim().to_string();
    if clean_seg.is_empty() {
      clean_seg = "file".to_string();
    }
    safe_path.push(clean_seg);
  }

  if safe_path.as_os_str().is_empty() {
    return Err("Đường dẫn tệp rỗng".to_string());
  }

  Ok(safe_path)
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

/// Performs a full workspace backup by writing sanitized Markdown and asset files into a date snapshot.
pub fn execute_workspace_backup(
  backup_root: &Path,
  date_str: &str,
  files: &[BackupFileEntry],
  max_retention: usize,
) -> Result<BackupResult, String> {
  validate_date_str(date_str)?;

  if files.is_empty() {
    return Err("Danh sách tệp sao lưu rỗng".to_string());
  }

  let target_folder = backup_root.join(format!("backup-{}", date_str));
  fs::create_dir_all(&target_folder).map_err(|e| format!("Không tạo được thư mục sao lưu: {e}"))?;

  let mut written = 0;
  let mut failed = 0;

  for file in files {
    let rel_path = match sanitize_relpath(&file.filename) {
      Ok(p) => p,
      Err(e) => {
        eprintln!("Bỏ qua tệp do đường dẫn không an toàn: {}", e);
        failed += 1;
        continue;
      }
    };

    let target_file = target_folder.join(rel_path);

    if let Some(parent) = target_file.parent() {
      if let Err(e) = fs::create_dir_all(parent) {
        eprintln!("Không tạo được thư mục cha {:?}: {}", parent, e);
        failed += 1;
        continue;
      }
    }

    let write_res = if file.is_base64 {
      match decode_base64(&file.content) {
        Ok(bytes) => fs::write(&target_file, bytes),
        Err(e) => {
          eprintln!("Lỗi giải mã base64 {:?}: {}", target_file, e);
          failed += 1;
          continue;
        }
      }
    } else {
      fs::write(&target_file, file.content.as_bytes())
    };

    if let Err(e) = write_res {
      eprintln!("Lỗi ghi tệp sao lưu {:?}: {}", target_file, e);
      failed += 1;
    } else {
      written += 1;
    }
  }

  let _ = rotate_old_backups(backup_root, max_retention);

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

  let success = written > 0 && failed == 0;
  let error = if !success {
    if written == 0 {
      Some(format!("Không ghi được tệp nào ({failed} lỗi)"))
    } else {
      Some(format!("Đã ghi {written} tệp, thất bại {failed} tệp"))
    }
  } else {
    None
  };

  Ok(BackupResult {
    success,
    folder_path: target_folder.to_string_lossy().to_string(),
    files_written: written,
    total_backups_kept: total_kept,
    error,
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
  fn test_validate_date_str() {
    assert!(validate_date_str("2026-11-19").is_ok());
    assert!(validate_date_str("2026-11-1").is_err());
    assert!(validate_date_str("2026/11/19").is_err());
    assert!(validate_date_str("../../etc/").is_err());
    assert!(validate_date_str("2026-11-ab").is_err());
  }

  #[test]
  fn test_sanitize_relpath() {
    let p = sanitize_relpath("Tài liệu họp 15-11.md").unwrap();
    assert_eq!(p.to_str().unwrap(), "Tài liệu họp 15-11.md");

    let p_nested = sanitize_relpath("Thư mục dự án/assets/sơ đồ.png").unwrap();
    let expected = PathBuf::from("Thư mục dự án").join("assets").join("sơ đồ.png");
    assert_eq!(p_nested, expected);

    assert!(sanitize_relpath("../../secret.txt").is_err());
    assert!(sanitize_relpath("folder/../escaped.md").is_err());
  }

  #[test]
  fn test_decode_base64() {
    let decoded = decode_base64("SGVsbG8gV29ybGQ=").unwrap();
    assert_eq!(String::from_utf8(decoded).unwrap(), "Hello World");

    let empty = decode_base64("").unwrap();
    assert!(empty.is_empty());

    assert!(decode_base64("invalid!*chars").is_err());
  }

  #[test]
  fn test_execute_workspace_backup_with_content_and_assets() {
    let tmp = unique_test_dir();
    let files = vec![
      BackupFileEntry {
        filename: "Kế hoạch sprint.md".to_string(),
        content: "# Kế hoạch sprint\n\nNội dung chi tiết dự án.".to_string(),
        is_base64: false,
      },
      BackupFileEntry {
        filename: "Thiết kế/assets/logo.png".to_string(),
        content: "SGVsbG8gUE5H".to_string(), // base64 for "Hello PNG"
        is_base64: true,
      },
    ];

    let res = execute_workspace_backup(&tmp, "2026-11-19", &files, 14).unwrap();
    assert!(res.success);
    assert_eq!(res.files_written, 2);
    assert_eq!(res.total_backups_kept, 1);
    assert!(res.error.is_none());

    let md_file = tmp.join("backup-2026-11-19").join("Kế hoạch sprint.md");
    assert!(md_file.exists());
    let md_content = fs::read_to_string(md_file).unwrap();
    assert!(md_content.contains("Nội dung chi tiết dự án."));

    let asset_file = tmp
      .join("backup-2026-11-19")
      .join("Thiết kế")
      .join("assets")
      .join("logo.png");
    assert!(asset_file.exists());
    let asset_content = fs::read(asset_file).unwrap();
    assert_eq!(String::from_utf8(asset_content).unwrap(), "Hello PNG");

    let _ = fs::remove_dir_all(&tmp);
  }

  #[test]
  fn test_backup_and_rotation_preserves_latest_14() {
    let tmp = unique_test_dir();
    fs::create_dir_all(&tmp).unwrap();

    for day in 1..=18 {
      let dir_name = format!("backup-2026-11-{:02}", day);
      fs::create_dir_all(tmp.join(&dir_name)).unwrap();
    }

    let status_before = query_backup_status(&tmp);
    assert_eq!(status_before.total_backups, 18);

    let pruned = rotate_old_backups(&tmp, 14).unwrap();
    assert_eq!(pruned, 4);

    let status_after = query_backup_status(&tmp);
    assert_eq!(status_after.total_backups, 14);
    assert_eq!(status_after.last_backup_date.as_deref(), Some("2026-11-18"));
    assert!(!tmp.join("backup-2026-11-01").exists());
    assert!(!tmp.join("backup-2026-11-04").exists());
    assert!(tmp.join("backup-2026-11-05").exists());
    assert!(tmp.join("backup-2026-11-18").exists());

    let _ = fs::remove_dir_all(&tmp);
  }
}
