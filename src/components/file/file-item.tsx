import { useQuery } from '@tanstack/react-query';
import { useMemo, type FC, useCallback, useState, useEffect } from 'react';
import { fileItemInfoQueryOptions } from '@/lib/queries/file';
import { atomStore, selectedFilesAtom, imageViewerAppAtom, type FileSortConfig, type ColumnWidths } from '@/lib/atoms';
import { Checkbox } from '../ui/checkbox';
import { useAtomValue } from 'jotai';
import { Image, ExternalLink } from 'lucide-react';

export interface FileItemProps {
  file: string;
  profileId: string;
  index: number;
  sortConfig: FileSortConfig;
  columnWidths: ColumnWidths;
}

export const FileItem: FC<FileItemProps> = ({ file, profileId, index, sortConfig, columnWidths }) => {
  const {
    data: fileItemInfo,
    error,
    isError,
  } = useQuery(fileItemInfoQueryOptions(profileId, file, index, sortConfig));

  const selectedFiles = useAtomValue(selectedFilesAtom);
  const imageViewerApp = useAtomValue(imageViewerAppAtom);
  const selected = useMemo(
    () => selectedFiles.includes(file),
    [selectedFiles, file],
  );

  // 根据当前列宽生成grid-template-columns样式
  const gridTemplateColumns = useMemo(() => {
    const { checkbox, index, filename, time, thumbnail, preview } = columnWidths;
    return `${checkbox}rem ${index}rem ${filename}% ${time}% ${thumbnail}% ${preview}fr`;
  }, [columnWidths]);

  // 获取图片缩略图URL
  const getThumbnailUrl = useCallback(async (): Promise<string | null> => {
    if (!fileItemInfo?.fileInfo.isImage) return null;
    
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
            return dataUrl;
          } catch (readError) {
            console.warn('读取文件内容失败，使用convertFileSrc:', readError);
            return url;
          }
        } catch (err) {
          console.error('Tauri读取图片错误:', err);
          throw err;
        }
      } else {
        // Web环境
        if (typeof file === 'string') {
          console.log('Web图片URL(字符串):', file);
          return file;
        } else {
          // 如果是FileSystemFileHandle
          const fileHandle = file as unknown as FileSystemFileHandle;
          const fileObj = await fileHandle.getFile();
          const url = URL.createObjectURL(fileObj);
          console.log('Web图片URL(对象):', url);
          return url;
        }
      }
    } catch (error) {
      console.error('获取缩略图URL失败:', error);
      return null;
    }
  }, [file, fileItemInfo?.fileInfo.isImage, fileItemInfo?.fileInfo.ext]);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

  // 在组件挂载和相关依赖变化时获取缩略图URL
  useEffect(() => {
    let mounted = true;
    
    if (fileItemInfo?.fileInfo.isImage) {
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
    } else {
      setThumbnailUrl(null);
      setThumbnailError(false);
      setThumbnailLoading(false);
    }
    
    return () => {
      mounted = false;
      
      // 只有blob URL需要释放，data URL和文件路径URL不需要释放
      if (thumbnailUrl && thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [fileItemInfo?.fileInfo.isImage, getThumbnailUrl]);

  // 处理图片点击事件，打开图片文件
  const handleImageClick = useCallback(async () => {
    if (fileItemInfo?.fileInfo.isImage) {
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
              <div className="relative flex items-center justify-center group">
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
              </div>
            )}
          </>
        )}
      </span>
      <span className="flex size-full items-center px-2 py-1 font-bold">
        {fileItemInfo.preview}
      </span>
    </div>
  );
};
