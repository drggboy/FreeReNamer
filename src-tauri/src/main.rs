// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{ffi::OsStr, fs};
use walkdir::WalkDir;
use std::time::{UNIX_EPOCH, SystemTime};
use std::process::Command;
use serde_json;
use chrono;

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

// 获取文件信息
#[tauri::command]
fn get_file_info(path: &str) -> Result<serde_json::Value, String> {
    let path_obj = std::path::Path::new(path);
    
    if !path_obj.exists() {
        return Err(format!("文件不存在: {}", path));
    }
    
    // 获取文件名（带扩展名）
    let full_name = path_obj.file_name()
        .unwrap_or(OsStr::new(""))
        .to_string_lossy()
        .to_string();
    
    // 获取文件扩展名
    let ext = path_obj.extension()
        .unwrap_or(OsStr::new(""))
        .to_string_lossy()
        .to_string();
    
    // 如果有扩展名，带上前缀点号
    let ext_with_dot = if !ext.is_empty() {
        format!(".{}", ext)
    } else {
        ext
    };
    
    // 获取文件名（不带扩展名）
    let name = path_obj.file_stem()
        .unwrap_or(OsStr::new(""))
        .to_string_lossy()
        .to_string();
    
    // 获取时间戳
    let metadata = fs::metadata(path).map_err(|err| err.to_string())?;
    let mut timestamp = None;
    let mut time_string = None;
    
    // 尝试获取修改时间
    if let Ok(time) = metadata.modified() {
        if let Ok(duration) = time.duration_since(UNIX_EPOCH) {
            timestamp = Some(duration.as_millis() as i64);
            
            // 格式化时间字符串 (简单实现，可根据需要修改)
            let secs = duration.as_secs();
            let dt = chrono::DateTime::from_timestamp(secs as i64, 0)
                .unwrap_or(chrono::DateTime::from_timestamp(0, 0).unwrap());
            time_string = Some(dt.format("%Y-%m-%d %H:%M:%S").to_string());
        }
    }
    
    // 判断是否为图片文件
    let image_extensions = [
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", 
        ".webp", ".tiff", ".tif", ".svg", ".avif"
    ];
    let is_image = !ext_with_dot.is_empty() && image_extensions.contains(&ext_with_dot.to_lowercase().as_str());
    
    // 构建返回数据
    let mut result = serde_json::json!({
        "name": name,
        "ext": ext_with_dot, 
        "fullName": full_name,
        "isImage": is_image
    });
    
    // 添加可选字段
    if let Some(ts) = timestamp {
        result["timestamp"] = serde_json::json!(ts);
    }
    
    if let Some(ts_str) = time_string {
        result["timeString"] = serde_json::json!(ts_str);
    }
    
    Ok(result)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            rename, exists, is_file, read_dir, basename, get_file_time,
            open_with_default_app, open_with_custom_app, get_file_info
        ])
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
