import {
  atomStore,
  filesAtom,
  selectedFilesAtom,
  fileSortConfigAtom,
  columnWidthsAtom,
  DEFAULT_COLUMN_WIDTHS,
  type FilesAtomWeb,
  type FileSortType,
  type FileSortOrder,
  type ColumnWidths,
} from '@/lib/atoms';
import { useAtom, useAtomValue } from 'jotai';
import { useMemo, type FC, useState, useEffect, useRef, useCallback } from 'react';
import { FileItem } from './file-item';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { uniqBy } from 'lodash-es';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { getSortedFileIndices } from '@/lib/queries/file';
import { ResizableDivider } from '../ui/resizable-divider';

async function getAllFiles(directoryHandle: FileSystemDirectoryHandle) {
  const fileHandles: FileSystemFileHandle[] = [];

  for await (const fileHandle of directoryHandle.values()) {
    if (fileHandle.kind === 'file') {
      fileHandles.push(fileHandle);
    } else if (fileHandle.kind === 'directory') {
      fileHandles.push(...(await getAllFiles(fileHandle)));
    }
  }

  return fileHandles;
}

export interface FilesPanelProps {
  profileId: string;
}

// 像素到rem的转换比例
const PX_TO_REM = 16; // 假设1rem = 16px

const FilesPanel: FC<FilesPanelProps> = ({ profileId }) => {
  const files = useAtomValue(filesAtom as FilesAtomWeb);
  const selectedFiles = useAtomValue(selectedFilesAtom);
  const sortConfig = useAtomValue(fileSortConfigAtom);
  const [columnWidths, setColumnWidths] = useAtom(columnWidthsAtom);
  const [sortedIndices, setSortedIndices] = useState<number[]>([]);
  // 标记是否正在调整列宽
  const [isResizing, setIsResizing] = useState(false);
  
  // 使用ref保存容器元素，用于计算百分比宽度
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 当前列宽，用于暂存拖动过程中的列宽
  const [currentWidths, setCurrentWidths] = useState<ColumnWidths>({...columnWidths});
  
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
    const { checkbox, index, filename, time, thumbnail, preview } = currentWidths;
    return `${checkbox}rem ${index}rem ${filename}% ${time}% ${thumbnail}% ${preview}fr`;
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
        const minWidth = column === 'checkbox' ? 2 : 4;
        newWidths[column] = Math.max(minWidth, prev[column] + remDelta);
      } else if (column === 'filename' || column === 'time' || column === 'thumbnail') {
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
        }
        
        newWidths[column] = Math.max(minWidth, Math.min(maxWidth, prev[column] + percentDelta));
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

  async function onAddFile() {
    try {
      const result = await window.showOpenFilePicker({ multiple: true });

      atomStore.set(filesAtom as FilesAtomWeb, (prevFile) =>
        uniqBy([...prevFile, ...result], 'name'),
      );
    } catch (err) {}
  }

  async function onAddDir() {
    try {
      const result = await window.showDirectoryPicker();
      const files = await getAllFiles(result);

      atomStore.set(filesAtom as FilesAtomWeb, (prevFile) =>
        uniqBy([...prevFile, ...files], 'name'),
      );
    } catch (err) {}
  }

  function onCheckedChange(checked: boolean) {
    atomStore.set(selectedFilesAtom, () => {
      if (checked) {
        return files.slice().map((f) => f.name);
      }
      return [];
    });
  }

  function onRemove() {
    atomStore.set(filesAtom as FilesAtomWeb, (prevFiles) =>
      prevFiles.filter((file) => !selectedFiles.includes(file.name)),
    );
    atomStore.set(selectedFilesAtom, []);
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

  function preventDefault(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    try {
      preventDefault(e);

      const items = await Promise.all(
        [...e.dataTransfer.items].map((item) => item.getAsFileSystemHandle()),
      );
      const files = (
        await Promise.all(
          items.map((item) => {
            if (item?.kind === 'file') {
              return item;
            }

            if (item?.kind === 'directory') {
              return getAllFiles(item);
            }

            return null;
          }),
        )
      )
        .flat()
        .filter(Boolean) as FileSystemFileHandle[];

      atomStore.set(filesAtom as FilesAtomWeb, (prevFile) =>
        uniqBy([...prevFile, ...files], 'name'),
      );
    } catch (err) {}
  }

  return (
    <div
      className="size-full"
      onDrop={handleDrop}
      onDragLeave={preventDefault}
      onDragEnter={preventDefault}
      onDragOver={preventDefault}
    >
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
            title="在Web环境下，双击图片会在新标签页中打开"
            className="flex items-center gap-1"
            disabled
          >
            <Settings className="h-4 w-4" />
            图片查看器
          </Button>
        </div>
        <div className="flex items-center">
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
        
        <span className="flex size-full items-center px-2">
          预览
        </span>
      </div>
      
      <ScrollArea className="h-[calc(100%-5rem)] w-full rounded-b border border-t-0">
        <div className="flex w-full flex-col divide-y">
          {sortedFiles.map((file, i) => {
            // 找到原始索引
            const originalIndex = files.indexOf(file);
            return (
              <FileItem
                key={file.name}
                file={file.name}
                profileId={profileId}
                index={originalIndex}
                sortConfig={sortConfig}
                columnWidths={currentWidths}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FilesPanel;
