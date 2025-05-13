import { queryOptions } from '@tanstack/react-query';
import { QueryType } from '../query';
import { getProfile } from '../profile';
import { execRules } from '../rule';
import { type FileSortConfig } from '../atoms';
import { isPlatformTauri, isFileSystemFileHandle, getWebFileInfo } from '../file';
import type { FileInfo } from '../file/type';

// 扩展的文件信息接口
interface FileInfoExtended extends FileInfo {}

// Tauri环境下的文件信息接口
interface FileInfoTauri extends FileInfo {}

export const fileItemInfoQueryOptions = (
  profileId: string,
  file: string,
  index: number,
  sortConfig?: FileSortConfig
) =>
  queryOptions({
    queryKey: [QueryType.FileItemInfo, { profileId, file, index, sortConfig }],
    queryFn: async () => {
      const profile = await getProfile(profileId);
      const fileInfo = await getFileInfo(file);
      const result = await execRules(
        profile?.rules?.filter((rule) => rule.enabled) ?? [],
        { fileInfo, index },
      );
      const preview = result === fileInfo.fullName ? null : result;
      
      // 计算排序后的索引
      const sortedIndex = index; // 默认保持原序
      
      return {
        profile,
        fileInfo,
        preview,
        sortedIndex,
        originalIndex: index,
      };
    },
  });

/**
 * 获取所有文件的排序顺序
 * @param files - 文件列表
 * @param sortConfig - 排序配置
 * @returns 排序后的索引数组
 */
export const getSortedFileIndices = async (
  files: string[] | FileSystemFileHandle[],
  sortConfig: FileSortConfig
) => {
  try {
    // 获取文件信息数组
    const fileInfos = await Promise.all(
      files.map(async (file, index) => {
        const info = await getFileInfo(file);
        return {
          info,
          originalIndex: index
        };
      })
    );
    
    // 根据不同排序方式排序
    let sortedInfos = [...fileInfos];
    
    if (sortConfig.type === 'name') {
      sortedInfos.sort((a, b) => {
        const result = a.info.fullName.localeCompare(b.info.fullName);
        return sortConfig.order === 'asc' ? result : -result;
      });
    } else if (sortConfig.type === 'time' && fileInfos.some(f => f.info.timestamp)) {
      sortedInfos.sort((a, b) => {
        const timeA = a.info.timestamp || 0;
        const timeB = b.info.timestamp || 0;
        const result = timeA - timeB;
        return sortConfig.order === 'asc' ? result : -result;
      });
    } else {
      // 按原始索引排序
      sortedInfos.sort((a, b) => {
        const result = a.originalIndex - b.originalIndex;
        return sortConfig.order === 'asc' ? result : -result;
      });
    }
    
    // 返回排序后的索引映射
    return sortedInfos.map(info => info.originalIndex);
  } catch (error) {
    console.error('排序出错:', error);
    // 发生错误时返回原始索引
    return Array.from({ length: files.length }, (_, i) => i);
  }
};

/**
 * 获取文件信息
 */
export async function getFileInfo(file: string | FileSystemFileHandle): Promise<FileInfoExtended> {
  // 检查是否在Tauri环境
  if (isPlatformTauri() && typeof file === 'string') {
    // Tauri环境下获取文件信息
    const { invoke } = await import('@tauri-apps/api');
    return invoke<FileInfoTauri>('get_file_info', { path: file });
  } else if (isFileSystemFileHandle(file)) {
    // Web环境下获取文件信息
    const fileInfo = await getWebFileInfo(file);
    return fileInfo;
  } else {
    throw new Error("不支持的文件类型");
  }
}
