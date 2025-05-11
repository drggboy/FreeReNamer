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
 * 获取文件信息
 * @param file - 文件路径
 * @returns 文件信息对象，包含名称、扩展名和时间信息
 */
export async function getFileInfo(file: string): Promise<FileInfo> {
  const ext = await getExt(file);
  const name = await getBasename(file);
  const fullName = `${name}${ext}`;
  
  try {
    const { invoke } = await import('@tauri-apps/api');
    const timestamp = await invoke<number>('get_file_time', { path: file });
    const timeString = formatTimestamp(timestamp);
    
    return { name, ext, fullName, timestamp, timeString };
  } catch (err) {
    return { name, ext, fullName };
  }
}
