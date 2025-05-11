import {
  atomStore,
  filesAtom,
  selectedFilesAtom,
  fileSortConfigAtom,
  type FilesAtomWeb,
  type FileSortType,
  type FileSortOrder,
} from '@/lib/atoms';
import { useAtomValue } from 'jotai';
import { useMemo, type FC, useState, useEffect } from 'react';
import { FileItem } from './file-item';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { uniqBy } from 'lodash-es';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getSortedFileIndices } from '@/lib/queries/file';

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

const FilesPanel: FC<FilesPanelProps> = ({ profileId }) => {
  const files = useAtomValue(filesAtom as FilesAtomWeb);
  const selectedFiles = useAtomValue(selectedFilesAtom);
  const sortConfig = useAtomValue(fileSortConfigAtom);
  const [sortedIndices, setSortedIndices] = useState<number[]>([]);

  const checked = useMemo(
    () => files.length > 0 && selectedFiles.length === files.length,
    [selectedFiles, files],
  );
  
  useEffect(() => {
    async function updateSortOrder() {
      const indices = await getSortedFileIndices(files, sortConfig);
      setSortedIndices(indices);
    }
    
    updateSortOrder();
  }, [files, sortConfig]);

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
  
  function changeSortType(type: FileSortType) {
    atomStore.set(fileSortConfigAtom, (prev) => {
      if (prev.type === type) {
        return {
          type,
          order: prev.order === 'asc' ? 'desc' : 'asc'
        };
      }
      return {
        type,
        order: 'asc'
      };
    });
  }
  
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
        </div>
        <div className="flex items-center">
          {selectedFiles.length > 0 && (
            <Button size="sm" onClick={onRemove}>
              移除
            </Button>
          )}
        </div>
      </div>
      <div className="grid h-8 w-full grid-cols-[2rem_3rem_36%_20%_1fr] divide-x divide-neutral-300 rounded-t border border-b-0 bg-neutral-200 text-sm">
        <div className="flex size-full items-center justify-center">
          <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
        </div>
        <span 
          className="flex size-full items-center justify-center px-2 cursor-pointer"
          onClick={() => changeSortType('index')}
        >
          <span className="flex items-center gap-1">
            序号
            {renderSortIcon('index')}
          </span>
        </span>
        <span 
          className="flex size-full items-center px-2 cursor-pointer"
          onClick={() => changeSortType('name')}
        >
          <span className="flex items-center gap-1">
            文件名
            {renderSortIcon('name')}
          </span>
        </span>
        <span 
          className="flex size-full items-center px-2 cursor-pointer"
          onClick={() => changeSortType('time')}
        >
          <span className="flex items-center gap-1">
            时间
            {renderSortIcon('time')}
          </span>
        </span>
        <span className="flex size-full items-center px-2">预览</span>
      </div>
      <ScrollArea className="h-[calc(100%-5rem)] w-full rounded-b border border-t-0">
        <div className="flex w-full flex-col divide-y">
          {sortedFiles.map((file, i) => {
            const originalIndex = files.indexOf(file);
            return (
              <FileItem
                key={file.name}
                file={file.name}
                profileId={profileId}
                index={originalIndex}
                sortConfig={sortConfig}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FilesPanel;
