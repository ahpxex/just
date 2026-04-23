use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{path::BaseDirectory, AppHandle, Manager};

const STATS_FILE: &str = ".just/stats.json";

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocStats {
    pub total_writing_ms: u64,
    pub total_keystrokes: u64,
    pub sessions_completed: u32,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatsDb {
    pub docs: HashMap<String, DocStats>,
}

fn stats_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .resolve("just", BaseDirectory::Document)
        .map_err(|e| e.to_string())?;
    Ok(root.join(STATS_FILE))
}

fn load_db(app: &AppHandle) -> Result<StatsDb, String> {
    let path = stats_path(app)?;
    if !path.exists() {
        return Ok(StatsDb::default());
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&text).unwrap_or_default())
}

fn save_db(app: &AppHandle, db: &StatsDb) -> Result<(), String> {
    let path = stats_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(db).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_stats(app: AppHandle) -> Result<StatsDb, String> {
    load_db(&app)
}

#[tauri::command]
pub fn read_doc_stats(app: AppHandle, path: String) -> Result<DocStats, String> {
    let db = load_db(&app)?;
    Ok(db.docs.get(&path).cloned().unwrap_or_default())
}

#[tauri::command]
pub fn record_session(
    app: AppHandle,
    path: String,
    writing_ms: u64,
    keystrokes: u64,
    completed: bool,
) -> Result<DocStats, String> {
    let mut db = load_db(&app)?;
    let entry = db.docs.entry(path).or_default();
    entry.total_writing_ms = entry.total_writing_ms.saturating_add(writing_ms);
    entry.total_keystrokes = entry.total_keystrokes.saturating_add(keystrokes);
    if completed {
        entry.sessions_completed = entry.sessions_completed.saturating_add(1);
    }
    let snapshot = entry.clone();
    save_db(&app, &db)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn request_exit() {
    std::process::exit(0);
}
