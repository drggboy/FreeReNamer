import type { FileInfo } from './type';
export type { FileInfo } from './type';

export async function getFileInfo(file: string): Promise<FileInfo> {
  if (__PLATFORM__ === __PLATFORM_TAURI__) {
    const { getFileInfo } = await import('./file.tauri');

    return getFileInfo(file);
  }

  if (__PLATFORM__ === __PLATFORM_WEB__) {
    const { getFileInfo } = await import('./file.web');

    return getFileInfo(file);
  }

  throw new Error('Not Implemented');
}

/**
 * 根据文件扩展名获取对应的MIME类型
 * @param ext - 文件扩展名（带点，如 .jpg）
 * @returns MIME类型字符串
 */
export function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif'
  };

  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}
