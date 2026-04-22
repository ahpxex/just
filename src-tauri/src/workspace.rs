use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{path::BaseDirectory, AppHandle, Manager};

const STATE_FILE: &str = ".just/state.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocMeta {
    pub path: String,
    pub title: String,
    pub excerpt: String,
    pub word_count: usize,
    pub modified_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub current_doc: Option<String>,
}

fn workspace_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve("just", BaseDirectory::Document)
        .map_err(|e| e.to_string())
}

fn ensure_workspace(app: &AppHandle) -> Result<PathBuf, String> {
    let root = workspace_root(app)?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join(".just/trash")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join(".just/media")).map_err(|e| e.to_string())?;
    Ok(root)
}

fn extract_title_and_excerpt(content: &str) -> (String, String) {
    let mut iter = content.lines().filter(|l| !l.trim().is_empty());
    let title = iter
        .next()
        .map(|l| l.trim_start_matches('#').trim().to_string())
        .unwrap_or_default();
    let excerpt: String = iter
        .next()
        .unwrap_or("")
        .trim()
        .chars()
        .take(80)
        .collect();
    (title, excerpt)
}

fn is_cjk(c: char) -> bool {
    matches!(
        c,
        '\u{3400}'..='\u{4DBF}'
            | '\u{4E00}'..='\u{9FFF}'
            | '\u{20000}'..='\u{2A6DF}'
            | '\u{3040}'..='\u{30FF}'
            | '\u{AC00}'..='\u{D7AF}'
    )
}

fn word_count(content: &str) -> usize {
    let mut count = 0usize;
    let mut in_word = false;
    for c in content.chars() {
        if is_cjk(c) {
            count += 1;
            in_word = false;
        } else if c.is_whitespace() || c.is_ascii_punctuation() {
            in_word = false;
        } else if !in_word {
            count += 1;
            in_word = true;
        }
    }
    count
}

fn file_modified_millis(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn build_meta(path: &Path) -> Result<DocMeta, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let (title, excerpt) = extract_title_and_excerpt(&content);
    Ok(DocMeta {
        path: path.to_string_lossy().to_string(),
        title,
        excerpt,
        word_count: word_count(&content),
        modified_at: file_modified_millis(path),
    })
}

fn new_filename(suffix: Option<u32>) -> String {
    let stamp = Local::now().format("%Y-%m-%d-%H%M%S");
    match suffix {
        Some(n) => format!("{}-{}.md", stamp, n),
        None => format!("{}.md", stamp),
    }
}

#[tauri::command]
pub fn workspace_init(app: AppHandle) -> Result<String, String> {
    let root = ensure_workspace(&app)?;
    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_docs(app: AppHandle) -> Result<Vec<DocMeta>, String> {
    let root = ensure_workspace(&app)?;
    let mut docs = Vec::new();
    for entry in fs::read_dir(&root).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().is_some_and(|e| e == "md") {
            if let Ok(m) = build_meta(&path) {
                docs.push(m);
            }
        }
    }
    docs.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(docs)
}

#[tauri::command]
pub fn read_doc(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_doc(path: String, content: String) -> Result<DocMeta, String> {
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    build_meta(Path::new(&path))
}

#[tauri::command]
pub fn create_doc(app: AppHandle) -> Result<DocMeta, String> {
    let root = ensure_workspace(&app)?;
    let mut path = root.join(new_filename(None));
    let mut n = 1u32;
    while path.exists() {
        path = root.join(new_filename(Some(n)));
        n += 1;
    }
    fs::write(&path, "").map_err(|e| e.to_string())?;
    build_meta(&path)
}

#[tauri::command]
pub fn delete_doc(app: AppHandle, path: String) -> Result<String, String> {
    let root = ensure_workspace(&app)?;
    let trash = root.join(".just/trash");
    let src = Path::new(&path);
    if !src.exists() {
        return Err("file not found".into());
    }
    let filename = src
        .file_name()
        .ok_or_else(|| "invalid path".to_string())?
        .to_string_lossy()
        .to_string();
    let stamp = Local::now().format("%Y-%m-%d-%H%M%S");
    let dest = trash.join(format!("{}__{}", stamp, filename));
    fs::rename(src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_doc(app: AppHandle, trash_path: String) -> Result<DocMeta, String> {
    let root = ensure_workspace(&app)?;
    let src = Path::new(&trash_path);
    if !src.exists() {
        return Err("trash file not found".into());
    }
    let filename = src
        .file_name()
        .ok_or_else(|| "invalid path".to_string())?
        .to_string_lossy()
        .to_string();
    // Trash filename format: "{YYYY-MM-DD-HHMMSS}__{original}"
    let original = filename
        .split_once("__")
        .map(|(_, rest)| rest)
        .unwrap_or(&filename);
    let mut dest = root.join(original);
    let mut n = 1u32;
    while dest.exists() {
        let stem = Path::new(original)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy();
        dest = root.join(format!("{}-restored-{}.md", stem, n));
        n += 1;
    }
    fs::rename(src, &dest).map_err(|e| e.to_string())?;
    build_meta(&dest)
}

#[tauri::command]
pub fn read_state(app: AppHandle) -> Result<AppState, String> {
    let root = ensure_workspace(&app)?;
    let state_path = root.join(STATE_FILE);
    if !state_path.exists() {
        return Ok(AppState::default());
    }
    let content = fs::read_to_string(&state_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_state(app: AppHandle, state: AppState) -> Result<(), String> {
    let root = ensure_workspace(&app)?;
    let state_path = root.join(STATE_FILE);
    let content = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&state_path, content).map_err(|e| e.to_string())
}
