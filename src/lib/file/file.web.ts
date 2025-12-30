import { extname, basename } from 'path-browserify';
import type { FileInfo } from './type';

export async function getExt(file: string): Promise<string> {
  try {
    return extname(file);
  } catch (error) {
    return '';
  }
}

export async function getBasename(file: string, ext: string): Promise<string> {
  try {
    return basename(file, ext);
  } catch (err) {
    return '';
  }
}

/**
 * 格式化时间戳为可读的时间字符串
 * @param timestamp - UNIX时间戳（毫秒）
 * @returns 格式化后的时间字符串
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
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
 * @param file - 文件句柄或路径
 * @returns 文件信息对象，包含名称、扩展名和时间信息
 */
export async function getFileInfo(file: string | FileSystemFileHandle): Promise<FileInfo> {
  let ext = '';
  let name = '';
  let timestamp: number | undefined;
  let size: number | undefined;
  
  if (typeof file === 'string') {
    ext = await getExt(file);
    name = await getBasename(file, ext);
  } else {
    // 处理FileSystemFileHandle
    const fileObj = await file.getFile();
    name = fileObj.name.replace(/\.[^/.]+$/, ''); // 移除扩展名
    ext = fileObj.name.match(/\.[^/.]+$/)?.[0] || '';
    timestamp = fileObj.lastModified;
    size = fileObj.size;
  }
  
  const fullName = `${name}${ext}`;
  const timeString = timestamp ? formatTimestamp(timestamp) : undefined;
  const isImage = isImageFile(ext);
  const isVideo = isVideoFile(ext);
  
  return { name, ext, fullName, timestamp, timeString, size, isImage, isVideo };
}
