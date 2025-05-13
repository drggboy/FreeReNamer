import type { FileInfo } from './type';
export type { FileInfo } from './type';

/**
 * 判断当前是否为Tauri平台
 * @returns 是否为Tauri平台
 */
export function isPlatformTauri(): boolean {
  return __PLATFORM__ === __PLATFORM_TAURI__;
}

/**
 * 判断是否为FileSystemFileHandle类型
 * @param file - 待检查的文件对象
 * @returns 是否为FileSystemFileHandle类型
 */
export function isFileSystemFileHandle(file: any): file is FileSystemFileHandle {
  return typeof FileSystemFileHandle !== 'undefined' && 
         file instanceof FileSystemFileHandle;
}

/**
 * 获取Web环境下的文件信息
 * @param fileHandle - 文件句柄
 * @returns 文件信息对象
 */
export async function getWebFileInfo(fileHandle: FileSystemFileHandle): Promise<FileInfo> {
  const { getFileInfo: getWebFileInfoInternal } = await import('./file.web');
  return getWebFileInfoInternal(fileHandle);
}

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
