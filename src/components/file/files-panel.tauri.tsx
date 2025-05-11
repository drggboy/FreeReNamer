import {
  atomStore,
  filesAtom,
  selectedFilesAtom,
  fileSortConfigAtom,
  columnWidthsAtom,
  DEFAULT_COLUMN_WIDTHS,
  imageViewerAppAtom,
  type FilesAtomTauri,
  type FileSortType,
  type FileSortOrder,
  type ColumnWidths,
} from '@/lib/atoms';
import { listen } from '@tauri-apps/api/event';
import { useAtom, useAtomValue } from 'jotai';
import React, { useEffect, useMemo, type FC, useState, useRef, useCallback, createRef } from 'react';
import { FileItem, type FileItemHandle } from './file-item';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api';
import { Checkbox } from '../ui/checkbox';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { getSortedFileIndices } from '@/lib/queries/file';
import { ResizableDivider } from '../ui/resizable-divider';
import { toast } from 'sonner';

export interface FilesPanelProps {
  profileId: string;
}

// 访问FileItem组件中的缩略图缓存对象
declare global {
  interface Window {
    __FILE_ITEM_REFS__?: Map<string | FileSystemFileHandle, React.RefObject<FileItemHandle>>;
    __THUMBNAIL_CACHE__?: Map<string, string>;
    __ALL_FILES__?: (string | FileSystemFileHandle)[];
  }
}

// 用于清理缩略图缓存
function clearThumbnailCache() {
  const cache = window.__THUMBNAIL_CACHE__;
  if (cache) {
    // 释放所有blob URL
    for (const url of cache.values()) {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }
    cache.clear();
    console.log('清理了缩略图缓存');
  }
}

// 像素到rem的转换比例
const PX_TO_REM = 16; // 假设1rem = 16px

const FilesPanel: FC<FilesPanelProps> = ({ profileId }) => {
  const files = useAtomValue(filesAtom as FilesAtomTauri);
  const selectedFiles = useAtomValue(selectedFilesAtom);
  const sortConfig = useAtomValue(fileSortConfigAtom);
  const [columnWidths, setColumnWidths] = useAtom(columnWidthsAtom);
  const [imageViewerApp, setImageViewerApp] = useAtom(imageViewerAppAtom);
  const [sortedIndices, setSortedIndices] = useState<number[]>([]);
  // 标记是否正在调整列宽
  const [isResizing, setIsResizing] = useState(false);
  
  // 使用ref保存容器元素，用于计算百分比宽度
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 当前列宽，用于暂存拖动过程中的列宽
  const [currentWidths, setCurrentWidths] = useState<ColumnWidths>({...columnWidths});
  
  // 使用ref存储所有文件项的引用
  const fileItemRefs = useRef<Map<string | FileSystemFileHandle, React.RefObject<FileItemHandle>>>(new Map());
  // 记录当前有多少个待重命名的文件
  const [pendingRenameCount, setPendingRenameCount] = useState(0);
  
  // 同步全局状态和本地状态
  useEffect(() => {
    if (!isResizing) {
      setCurrentWidths({...columnWidths});
    }
  }, [columnWidths, isResizing]);

  const checked = useMemo(
    () => files.length > 0 && selectedFiles.length === files.length,
    [selectedFiles, files],
  );

  // 根据当前列宽生成grid-template-columns样式
  const gridTemplateColumns = useMemo(() => {
    const { checkbox, index, filename, time, thumbnail, preview, manual } = currentWidths;
    return `${checkbox}rem ${index}rem ${filename}% ${time}% ${thumbnail}% ${preview}fr ${manual}%`;
  }, [currentWidths]);

  // 获取容器宽度
  const getContainerWidth = useCallback(() => {
    if (!containerRef.current) return 1000; // 默认值
    return containerRef.current.getBoundingClientRect().width;
  }, []);

  // 调整列宽的处理函数
  const handleResizeColumn = useCallback((column: keyof ColumnWidths, delta: number) => {
    setCurrentWidths(prev => {
      const newWidths = { ...prev };
      const containerWidth = getContainerWidth();
      
      // 根据不同列类型应用不同的调整逻辑
      if (column === 'checkbox' || column === 'index') {
        // rem为单位的列，直接转换像素为rem
        const remDelta = delta / PX_TO_REM;
        // 设置不同列的最小宽度
        const minWidth = column === 'checkbox' ? 2 : 5;
        newWidths[column] = Math.max(minWidth, prev[column] + remDelta);
      } else if (column === 'filename' || column === 'time' || column === 'thumbnail' || column === 'manual') {
        // 百分比为单位的列，将像素转换为百分比
        const percentDelta = (delta / containerWidth) * 100;
        // 设置不同列的最小宽度和最大宽度
        let minWidth = 10; // 默认最小宽度为10%
        let maxWidth = 80; // 默认最大宽度为80%
        
        // 根据列类型设置不同的最小宽度
        if (column === 'filename') {
          minWidth = 15; // 文件名最小15%
          maxWidth = 60; // 文件名最大60%
        } else if (column === 'time') {
          minWidth = 10; // 时间最小10%
          maxWidth = 30; // 时间最大30%
        } else if (column === 'thumbnail') {
          minWidth = 10; // 缩略图最小10%
          maxWidth = 40; // 缩略图最大40%
        } else if (column === 'manual') {
          minWidth = 15; // 手动修改最小15%
          maxWidth = 50; // 手动修改最大50%
        }
        
        newWidths[column] = Math.max(minWidth, Math.min(maxWidth, prev[column] + percentDelta));
      } else if (column === 'preview') {
        // preview列使用fr单位，需要特殊处理
        // 我们暂时将其视为百分比，但实际渲染时仍使用fr
        const percentDelta = (delta / containerWidth) * 100;
        // fr值应该保持较小，这里我们将其限制在0.5到5之间
        newWidths[column] = Math.max(0.5, Math.min(5, prev[column] + percentDelta / 50));
      }
      
      return newWidths;
    });
  }, [getContainerWidth]);
  
  // 拖动开始时标记状态
  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);
  
  // 拖动结束时保存列宽到全局状态
  const handleResizeEnd = useCallback(() => {
    setColumnWidths(currentWidths);
    // 延迟重置状态，避免影响其他组件更新
    setTimeout(() => {
      setIsResizing(false);
    }, 100);
  }, [currentWidths, setColumnWidths]);

  // 重置列宽到默认值
  const resetColumnWidths = useCallback(() => {
    setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
  }, [setColumnWidths]);

  // 选择图片查看器应用
  const selectImageViewer = useCallback(async () => {
    try {
      const selectedApp = await open({
        multiple: false,
        directory: false,
        title: "选择图片查看器",
        filters: [
          {
            name: "可执行文件",
            extensions: ["exe", "app", "bat", "cmd", "sh"]
          }
        ]
      });

      if (selectedApp && typeof selectedApp === 'string') {
        setImageViewerApp(selectedApp);
        console.log('已设置图片查看器:', selectedApp);
      }
    } catch (error) {
      console.error('选择图片查看器失败:', error);
    }
  }, [setImageViewerApp]);

  // 清除图片查看器设置
  const clearImageViewer = useCallback(() => {
    setImageViewerApp(null);
    console.log('已清除图片查看器设置');
  }, [setImageViewerApp]);

  // 当文件列表或排序配置变化时，重新计算排序顺序
  useEffect(() => {
    // 如果正在调整列宽，不重新计算排序
    if (isResizing) return;
    
    async function updateSortOrder() {
      const indices = await getSortedFileIndices(files, sortConfig);
      setSortedIndices(indices);
    }
    
    updateSortOrder();
  }, [files, sortConfig, isResizing]);

  // 将文件数组按排序后的顺序排列
  const sortedFiles = useMemo(() => {
    if (sortedIndices.length === 0 || sortedIndices.length !== files.length) {
      return files;
    }
    
    return sortedIndices.map(index => files[index]);
  }, [files, sortedIndices]);

  // 更新待重命名文件计数
  const updatePendingRenameCount = useCallback(() => {
    let count = 0;
    fileItemRefs.current.forEach((ref) => {
      if (ref.current?.hasPendingRename()) {
        count++;
      }
    });
    setPendingRenameCount(count);
  }, []);
  
  // 将fileItemRefs设置为全局变量，以便route.tsx可以访问
  useEffect(() => {
    window.__FILE_ITEM_REFS__ = fileItemRefs.current;
    
    return () => {
      // 组件卸载时清理全局变量
      window.__FILE_ITEM_REFS__ = undefined;
    };
  }, []);
  
  // 当文件列表变化时重新创建refs
  useEffect(() => {
    // 清除旧的refs
    fileItemRefs.current.clear();
    
    // 为每个文件创建新的ref
    files.forEach((file) => {
      fileItemRefs.current.set(file, createRef<FileItemHandle>());
    });
    
    // 更新待重命名计数
    updatePendingRenameCount();
  }, [files, updatePendingRenameCount]);

  // 在useEffect中设置全局文件列表
  useEffect(() => {
    // 将文件列表设置为全局变量，以便规则执行时可以访问
    window.__ALL_FILES__ = files;
    
    return () => {
      // 组件卸载时清理全局变量
      window.__ALL_FILES__ = undefined;
    };
  }, [files]);

  async function onAddFile() {
    const openFiles = await open({ multiple: true, directory: false });

    if (!Array.isArray(openFiles)) {
      return;
    }

    atomStore.set(filesAtom as FilesAtomTauri, (prevFiles) => [
      ...new Set([...prevFiles, ...openFiles]),
    ]);
  }

  async function onAddDir() {
    const openDir = await open({ directory: true });

    if (typeof openDir !== 'string') {
      return;
    }

    const files = await invoke<string[]>('read_dir', { path: openDir });

    atomStore.set(filesAtom as FilesAtomTauri, (prevFiles) => [
      ...new Set([...prevFiles, ...files]),
    ]);
  }

  function onCheckedChange(checked: boolean) {
    atomStore.set(selectedFilesAtom as FilesAtomTauri, () => {
      if (checked) {
        return files.slice();
      }

      return [];
    });
  }

  function onRemove() {
    atomStore.set(filesAtom as FilesAtomTauri, (prevFiles) =>
      prevFiles.filter((file) => !selectedFiles.includes(file)),
    );
    atomStore.set(selectedFilesAtom, []);
    
    // 如果删除后文件列表为空，清理缩略图缓存
    if (selectedFiles.length === files.length) {
      clearThumbnailCache();
    }
  }
  
  // 更改排序方式
  function changeSortType(type: FileSortType) {
    // 如果正在调整列宽，不改变排序
    if (isResizing) return;
    
    atomStore.set(fileSortConfigAtom, (prev) => {
      // 如果点击当前排序列，切换排序顺序
      if (prev.type === type) {
        return {
          type,
          order: prev.order === 'asc' ? 'desc' : 'asc'
        };
      }
      // 否则切换排序类型，默认升序
      return {
        type,
        order: 'asc'
      };
    });
  }
  
  // 渲染排序图标
  function renderSortIcon(type: FileSortType) {
    if (sortConfig.type !== type) return null;
    
    return sortConfig.order === 'asc' 
      ? <ChevronUp className="h-4 w-4" /> 
      : <ChevronDown className="h-4 w-4" />;
  }

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen('tauri://file-drop', async (e) => {
      if (!Array.isArray(e.payload)) {
        return;
      }

      const dropFiles: string[] = [];

      for (const item of e.payload as string[]) {
        const isFile = await invoke<boolean>('is_file', { path: item });

        if (isFile) {
          dropFiles.push(item);
          continue;
        }

        const files = await invoke<string[]>('read_dir', { path: item });

        dropFiles.push(...files);
      }

      atomStore.set(filesAtom as FilesAtomTauri, (prevFiles) => [
        ...new Set([...prevFiles, ...dropFiles]),
      ]);
    }).then((unlistenFn) => {
      unlisten = unlistenFn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  // 当组件卸载时清理缓存
  useEffect(() => {
    return () => {
      clearThumbnailCache();
    };
  }, []);

  // 当文件列表清空时清理缓存
  useEffect(() => {
    if (files.length === 0) {
      clearThumbnailCache();
    }
  }, [files.length]);

  return (
    <div className="size-full">
      <div className="flex w-full justify-between gap-x-2 pb-4">
        <div className="flex items-center gap-x-2">
          <Button size="sm" onClick={onAddFile}>
            添加文件
          </Button>
          <Button size="sm" onClick={onAddDir}>
            添加文件夹
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={resetColumnWidths}
            title="重置列宽"
          >
            重置列宽
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={selectImageViewer}
            title={imageViewerApp ? `当前图片查看器: ${imageViewerApp}` : "设置图片查看器"}
            className="flex items-center gap-1"
          >
            <Settings className="h-4 w-4" />
            {imageViewerApp ? "更改" : "设置"} 
            {imageViewerApp && (
              <Button
                variant="ghost" 
                size="sm"
                className="h-5 px-1 py-0 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  clearImageViewer();
                }}
                title="清除图片查看器设置"
              >
                ×
              </Button>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-x-2">
          {selectedFiles.length > 0 && (
            <Button size="sm" onClick={onRemove}>
              移除
            </Button>
          )}
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="grid h-8 w-full divide-x divide-neutral-300 rounded-t border border-b-0 bg-neutral-200 text-sm"
        style={{ gridTemplateColumns }}
      >
        <div className="flex size-full items-center justify-center relative">
          <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
          <ResizableDivider 
            className="absolute right-0 h-full"
            onResizeStart={handleResizeStart}
            onResize={(delta) => handleResizeColumn('checkbox', delta)}
            onResizeEnd={handleResizeEnd}
          />
        </div>
        
        <span className="flex size-full items-center justify-center px-2 cursor-pointer relative"
          onClick={() => changeSortType('index')}
        >
          <span className="flex items-center gap-1">
            序号
            {renderSortIcon('index')}
          </span>
          <ResizableDivider 
            className="absolute right-0 h-full"
            onResizeStart={handleResizeStart}
            onResize={(delta) => handleResizeColumn('index', delta)}
            onResizeEnd={handleResizeEnd}
          />
        </span>
        
        <span className="flex size-full items-center px-2 cursor-pointer relative"
          onClick={() => changeSortType('name')}
        >
          <span className="flex items-center gap-1">
            文件名
            {renderSortIcon('name')}
          </span>
          <ResizableDivider 
            className="absolute right-0 h-full"
            onResizeStart={handleResizeStart}
            onResize={(delta) => handleResizeColumn('filename', delta)}
            onResizeEnd={handleResizeEnd}
          />
        </span>
        
        <span className="flex size-full items-center px-2 cursor-pointer relative"
          onClick={() => changeSortType('time')}
        >
          <span className="flex items-center gap-1">
            时间
            {renderSortIcon('time')}
          </span>
          <ResizableDivider 
            className="absolute right-0 h-full"
            onResizeStart={handleResizeStart}
            onResize={(delta) => handleResizeColumn('time', delta)}
            onResizeEnd={handleResizeEnd}
          />
        </span>
        
        <span className="flex size-full items-center px-2 relative">
          <span className="flex items-center gap-1">
            缩略图
          </span>
          <ResizableDivider 
            className="absolute right-0 h-full"
            onResizeStart={handleResizeStart}
            onResize={(delta) => handleResizeColumn('thumbnail', delta)}
            onResizeEnd={handleResizeEnd}
          />
        </span>
        
        <span className="flex size-full items-center px-2 relative">
          预览
          <ResizableDivider 
            className="absolute right-0 h-full"
            onResizeStart={handleResizeStart}
            onResize={(delta) => handleResizeColumn('preview', delta)}
            onResizeEnd={handleResizeEnd}
          />
        </span>
        
        <span className="flex size-full items-center px-2 relative">
          <span className="flex items-center gap-1">
            手动修改
            <div className="ml-1 text-xs text-neutral-500" title="点击可编辑文件名，Enter键确认，Esc键取消">(?)</div>
          </span>
          <ResizableDivider 
            className="absolute right-0 h-full"
            onResizeStart={handleResizeStart}
            onResize={(delta) => handleResizeColumn('manual', delta)}
            onResizeEnd={handleResizeEnd}
          />
        </span>
      </div>
      
      <ScrollArea className="h-[calc(100%-5rem)] w-full rounded-b border border-t-0">
        <div className="flex w-full flex-col divide-y">
          {sortedFiles.map((file, i) => {
            // 找到原始索引
            const originalIndex = files.indexOf(file);
            // 获取或创建ref
            const ref = fileItemRefs.current.get(file) || createRef<FileItemHandle>();
            if (!fileItemRefs.current.has(file)) {
              fileItemRefs.current.set(file, ref);
            }
            
            return (
              <FileItem
                key={file}
                ref={ref}
                file={file}
                profileId={profileId}
                index={originalIndex}
                sortConfig={sortConfig}
                columnWidths={currentWidths}
                onPendingStateChange={updatePendingRenameCount}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FilesPanel;

