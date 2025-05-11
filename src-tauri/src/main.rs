// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{ffi::OsStr, fs};
use walkdir::WalkDir;
use std::time::{UNIX_EPOCH, SystemTime};
use std::process::Command;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn rename(old: &str, new: &str) -> Result<(), String> {
    fs::rename(old, new).map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
fn exists(path: &str) -> bool {
    fs::metadata(path).is_ok()
}

#[tauri::command]
fn is_file(path: &str) -> bool {
    exists(path) && fs::metadata(path).unwrap().is_file()
}

#[tauri::command]
fn read_dir(path: &str) -> Result<Vec<String>, String> {
    let mut files = Vec::new();

    for entry in WalkDir::new(path) {
        let entry = entry.map_err(|err| err.to_string())?;

        if entry.file_type().is_file() {
            let file_path = match entry.path().to_str() {
                Some(path) => path,
                None => continue,
            };

            files.push(file_path.to_string());
        }
    }

    Ok(files)
}

#[tauri::command]
fn basename(path: &str) -> String {
    let path = std::path::Path::new(path)
        .file_stem()
        .unwrap_or(OsStr::new(""));

    path.to_string_lossy().to_string()
}

#[tauri::command]
fn get_file_time(path: &str) -> Result<u64, String> {
    let metadata = fs::metadata(path).map_err(|err| err.to_string())?;
    
    // 尝试获取修改时间
    if let Ok(time) = metadata.modified() {
        if let Ok(duration) = time.duration_since(UNIX_EPOCH) {
            return Ok(duration.as_secs());
        }
    }
    
    // 如果修改时间获取失败，尝试获取创建时间
    if let Ok(time) = metadata.created() {
        if let Ok(duration) = time.duration_since(UNIX_EPOCH) {
            return Ok(duration.as_secs());
        }
    }
    
    // 如果都失败，返回当前时间
    if let Ok(duration) = SystemTime::now().duration_since(UNIX_EPOCH) {
        return Ok(duration.as_secs());
    }
    
    // 最后的兜底
    Ok(0)
}

/// 使用系统默认应用打开文件
#[tauri::command]
fn open_with_default_app(path: &str) -> Result<(), String> {
    let path_obj = std::path::Path::new(path);
    
    if !path_obj.exists() {
        return Err(format!("文件不存在: {}", path));
    }
    
    #[cfg(target_os = "windows")]
    {
        // 在Windows上使用ShellExecute等效命令启动默认程序
        Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", path])
            .spawn()
            .map_err(|e| format!("无法打开文件: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("无法打开文件: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("无法打开文件: {}", e))?;
    }
    
    Ok(())
}

/// 使用指定的应用程序打开文件
#[tauri::command]
fn open_with_custom_app(app_path: &str, file_path: &str) -> Result<(), String> {
    let app_path_obj = std::path::Path::new(app_path);
    let file_path_obj = std::path::Path::new(file_path);
    
    if !app_path_obj.exists() {
        return Err(format!("应用程序不存在: {}", app_path));
    }
    
    if !file_path_obj.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }
    
    Command::new(app_path)
        .arg(file_path)
        .spawn()
        .map_err(|e| format!("无法使用指定应用程序打开文件: {}", e))?;
    
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            rename, exists, is_file, read_dir, basename, get_file_time,
            open_with_default_app, open_with_custom_app
        ])
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
