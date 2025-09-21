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
  getProfileFolderExistsAtom,
  deleteModeAtom,
  isExecutingAtom,
  type FileSortType,
  type ColumnWidths,
} from '@/lib/atoms';
import { listen } from '@tauri-apps/api/event';
import { useAtom, useAtomValue } from 'jotai';
import React, { useEffect, useMemo, type FC, useState, useRef, useCallback, createRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryType } from '@/lib/query';
import { FileItem, type FileItemHandle } from './file-item';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api';
import { Checkbox } from '../ui/checkbox';
import { ChevronDown, ChevronUp, Settings, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { getSortedFileIndices } from '@/lib/queries/file';
import { ResizableDivider } from '../ui/resizable-divider';
import { calculateFilenameWidth, shouldAdjustFilenameWidth, calculateSmartColumnWidths } from '@/lib/filename-width-calculator';
import { CurrentFolderDisplay } from '@/components/global/current-folder-display';

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
  const isExecuting = useAtomValue(isExecutingAtom);
  const queryClient = useQueryClient();
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
  
  // 记录上次的列宽，避免useEffect无限循环
  const lastColumnWidths = useRef<ColumnWidths>(columnWidths);
  
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
    // 更新ref记录的列宽
    lastColumnWidths.current = columnWidths;
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
    const currentFilenameWidth = lastColumnWidths.current.filename;
    if (shouldAdjustFilenameWidth(currentFilenameWidth, idealWidth, 2)) {
      console.log(`初始自动调整文件名列宽: ${currentFilenameWidth}% -> ${idealWidth}%`);
      
      const newWidths = { ...lastColumnWidths.current };
      newWidths.filename = idealWidth;
      
      // 更新全局状态，本地状态会自动同步
      setColumnWidths(newWidths);
      lastColumnWidths.current = newWidths;
      
      // 标记已经进行过初始调整
      hasInitialAdjusted.current = true;
    } else {
      // 即使不需要调整，也要标记已经检查过
      hasInitialAdjusted.current = true;
    }
  }, [files, isResizing, getContainerWidth, setColumnWidths]);

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

  // 智能重置列宽：基于文件列表中的最长值计算最佳列宽
  const resetColumnWidths = useCallback(async () => {
    console.log('🔧 重置列宽按钮被点击');
    console.log('当前文件数量:', files.length);
    console.log('文件列表前3个:', files.slice(0, 3));
    
    const containerWidth = getContainerWidth();
    console.log('容器宽度:', containerWidth);
    
    if (containerWidth <= 0 || files.length === 0) {
      // 如果没有文件或容器宽度无效，回退到默认值
      const defaultWidths = { ...DEFAULT_COLUMN_WIDTHS };
      setCurrentWidths(defaultWidths);
      setColumnWidths(defaultWidths);
      console.log('❌ 重置列宽到默认值（无文件或容器宽度无效）');
      console.log('默认列宽:', defaultWidths);
      return;
    }

    console.log('📏 开始计算智能列宽...');
    
    // 获取显示的文件名（基础名称）而不是完整路径
    try {
      const { getFileInfo } = await import('@/lib/file');
      const displayNames: string[] = [];
      
      // 批量获取文件的基础名称
      for (const file of files.slice(0, 20)) { // 限制处理数量以提高性能
        try {
          const fileInfo = await getFileInfo(typeof file === 'string' ? file : file.name);
          displayNames.push(fileInfo.fullName);
        } catch (error) {
          // 如果获取失败，使用文件名的最后一部分作为备选
          const fileName = typeof file === 'string' ? file : file.name;
          const baseName = fileName.split(/[/\\]/).pop() || fileName;
          displayNames.push(baseName);
        }
      }
      
      console.log('📁 实际显示的文件名:', displayNames.slice(0, 3));
      
      // 使用智能计算函数，基于实际显示的文件名计算最佳列宽
      const smartWidths = calculateSmartColumnWidths(
        displayNames,
        [], // 暂时不传入时间信息，因为需要异步获取
        containerWidth,
        {
          fontSize: 14,
          extraPadding: 40, // 增加padding确保有足够空间
          minWidthPercents: {
            filename: 18,
            time: 12,
            manual: 15
          },
          maxWidthPercents: {
            filename: 55,
            time: 22,
            manual: 30
          }
        }
      );
      
      console.log('📐 计算出的智能列宽:', smartWidths);
      console.log('原列宽:', currentWidths);
      
      setCurrentWidths(smartWidths);
      setColumnWidths(smartWidths);
      console.log('✅ 智能重置列宽完成，基于实际显示文件名计算');
    } catch (error) {
      console.error('❌ 智能列宽计算失败，回退到简单处理:', error);
      
      // 回退方案：使用文件路径的最后一部分
      const displayNames = files.map(file => {
        const fileName = typeof file === 'string' ? file : file.name;
        return fileName.split(/[/\\]/).pop() || fileName;
      });
      
      const smartWidths = calculateSmartColumnWidths(
        displayNames,
        [],
        containerWidth,
        {
          fontSize: 14,
          extraPadding: 40,
          minWidthPercents: { filename: 18, time: 12, manual: 15 },
          maxWidthPercents: { filename: 55, time: 22, manual: 30 }
        }
      );
      
      setCurrentWidths(smartWidths);
      setColumnWidths(smartWidths);
      console.log('✅ 智能重置列宽完成（回退方案）');
    }
  }, [files, getContainerWidth, setColumnWidths, currentWidths]);

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

    // 清理React Query缓存，确保文件信息重新查询
    console.log('选择新文件夹时清理React Query文件信息缓存');
    queryClient.removeQueries({ 
      queryKey: [QueryType.FileItemInfo],
      exact: false 
    });
    
    // 清理缩略图缓存
    clearThumbnailCache();

    // 设置当前文件夹路径
    setCurrentFolder(openDir);

    // 读取文件夹中的所有文件
    const files = await invoke<string[]>('read_dir', { path: openDir });

    // 替换文件列表（而不是添加到现有列表）
    atomStore.set(getProfileFilesAtom(profileId), files);
    
    // 设置文件夹存在状态为true（刚选择的文件夹肯定存在）
    atomStore.set(getProfileFolderExistsAtom(profileId), true);
    
    // 清空选中状态
    atomStore.set(getProfileSelectedFilesAtom(profileId), []);
    
    // 清空缩略图选中状态
    atomStore.set(getProfileSelectedThumbnailAtom(profileId), null);
  }

  async function onRefreshFiles() {
    try {
      console.log(`🔄 [刷新] 开始刷新，当前文件夹: ${currentFolder}`);
      
      if (!currentFolder) {
        console.log('❌ [刷新] 没有选择文件夹，无法刷新');
        return;
      }
      
      // 清理React Query缓存，确保文件信息重新查询
      console.log('🧹 [刷新] 清理React Query文件信息缓存');
      queryClient.removeQueries({ 
        queryKey: [QueryType.FileItemInfo],
        exact: false 
      });
      
      // 清理缩略图缓存
      console.log('🧹 [刷新] 清理缩略图缓存');
      clearThumbnailCache();
      
      // 重新扫描当前文件夹
      console.log(`📂 [刷新] 重新扫描文件夹: ${currentFolder}`);
      const files = await invoke<string[]>('read_dir', { path: currentFolder });
      console.log(`📂 [刷新] 扫描完成，找到 ${files.length} 个文件`);
      
      // 更新文件列表
      console.log('📝 [刷新] 更新文件列表到atom');
      atomStore.set(getProfileFilesAtom(profileId), files);
      
      // 清空选中状态
      atomStore.set(getProfileSelectedFilesAtom(profileId), []);
      
      // 清空缩略图选中状态
      atomStore.set(getProfileSelectedThumbnailAtom(profileId), null);
      
      console.log(`✅ [刷新] 刷新完成，共 ${files.length} 个文件`);
    } catch (error) {
      console.error('❌ [刷新] 刷新文件列表失败:', error);
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
    // 如果正在调整列宽或正在执行重命名，不改变排序
    if (isResizing || isExecuting) return;
    
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
      <div className="flex w-full justify-between items-center gap-x-2 pb-2">
        <div className="flex items-center gap-x-2">
          <Button size="sm" onClick={onSelectFolder}>
            选择文件夹
          </Button>
          <Button 
            size="sm" 
            variant={deleteMode ? "default" : "outline"}
            onClick={toggleDeleteMode}
            className="flex items-center gap-1"
          >
            <Trash2 className="h-4 w-4" />
            {deleteMode ? '退出删除' : '删除文件'}
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
            onClick={resetColumnWidths}
            title="智能重置列宽：基于当前文件列表的最长值自动计算最佳列宽"
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
          {/* 当前文件夹显示 */}
          <CurrentFolderDisplay profileId={profileId} onFolderClick={onOpenFolder} />
        </div>
        <div className="flex items-center gap-x-2">
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
        
        <span className={`flex size-full items-center px-2 relative ${
          isExecuting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
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
        
        <span className={`flex size-full items-center px-2 relative ${
          isExecuting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
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
            最终文件名
            <div className="ml-1 text-xs text-neutral-500" title="显示最终会被应用的文件名。如果没有手动修改，显示规则预览结果；如果有手动修改，显示手动输入的内容。点击可编辑，Enter确认，Esc取消">(?)</div>
          </span>
          <ResizableDivider 
            className="absolute right-0 h-full"
            onResizeStart={handleResizeStart}
            onResize={(delta) => handleResizeColumn('manual', delta)}
            onResizeEnd={handleResizeEnd}
          />
        </span>
      </div>
      
      <div className="relative h-[calc(100%-6.5rem)]">
        <ScrollArea className="h-full w-full rounded-b border border-t-0">
          <div className="flex w-full flex-col divide-y">
            {sortedFiles.map((file, displayIndex) => {
              const fileKey = typeof file === 'string' ? file : file.name;
              return (
                <FileItem
                  key={`${fileKey}-${displayIndex}`}
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
        
        {/* 执行中的加载覆盖层 */}
        {isExecuting && (
          <div className="absolute inset-0 bg-white/85 backdrop-blur-sm rounded-b flex items-center justify-center z-50">
            <div className="flex flex-col items-center space-y-3 bg-white px-6 py-4 rounded-lg shadow-lg border border-gray-200">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <div className="text-base font-semibold text-gray-700">正在执行重命名...</div>
              <div className="text-xs text-gray-500">请稍候，正在处理文件</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilesPanel;

