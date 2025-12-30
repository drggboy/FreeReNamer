// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{ffi::OsStr, fs};
use walkdir::WalkDir;
use std::time::{UNIX_EPOCH, SystemTime};
use std::process::Command;
use serde_json;
use chrono;
use base64;
use image::{RgbImage, ImageBuffer, Rgb};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn rename(old: &str, new: &str) -> Result<(), String> {
    // 检查目标文件是否已存在
    if std::path::Path::new(new).exists() {
        return Err(format!("目标文件已存在: {}", new));
    }
    
    fs::rename(old, new).map_err(|err| err.to_string())?;

    Ok(())
}

/// 生成不冲突的文件名，如果目标文件名已存在，则自动添加序号
#[tauri::command]
fn get_safe_filename(dir: &str, desired_name: &str) -> Result<String, String> {
    let desired_path = std::path::Path::new(dir).join(desired_name);
    
    // 如果目标文件不存在，直接返回原名
    if !desired_path.exists() {
        return Ok(desired_name.to_string());
    }
    
    // 解析文件名和扩展名
    let path_obj = std::path::Path::new(desired_name);
    let file_stem = path_obj.file_stem()
        .unwrap_or(std::ffi::OsStr::new(""))
        .to_string_lossy();
    let extension = path_obj.extension()
        .map(|ext| format!(".{}", ext.to_string_lossy()))
        .unwrap_or_default();
    
    // 尝试添加序号直到找到不冲突的文件名
    for i in 1..=9999 {
        let new_name = format!("{}({}){}", file_stem, i, extension);
        let new_path = std::path::Path::new(dir).join(&new_name);
        
        if !new_path.exists() {
            return Ok(new_name);
        }
    }
    
    Err("无法生成不冲突的文件名".to_string())
}

/// 生成临时文件名，用于两阶段重命名
#[tauri::command]
fn generate_temp_filename(dir: &str, original_name: &str) -> Result<String, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    // 解析原始文件名和扩展名
    let path_obj = std::path::Path::new(original_name);
    let file_stem = path_obj.file_stem()
        .unwrap_or(std::ffi::OsStr::new(""))
        .to_string_lossy();
    let extension = path_obj.extension()
        .map(|ext| format!(".{}", ext.to_string_lossy()))
        .unwrap_or_default();
    
    // 使用时间戳生成临时文件名
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    
    // 尝试不同的临时名称直到找到不冲突的
    for i in 0..1000 {
        let temp_name = format!("~temp_{}_{}{}{}", file_stem, timestamp, i, extension);
        let temp_path = std::path::Path::new(dir).join(&temp_name);
        
        if !temp_path.exists() {
            return Ok(temp_name);
        }
    }
    
    Err("无法生成临时文件名".to_string())
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

/// 使用系统文件浏览器打开文件夹
#[tauri::command]
fn open_folder_in_explorer(folder_path: &str) -> Result<(), String> {
    let path_obj = std::path::Path::new(folder_path);
    
    if !path_obj.exists() {
        return Err(format!("文件夹不存在: {}", folder_path));
    }
    
    if !path_obj.is_dir() {
        return Err(format!("路径不是文件夹: {}", folder_path));
    }
    
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(folder_path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(folder_path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(folder_path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }
    
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
    
    // 获取时间戳与文件大小
    let metadata = fs::metadata(path).map_err(|err| err.to_string())?;
    let size = metadata.len();
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
    
    // 判断是否为视频文件
    let video_extensions = [
        ".mp4", ".avi", ".mov", ".wmv", ".flv", 
        ".webm", ".mkv", ".m4v", ".3gp", ".ogv"
    ];
    let is_video = !ext_with_dot.is_empty() && video_extensions.contains(&ext_with_dot.to_lowercase().as_str());
    
    // 构建返回数据
    let mut result = serde_json::json!({
        "name": name,
        "ext": ext_with_dot,
        "fullName": full_name,
        "size": size,
        "isImage": is_image,
        "isVideo": is_video
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

// 生成视频缩略图（基于视频图标的占位符）
#[tauri::command]
fn generate_video_thumbnail(
    path: &str,
    width: u32,
    height: u32,
    _seek_time: f64,
) -> Result<String, String> {
    use image::{RgbImage, ImageBuffer, Rgb};
    
    // 检查文件是否存在
    if !std::path::Path::new(path).exists() {
        return Err(format!("视频文件不存在: {}", path));
    }

    // 创建一个渐变背景的视频占位符图像
    let mut img: RgbImage = ImageBuffer::new(width, height);
    
    // 创建深蓝到黑色的渐变背景
    for (_x, y, pixel) in img.enumerate_pixels_mut() {
        let gradient_factor = (y as f32 / height as f32) * 0.7 + 0.3;
        let blue_value = (30.0 * gradient_factor) as u8;
        let green_value = (45.0 * gradient_factor) as u8;
        let red_value = (25.0 * gradient_factor) as u8;
        *pixel = Rgb([red_value, green_value, blue_value]);
    }
    
    // 在中心绘制播放图标
    let center_x = width / 2;
    let center_y = height / 2;
    let icon_size = std::cmp::min(width, height) / 4;
    
    // 绘制圆形背景
    let circle_radius = (icon_size as f32 * 1.2) as u32;
    for y in 0..height {
        for x in 0..width {
            let dx = x as i32 - center_x as i32;
            let dy = y as i32 - center_y as i32;
            let distance_squared = (dx * dx + dy * dy) as f32;
            let radius_squared = (circle_radius * circle_radius) as f32;
            
            if distance_squared <= radius_squared {
                // 半透明白色圆形背景
                let alpha = 1.0 - (distance_squared / radius_squared);
                let brightness = (alpha * 80.0) as u8;
                if let Some(pixel) = img.get_pixel_mut_checked(x, y) {
                    let current = pixel.0;
                    *pixel = Rgb([
                        current[0].saturating_add(brightness / 3),
                        current[1].saturating_add(brightness / 3),
                        current[2].saturating_add(brightness / 3)
                    ]);
                }
            }
        }
    }
    
    // 绘制三角形播放图标
    let triangle_height = icon_size;
    let triangle_width = (icon_size as f32 * 0.8) as u32;
    
    for y in (center_y.saturating_sub(triangle_height/2))..=(center_y + triangle_height/2) {
        for x in center_x.saturating_sub(triangle_width/3)..=center_x + triangle_width {
            if x < width && y < height {
                let dx = x as i32 - center_x as i32 + (triangle_width / 3) as i32;
                let dy = y as i32 - center_y as i32;
                
                // 三角形公式：在三角形内部
                let max_x_for_y = ((triangle_height as i32 / 2 - dy.abs()) as f32 * 
                    triangle_width as f32 / triangle_height as f32) as i32;
                
                if dx >= 0 && dx <= max_x_for_y && dy.abs() <= triangle_height as i32 / 2 {
                    if let Some(pixel) = img.get_pixel_mut_checked(x, y) {
                        *pixel = Rgb([255, 255, 255]); // 白色播放图标
                    }
                }
            }
        }
    }
    
    // 添加文件格式标识
    let path_obj = std::path::Path::new(path);
    if let Some(extension) = path_obj.extension() {
        let _ext_str = extension.to_string_lossy().to_uppercase();
        
        // 在右下角添加格式标识（简单的矩形背景加文字效果）
        let text_width = std::cmp::min(width / 3, 40);
        let text_height = std::cmp::min(height / 6, 12);
        let text_x = width.saturating_sub(text_width + 5);
        let text_y = height.saturating_sub(text_height + 5);
        
        // 绘制半透明背景矩形
        for y in text_y..=(text_y + text_height) {
            for x in text_x..=(text_x + text_width) {
                if x < width && y < height {
                    if let Some(pixel) = img.get_pixel_mut_checked(x, y) {
                        *pixel = Rgb([0, 0, 0]); // 黑色背景
                    }
                }
            }
        }
        
        // 简单的白色边框
        for x in text_x..=(text_x + text_width) {
            if text_y < height && x < width {
                if let Some(pixel) = img.get_pixel_mut_checked(x, text_y) {
                    *pixel = Rgb([255, 255, 255]);
                }
            }
            if (text_y + text_height) < height && x < width {
                if let Some(pixel) = img.get_pixel_mut_checked(x, text_y + text_height) {
                    *pixel = Rgb([255, 255, 255]);
                }
            }
        }
        for y in text_y..=(text_y + text_height) {
            if y < height && text_x < width {
                if let Some(pixel) = img.get_pixel_mut_checked(text_x, y) {
                    *pixel = Rgb([255, 255, 255]);
                }
            }
            if y < height && (text_x + text_width) < width {
                if let Some(pixel) = img.get_pixel_mut_checked(text_x + text_width, y) {
                    *pixel = Rgb([255, 255, 255]);
                }
            }
        }
    }
    
    // 将图像编码为JPEG并转换为base64
    let mut buffer = Vec::new();
    {
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, 80);
        encoder.encode(
            &img.as_raw(),
            width,
            height,
            image::ColorType::Rgb8
        ).map_err(|e| format!("图像编码失败: {}", e))?;
    }
    
    let base64_string = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buffer);
    Ok(base64_string)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            rename, exists, is_file, read_dir, basename, get_file_time,
            open_with_default_app, open_with_custom_app, get_file_info,
            open_folder_in_explorer, get_safe_filename, generate_temp_filename,
            generate_video_thumbnail
        ])
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
