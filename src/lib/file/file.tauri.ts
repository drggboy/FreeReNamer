import { extname } from '@tauri-apps/api/path';
import type { FileInfo } from './type';

export async function getExt(file: string): Promise<string> {
  try {
    return `.${await extname(file)}`;
  } catch (error) {
    return '';
  }
}

export async function getBasename(file: string): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api');

    return await invoke('basename', { path: file });
  } catch (err) {
    return '';
  }
}

/**
 * 格式化时间戳为可读的时间字符串
 * @param timestamp - UNIX时间戳（秒）
 * @returns 格式化后的时间字符串
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

/**
 * 检查文件是否为图片
 * @param ext - 文件扩展名（带点，如 .jpg）
 * @returns 是否为图片文件
 */
export function isImageFile(ext: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.svg', '.avif'];
  return imageExtensions.includes(ext.toLowerCase());
}

/**
 * 检查文件是否为视频
 * @param ext - 文件扩展名（带点，如 .mp4）
 * @returns 是否为视频文件
 */
export function isVideoFile(ext: string): boolean {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.ogv'];
  return videoExtensions.includes(ext.toLowerCase());
}

/**
 * 获取文件信息
 * @param file - 文件路径
 * @returns 文件信息对象，包含名称、扩展名和时间信息
 */
export async function getFileInfo(file: string): Promise<FileInfo> {
  const ext = await getExt(file);
  const name = await getBasename(file);
  const fullName = `${name}${ext}`;
  const isImage = isImageFile(ext);
  const isVideo = isVideoFile(ext);
  
  try {
    const { invoke } = await import('@tauri-apps/api');
    const timestamp = await invoke<number>('get_file_time', { path: file });
    const timeString = formatTimestamp(timestamp);
    
    return { name, ext, fullName, timestamp, timeString, isImage, isVideo };
  } catch (err) {
    return { name, ext, fullName, isImage, isVideo };
  }
}
