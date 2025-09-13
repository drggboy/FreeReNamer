import { useQuery } from '@tanstack/react-query';
import { useMemo, useCallback, useState, useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import { fileItemInfoQueryOptions } from '@/lib/queries/file';
import { atomStore, selectedFilesAtom, imageViewerAppAtom, filesAtom, selectedThumbnailAtom, type FileSortConfig, type ColumnWidths, type FilesAtomTauri } from '@/lib/atoms';
import { Checkbox } from '../ui/checkbox';
import { useAtomValue } from 'jotai';
import { Image, ExternalLink, Lock, X } from 'lucide-react';
import { Input } from '../ui/input';
import { toast } from 'sonner';

export interface FileItemProps {
  file: string;
  profileId: string;
  index: number;
  sortConfig: FileSortConfig;
  columnWidths: ColumnWidths;
  onPendingStateChange?: () => void;
}

export interface FileItemHandle {
  executeRename: () => Promise<boolean>;
  hasPendingRename: () => boolean;
}

// 创建全局缩略图缓存对象
const thumbnailCache = new Map<string, string>();

// 将缓存对象放入window，以便在其他组件中访问
if (typeof window !== 'undefined') {
  window.__THUMBNAIL_CACHE__ = thumbnailCache;
}

// 使用memo包装组件，避免不必要的重新渲染
export const FileItem = memo(forwardRef<FileItemHandle, FileItemProps>(({ file, profileId, index, sortConfig, columnWidths, onPendingStateChange }, ref) => {
  const {
    data: fileItemInfo,
    error,
    isError,
  } = useQuery(fileItemInfoQueryOptions(profileId, file, index, sortConfig));

  const selectedFiles = useAtomValue(selectedFilesAtom);
  const imageViewerApp = useAtomValue(imageViewerAppAtom);
  const selectedThumbnail = useAtomValue(selectedThumbnailAtom);
  const selected = useMemo(
    () => selectedFiles.includes(file),
    [selectedFiles, file],
  );
  const isThumbnailSelected = useMemo(
    () => selectedThumbnail === file,
    [selectedThumbnail, file],
  );

  // 手动修改文件名相关状态
  const [manualName, setManualName] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  // 标记是否已锁定修改（待执行）
  const [isPendingRename, setIsPendingRename] = useState<boolean>(false);
  
  // 确认修改（实际执行重命名）- 此方法由外部"执行"按钮调用
  const handleConfirmEdit = useCallback(async () => {
    if (!manualName.trim() || !fileItemInfo || manualName === fileItemInfo.fileInfo.fullName || !isPendingRename) {
      return false;
    }

    try {
      // @ts-ignore - __TAURI_IPC__ 可能在运行时存在
      if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
        // Tauri环境下实现重命名
        const { invoke } = await import('@tauri-apps/api');
        const { dirname, join } = await import('@tauri-apps/api/path');
        
        // 获取目录路径
        const dirPath = await dirname(file);
        // 新的完整路径
        const newPath = await join(dirPath, manualName);
        
        // 调用Tauri后端进行重命名
        await invoke<null>('rename', { 
          old: file,
          new: newPath
        });
        
        // 由于rename命令成功时返回null，错误时会抛出异常
        // 更新文件列表中的路径
        atomStore.set(filesAtom as FilesAtomTauri, (prevFiles) => 
          prevFiles.map((f) => f === file ? newPath : f)
        );
        
        // 更新选中文件列表
        atomStore.set(selectedFilesAtom, (prevSelected) => 
          prevSelected.map((f) => f === file ? newPath : f)
        );
        
        toast.success(`"${file}" 重命名为 "${manualName}" 成功`);
        setIsPendingRename(false);
        setHasChanges(false);
        // 通知父组件状态变化
        onPendingStateChange?.();
        return true;
      } else {
        // Web环境实现重命名
        // 由于Web环境限制，无法直接重命名文件，这里仅作示例
        console.log('Web环境重命名:', file, manualName);
        toast.info('Web环境不支持文件重命名');
        return false;
      }
    } catch (error) {
      console.error('重命名文件失败:', error);
      toast.error(`重命名失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [file, manualName, fileItemInfo, isPendingRename, onPendingStateChange]);
  
  // 将重命名方法通过ref暴露给父组件
  useImperativeHandle(ref, () => ({
    executeRename: async () => {
      if (isPendingRename) {
        return await handleConfirmEdit();
      }
      return false;
    },
    hasPendingRename: () => isPendingRename
  }), [isPendingRename, handleConfirmEdit]);

  // 当fileItemInfo更新时，初始化手动修改值为预览值或原文件名
  useEffect(() => {
    if (fileItemInfo) {
      setManualName(fileItemInfo.preview || fileItemInfo.fileInfo.fullName);
    }
  }, [fileItemInfo]);

  // 手动修改输入框变化处理
  const handleManualChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setManualName(e.target.value);
    // 检查是否与预览不同
    if (fileItemInfo) {
      setHasChanges(e.target.value !== (fileItemInfo.preview || fileItemInfo.fileInfo.fullName));
    }
  }, [fileItemInfo]);

  // 锁定修改（不执行重命名）
  const handleLockEdit = useCallback(() => {
    if (!manualName.trim() || !fileItemInfo) {
      setIsEditing(false);
      return;
    }
    
    // 标记为已锁定修改（待执行）
    if (hasChanges) {
      setIsPendingRename(true);
      toast.info('已锁定修改，点击"执行"按钮应用更改');
      // 通知父组件状态变化
      onPendingStateChange?.();
    }
    
    setIsEditing(false);
  }, [manualName, fileItemInfo, hasChanges, onPendingStateChange]);

  // 取消修改
  const handleCancelEdit = useCallback(() => {
    if (fileItemInfo) {
      setManualName(fileItemInfo.preview || fileItemInfo.fileInfo.fullName);
    }
    setIsEditing(false);
    setHasChanges(false);
    if (isPendingRename) {
      setIsPendingRename(false);
      // 通知父组件状态变化
      onPendingStateChange?.();
    }
  }, [fileItemInfo, isPendingRename, onPendingStateChange]);

  // 开始编辑
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  // 根据当前列宽生成grid-template-columns样式
  const gridTemplateColumns = useMemo(() => {
    const { checkbox, index, filename, time, thumbnail, preview, manual } = columnWidths;
    return `${checkbox}rem ${index}rem ${filename}% ${time}% ${thumbnail}% ${preview}fr ${manual}%`;
  }, [columnWidths]);

  // 获取图片缩略图URL
  const getThumbnailUrl = useCallback(async (): Promise<string | null> => {
    if (!fileItemInfo?.fileInfo.isImage) return null;
    
    // 首先检查缓存中是否已有此文件的缩略图
    const cacheKey = `${file}_${fileItemInfo.fileInfo.fullName}`;
    if (thumbnailCache.has(cacheKey)) {
      console.log('使用缓存的缩略图:', file);
      return thumbnailCache.get(cacheKey) || null;
    }

    try {
      // 检查是否在Tauri环境
      // @ts-ignore - __TAURI_IPC__ 可能在运行时存在
      if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
        try {
          // 尝试方式1：使用convertFileSrc
          const { convertFileSrc } = await import('@tauri-apps/api/tauri');
          const url = convertFileSrc(file);
          console.log('Tauri图片URL(convertFileSrc):', url);
          
          // 尝试方式2：读取文件内容转为base64
          try {
            const { readBinaryFile } = await import('@tauri-apps/api/fs');
            const { getMimeType } = await import('@/lib/file');
            const fileContent = await readBinaryFile(file);
            const mimeType = getMimeType(fileItemInfo.fileInfo.ext);
            
            // 将二进制数据转换为base64字符串
            const base64Content = btoa(
              new Uint8Array(fileContent)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            
            const dataUrl = `data:${mimeType};base64,${base64Content}`;
            console.log('Tauri图片URL(base64):', dataUrl.substring(0, 50) + '...');
            
            // 保存到缓存
            thumbnailCache.set(cacheKey, dataUrl);
            return dataUrl;
          } catch (readError) {
            console.warn('读取文件内容失败，使用convertFileSrc:', readError);
            // 保存到缓存
            thumbnailCache.set(cacheKey, url);
            return url;
          }
        } catch (err) {
          console.error('Tauri读取图片错误:', err);
          throw err;
        }
      }
      // Web环境
      if (typeof file === 'string') {
        console.log('Web图片URL(字符串):', file);
        // 保存到缓存
        thumbnailCache.set(cacheKey, file);
        return file;
      } else {
        // 如果是FileSystemFileHandle
        const fileHandle = file as unknown as FileSystemFileHandle;
        const fileObj = await fileHandle.getFile();
        const url = URL.createObjectURL(fileObj);
        console.log('Web图片URL(对象):', url);
        // 保存到缓存
        thumbnailCache.set(cacheKey, url);
        return url;
      }
    } catch (error) {
      console.error('获取缩略图URL失败:', error);
      return null;
    }
  }, [file, fileItemInfo?.fileInfo.isImage, fileItemInfo?.fileInfo.ext, fileItemInfo?.fileInfo.fullName]);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

  // 在组件挂载和相关依赖变化时获取缩略图URL
  useEffect(() => {
    let mounted = true;
    
    if (fileItemInfo?.fileInfo.isImage) {
      // 检查缓存中是否已有此文件的缩略图
      const cacheKey = `${file}_${fileItemInfo.fileInfo.fullName}`;
      const cachedUrl = thumbnailCache.get(cacheKey);
      
      if (cachedUrl) {
        // 如果缓存中有，直接使用
        setThumbnailUrl(cachedUrl);
        setThumbnailLoading(false);
        setThumbnailError(false);
      } else {
        // 否则加载新的缩略图
        setThumbnailLoading(true);
        setThumbnailError(false);
        
        getThumbnailUrl()
          .then(url => {
            if (mounted && url) {
              setThumbnailUrl(url);
            }
          })
          .catch(err => {
            console.error('缩略图加载错误:', err);
            if (mounted) {
              setThumbnailError(true);
            }
          })
          .finally(() => {
            if (mounted) {
              setThumbnailLoading(false);
            }
          });
      }
    } else {
      setThumbnailUrl(null);
      setThumbnailError(false);
      setThumbnailLoading(false);
    }
    
    return () => {
      mounted = false;
      
      // 注意：不再在每次组件卸载时释放URL，而是在应用关闭或清理缓存时统一处理
    };
  }, [fileItemInfo?.fileInfo.isImage, fileItemInfo?.fileInfo.fullName, file, getThumbnailUrl]);

  // 处理图片点击事件，打开图片文件
  const handleImageClick = useCallback(async () => {
    if (fileItemInfo?.fileInfo.isImage) {
      // 设置当前缩略图为选中状态
      atomStore.set(selectedThumbnailAtom, file);
      
      try {
        // 检查是否在Tauri环境
        // @ts-ignore - __TAURI_IPC__ 可能在运行时存在
        if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
          console.log('Tauri打开文件:', file);
          const { invoke } = await import('@tauri-apps/api');
          
          // 如果设置了自定义图片查看器，优先使用
          if (imageViewerApp) {
            try {
              console.log('使用自定义应用打开:', imageViewerApp, file);
              await invoke('open_with_custom_app', { 
                appPath: imageViewerApp,
                filePath: file
              });
              return;
            } catch (err) {
              console.error('使用自定义应用打开失败:', err);
              // 失败后继续尝试其他方式
            }
          }
          
          // 使用系统默认应用打开
          try {
            await invoke('open_with_default_app', { path: file });
          } catch (err) {
            console.error('使用默认应用打开失败，尝试使用shell.open:', err);
            // 备用方案：使用shell.open
            const { open } = await import('@tauri-apps/api/shell');
            await open(file);
          }
        } else {
          // Web环境处理方式
          if (typeof file === 'string') {
            // 如果是URL或本地路径，尝试在新标签页打开
            console.log('Web打开文件(字符串):', file);
            const newWindow = window.open(URL.createObjectURL(new Blob([''], { type: 'text/html' })), '_blank');
            if (newWindow) {
              newWindow.location.href = file;
            }
          } else {
            // 如果是FileSystemFileHandle，创建一个临时的object URL
            console.log('Web打开文件(对象)');
            const fileHandle = file as unknown as FileSystemFileHandle;
            const fileObj = await fileHandle.getFile();
            const url = URL.createObjectURL(fileObj);
            window.open(url, '_blank');
            // 在适当的时候释放URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        }
      } catch (error) {
        console.error('打开文件失败:', error);
      }
    }
  }, [file, fileItemInfo?.fileInfo.isImage, imageViewerApp]);

  function onCheckedChange(checked: boolean) {
    atomStore.set(selectedFilesAtom, (prev) => {
      if (checked) {
        return [...prev, file];
      }

      return prev.filter((item) => item !== file);
    });
  }

  if (isError) {
    return (
      <div className="grid min-h-8 w-full grid-cols-1 divide-x break-all text-sm hover:bg-neutral-100">
        <div className="flex items-center justify-center">
          {error as unknown as string}
        </div>
      </div>
    );
  }

  if (!fileItemInfo) {
    return null;
  }

  return (
    <div 
      className="grid min-h-8 w-full divide-x break-all text-sm hover:bg-neutral-100"
      style={{ gridTemplateColumns }}
    >
      <div className="flex size-full items-center justify-center">
        <Checkbox checked={selected} onCheckedChange={onCheckedChange} />
      </div>
      <span className="flex size-full items-center justify-center px-2 py-1 text-neutral-700">
        {fileItemInfo.sortedIndex + 1}
      </span>
      <span className="flex size-full items-center px-2 py-1 text-neutral-700">
        {fileItemInfo.fileInfo.fullName}
      </span>
      <span className="flex size-full items-center px-2 py-1 text-neutral-700">
        {fileItemInfo.fileInfo.timeString || '-'}
      </span>
      <span className="flex size-full items-center justify-center px-2 py-1">
        {fileItemInfo.fileInfo.isImage && (
          <>
            {thumbnailLoading && (
              <div className="flex flex-col items-center justify-center text-xs text-gray-500">
                <Image className="h-6 w-6 animate-pulse text-gray-400" />
                <span>加载中...</span>
              </div>
            )}
            
            {thumbnailError && (
              <div className="flex flex-col items-center justify-center text-xs text-red-500" title={file}>
                <Image className="h-6 w-6 text-red-400" />
                <span>加载失败</span>
              </div>
            )}
            
            {!thumbnailLoading && !thumbnailError && thumbnailUrl && (
              <div className={`relative flex items-center justify-center group p-1 rounded transition-all ${
                isThumbnailSelected 
                  ? 'border-2 border-blue-500 bg-blue-50' 
                  : 'border-2 border-transparent'
              }`}>
                <img 
                  src={thumbnailUrl} 
                  alt={fileItemInfo.fileInfo.fullName} 
                  className="max-h-10 max-w-16 object-contain cursor-pointer transition-all hover:scale-105 hover:shadow-md"
                  title="点击打开原图"
                  onClick={handleImageClick}
                  onError={() => {
                    console.error('图片加载失败:', thumbnailUrl);
                    setThumbnailError(true);
                  }}
                />
                <div className="absolute top-0 right-0 bg-white bg-opacity-70 p-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="h-3 w-3 text-blue-500" />
                </div>
                {isThumbnailSelected && (
                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm">
                    <div className="w-full h-full bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </span>
      <span className="flex size-full items-center px-2 py-1 font-bold">
        {fileItemInfo.preview}
      </span>
      <span className="flex size-full items-center px-2 py-1 relative">
        {isEditing ? (
          <div className="flex w-full items-center gap-x-1">
            <Input 
              className={`h-6 text-sm ${hasChanges ? 'border-blue-300 bg-blue-50' : ''}`}
              value={manualName}
              onChange={handleManualChange}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLockEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
            />
            <div className="flex shrink-0 items-center">
              <button 
                className="p-1 rounded hover:bg-green-100"
                onClick={handleLockEdit}
                title="锁定修改 (Enter)"
              >
                <Lock className="h-4 w-4 text-green-500" />
              </button>
              <button 
                className="p-1 rounded hover:bg-red-100"
                onClick={handleCancelEdit}
                title="取消修改 (Esc)"
              >
                <X className="h-4 w-4 text-red-500" />
              </button>
            </div>
          </div>
        ) : (
          <div 
            className={`w-full cursor-pointer px-1 py-0.5 rounded ${isPendingRename ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-100'}`}
            onClick={handleStartEdit}
            title="点击编辑"
          >
            {manualName || (fileItemInfo.preview || fileItemInfo.fileInfo.fullName)}
            {isPendingRename && <span className="ml-1 text-xs text-blue-500">(待执行)</span>}
          </div>
        )}
      </span>
    </div>
  );
}), (prevProps, nextProps) => {
  // 自定义比较函数，决定是否重新渲染组件
  return (
    prevProps.file === nextProps.file &&
    prevProps.profileId === nextProps.profileId &&
    prevProps.index === nextProps.index &&
    JSON.stringify(prevProps.sortConfig) === JSON.stringify(nextProps.sortConfig) &&
    JSON.stringify(prevProps.columnWidths) === JSON.stringify(nextProps.columnWidths)
  );
});
