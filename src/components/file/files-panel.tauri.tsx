import {
  atomStore,
  columnWidthsAtom,
  DEFAULT_COLUMN_WIDTHS,
  imageViewerAppAtom,
  getProfileFilesAtom,
  getProfileSelectedFilesAtom,
  getProfileCurrentFolderAtom,
  getProfileSelectedThumbnailAtom,
  getProfileFileSortConfigAtom,
  deleteModeAtom,
  type FileSortType,
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
import { ChevronDown, ChevronUp, Settings, RefreshCw, FolderOpen, Trash2 } from 'lucide-react';
import { getSortedFileIndices } from '@/lib/queries/file';
import { ResizableDivider } from '../ui/resizable-divider';
import { calculateFilenameWidth, shouldAdjustFilenameWidth } from '@/lib/filename-width-calculator';

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
  // 使用基于配置的状态管理
  const files = useAtomValue(getProfileFilesAtom(profileId));
  const selectedFiles = useAtomValue(getProfileSelectedFilesAtom(profileId));
  const sortConfig = useAtomValue(getProfileFileSortConfigAtom(profileId));
  const [columnWidths, setColumnWidths] = useAtom(columnWidthsAtom);
  const [imageViewerApp, setImageViewerApp] = useAtom(imageViewerAppAtom);
  const [currentFolder, setCurrentFolder] = useAtom(getProfileCurrentFolderAtom(profileId));
  const [deleteMode, setDeleteMode] = useAtom(deleteModeAtom);
  const [sortedIndices, setSortedIndices] = useState<number[]>([]);
  // 标记是否正在调整列宽
  const [isResizing, setIsResizing] = useState(false);
  
  // 使用ref保存容器元素，用于计算百分比宽度
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 当前列宽，用于暂存拖动过程中的列宽
  const [currentWidths, setCurrentWidths] = useState<ColumnWidths>({...columnWidths});
  
  // 使用ref存储所有文件项的引用
  const fileItemRefs = useRef<Map<string | FileSystemFileHandle, React.RefObject<FileItemHandle>>>(new Map());
  
  // 标记是否已经进行过初始宽度调整
  const hasInitialAdjusted = useRef<boolean>(false);
  
  // 记录当前文件夹路径，用于检测文件夹变化
  const lastFolderPath = useRef<string>('');
  
  // 获取容器宽度
  const getContainerWidth = useCallback(() => {
    if (!containerRef.current) return 1000; // 默认值
    return containerRef.current.getBoundingClientRect().width;
  }, []);

  // 同步全局状态和本地状态
  useEffect(() => {
    if (!isResizing) {
      setCurrentWidths({...columnWidths});
    }
  }, [columnWidths, isResizing]);

  // 检测文件夹变化并重置初始调整标记
  useEffect(() => {
    const currentFolderPath = typeof currentFolder === 'string' ? currentFolder : currentFolder?.name || '';
    if (currentFolderPath !== lastFolderPath.current) {
      console.log(`文件夹变化: ${lastFolderPath.current} -> ${currentFolderPath}`);
      lastFolderPath.current = currentFolderPath;
      hasInitialAdjusted.current = false; // 重置初始调整标记
      console.log('重置初始调整标记');
    }
  }, [currentFolder]);


  // 初始文件名列宽自适应调整（仅在选中新文件夹时触发一次）
  useEffect(() => {
    // 只在以下情况下进行初始调整：
    // 1. 有文件列表
    // 2. 没有在调整列宽
    // 3. 还没有进行过初始调整
    console.log('检查初始调整条件:', { 
      filesLength: files.length, 
      isResizing, 
      hasInitialAdjusted: hasInitialAdjusted.current 
    });
    
    if (files.length === 0 || isResizing || hasInitialAdjusted.current) return;

    const containerWidth = getContainerWidth();
    if (containerWidth <= 0) return;

    // 计算理想的文件名列宽
    const idealWidth = calculateFilenameWidth(
      files.map(file => typeof file === 'string' ? file : file.name),
      containerWidth,
      {
        minWidthPercent: 1,
        maxWidthPercent: 50, // 减少最大宽度，避免占用过多空间
        extraPadding: 50,    // 额外padding，确保有足够空间
        fontSize: 14,
        maxFilenameLength: 40 // 超长文件名截断长度
      }
    );

    // 检查是否需要调整（降低阈值，使初始调整更敏感）
    if (shouldAdjustFilenameWidth(currentWidths.filename, idealWidth, 2)) {
      console.log(`初始自动调整文件名列宽: ${currentWidths.filename}% -> ${idealWidth}%`);
      
      const newWidths = { ...currentWidths };
      newWidths.filename = idealWidth;
      
      // 更新本地状态和全局状态
      setCurrentWidths(newWidths);
      setColumnWidths(newWidths);
      
      // 标记已经进行过初始调整
      hasInitialAdjusted.current = true;
    } else {
      // 即使不需要调整，也要标记已经检查过
      hasInitialAdjusted.current = true;
    }
  }, [files, isResizing, getContainerWidth, currentWidths, setColumnWidths]);

  const checked = useMemo(
    () => files.length > 0 && selectedFiles.length === files.length,
    [selectedFiles, files],
  );

  // 根据当前列宽生成grid-template-columns样式
  const gridTemplateColumns = useMemo(() => {
    const { checkbox, index, filename, time, thumbnail, preview, manual } = currentWidths;
    // 根据删除模式决定是否显示复选框列
    if (deleteMode) {
      return `${checkbox}rem ${index}rem ${filename}% ${time}% ${thumbnail}% ${preview}fr ${manual}%`;
    } else {
      return `${index}rem ${filename}% ${time}% ${thumbnail}% ${preview}fr ${manual}%`;
    }
  }, [currentWidths, deleteMode]);

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
          minWidth = 15; // 文件名最小1%
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

  // 重置列宽到默认值并重新进行自适应调整
  const resetColumnWidths = useCallback(() => {
    // 首先重置到默认值
    const defaultWidths = { ...DEFAULT_COLUMN_WIDTHS };
    setCurrentWidths(defaultWidths);
    setColumnWidths(defaultWidths);
    
    // 重置初始调整标记，触发自适应调整
    hasInitialAdjusted.current = false;
    console.log('重置列宽并触发自适应调整');
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

  // 切换删除模式
  const toggleDeleteMode = useCallback(() => {
    setDeleteMode(prev => {
      const newMode = !prev;
      // 如果退出删除模式，清空选中的文件
      if (!newMode) {
        atomStore.set(getProfileSelectedFilesAtom(profileId), []);
      }
      console.log('删除模式:', newMode ? '开启' : '关闭');
      return newMode;
    });
  }, [setDeleteMode, profileId]);

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
  }, [files]);

  // 在useEffect中设置全局文件列表
  useEffect(() => {
    // 将文件列表设置为全局变量，以便规则执行时可以访问
    window.__ALL_FILES__ = files;
    
    return () => {
      // 组件卸载时清理全局变量
      window.__ALL_FILES__ = undefined;
    };
  }, [files]);


  async function onSelectFolder() {
    const openDir = await open({ directory: true });

    if (typeof openDir !== 'string') {
      return;
    }

    // 设置当前文件夹路径
    setCurrentFolder(openDir);

    // 读取文件夹中的所有文件
    const files = await invoke<string[]>('read_dir', { path: openDir });

    // 替换文件列表（而不是添加到现有列表）
    atomStore.set(getProfileFilesAtom(profileId), files);
    
    // 清空选中状态
    atomStore.set(getProfileSelectedFilesAtom(profileId), []);
    
    // 清空缩略图选中状态
    atomStore.set(getProfileSelectedThumbnailAtom(profileId), null);
  }

  async function onRefreshFiles() {
    try {
      if (!currentFolder) {
        console.log('没有选择文件夹，无法刷新');
        return;
      }
      
      // 重新扫描当前文件夹
      const files = await invoke<string[]>('read_dir', { path: currentFolder });
      
      // 更新文件列表
      atomStore.set(getProfileFilesAtom(profileId), files);
      
      // 清空选中状态
      atomStore.set(getProfileSelectedFilesAtom(profileId), []);
      
      // 清空缩略图选中状态
      atomStore.set(getProfileSelectedThumbnailAtom(profileId), null);
      
      console.log(`已刷新 ${files.length} 个文件`);
    } catch (error) {
      console.error('刷新文件列表失败:', error);
    }
  }

  async function onOpenFolder() {
    try {
      if (!currentFolder) {
        console.log('没有选择文件夹，无法打开');
        return;
      }
      
      await invoke('open_folder_in_explorer', { folderPath: currentFolder });
    } catch (error) {
      console.error('打开文件夹失败:', error);
    }
  }

  function onCheckedChange(checked: boolean) {
    atomStore.set(getProfileSelectedFilesAtom(profileId), (_prevFiles) => {
      if (checked) {
        return files.slice() as string[];
      }

      return [];
    });
  }

  function onRemove() {
    atomStore.set(getProfileFilesAtom(profileId), (prevFiles: string[] | FileSystemFileHandle[]) =>
      prevFiles.filter((file: string | FileSystemFileHandle) => !selectedFiles.includes(file as string)) as string[] | FileSystemFileHandle[],
    );
    atomStore.set(getProfileSelectedFilesAtom(profileId), []);
    
    // 如果删除后文件列表为空，清理缩略图缓存
    if (selectedFiles.length === files.length) {
      clearThumbnailCache();
    }
  }
  
  // 更改排序方式
  function changeSortType(type: FileSortType) {
    // 如果正在调整列宽，不改变排序
    if (isResizing) return;
    
    atomStore.set(getProfileFileSortConfigAtom(profileId), (prev: any) => {
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

      atomStore.set(getProfileFilesAtom(profileId), (prevFiles: string[] | FileSystemFileHandle[]) => [
        ...new Set([...prevFiles as string[], ...dropFiles]),
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
          <Button size="sm" onClick={onSelectFolder}>
            选择文件夹
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={onRefreshFiles}
            title="刷新文件夹"
            className="flex items-center gap-1"
            disabled={!currentFolder}
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={onOpenFolder}
            title="在文件浏览器中打开文件夹"
            className="flex items-center gap-1"
            disabled={!currentFolder}
          >
            <FolderOpen className="h-4 w-4" />
            打开文件夹
          </Button>
          <Button
            size="sm" 
            variant="outline"
            onClick={resetColumnWidths}
            title="重置列宽并自适应文件名宽度"
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
          <Button 
            size="sm" 
            variant={deleteMode ? "default" : "outline"}
            onClick={toggleDeleteMode}
            className="flex items-center gap-1"
          >
            <Trash2 className="h-4 w-4" />
{deleteMode ? '退出删除' : '删除文件'}
          </Button>
          {deleteMode && (
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={onRemove}
              disabled={selectedFiles.length === 0}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              移除选中文件 ({selectedFiles.length})
            </Button>
          )}
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="grid h-8 w-full divide-x divide-neutral-300 rounded-t border border-b-0 bg-neutral-200 text-sm"
        style={{ gridTemplateColumns }}
      >
        {deleteMode && (
          <div className="flex size-full items-center justify-center relative">
            <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
            <ResizableDivider 
              className="absolute right-0 h-full"
              onResizeStart={handleResizeStart}
              onResize={(delta) => handleResizeColumn('checkbox', delta)}
              onResizeEnd={handleResizeEnd}
            />
          </div>
        )}
        
        <span className="flex size-full items-center justify-center px-2 relative">
          <span className="flex items-center gap-1">
            序号
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
          {sortedFiles.map((file, displayIndex) => {
            fileItemRefs.current.set(file, createRef<FileItemHandle>());
            const fileKey = typeof file === 'string' ? file : file.name;
            return (
              <FileItem
                key={fileKey}
                file={typeof file === 'string' ? file : file.name}
                profileId={profileId}
                index={displayIndex}  // 使用显示索引，让列表映射按显示顺序工作
                sortConfig={sortConfig}
                columnWidths={currentWidths}
                deleteMode={deleteMode}
                ref={fileItemRefs.current.get(file)}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FilesPanel;

