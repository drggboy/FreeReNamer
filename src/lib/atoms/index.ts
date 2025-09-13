import { atom, createStore, type PrimitiveAtom } from 'jotai';
import type { ReactNode } from 'react';

export const atomStore = createStore();

export const filesAtom = atom<string[] | FileSystemFileHandle[]>([]);

export type FilesAtomTauri = PrimitiveAtom<string[]> &
  WithInitialValue<string[]>;
export type FilesAtomWeb = PrimitiveAtom<FileSystemFileHandle[]> &
  WithInitialValue<FileSystemFileHandle[]>;

// 定义文件排序方式
export type FileSortType = 'index' | 'name' | 'time';

// 定义文件排序顺序
export type FileSortOrder = 'asc' | 'desc';

// 定义文件排序配置
export interface FileSortConfig {
  type: FileSortType;
  order: FileSortOrder;
}

// 创建文件排序配置原子
export const fileSortConfigAtom = atom<FileSortConfig>({
  type: 'index',
  order: 'asc'
});

// 定义栏目宽度配置
export interface ColumnWidths {
  checkbox: number;  // 复选框列宽
  index: number;     // 序号列宽
  filename: number;  // 文件名列宽
  time: number;      // 时间列宽
  thumbnail: number; // 缩略图列宽
  preview: number;   // 预览列宽
  manual: number;    // 手动修改列宽
}

// 默认栏目宽度配置
export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  checkbox: 3,     // 3rem
  index: 5,        // 5rem
  filename: 35,    // 35%
  time: 15,        // 15%
  thumbnail: 15,   // 15%
  preview: 1,      // 1fr
  manual: 20       // 20%
};

// 创建栏目宽度配置原子
export const columnWidthsAtom = atom<ColumnWidths>({...DEFAULT_COLUMN_WIDTHS});

export interface GlobalDialogInfo {
  opened: boolean;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  contentClassName?: string;
}

export const globalDialogInfoAtom = atom<GlobalDialogInfo>({
  opened: false,
});

export interface GlobalAlertInfo {
  opened: boolean;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
}

export const globalAlertInfoAtom = atom<GlobalAlertInfo>({
  opened: false,
});

export const selectedFilesAtom = atom<string[]>([]);

// 当前选中的文件夹路径 (Tauri: 字符串路径, Web: DirectoryHandle)
export const currentFolderAtom = atom<string | FileSystemDirectoryHandle | null>(null);

// 自定义图片查看器应用路径
export const imageViewerAppAtom = atom<string | null>(null);

// 撤销历史记录
export interface UndoOperation {
  id: string;
  timestamp: number;
  operations: Array<{
    oldPath: string;
    newPath: string;
  }>;
}

export const undoHistoryAtom = atom<UndoOperation[]>([]);

// 当前选中的缩略图（用于高亮显示）
export const selectedThumbnailAtom = atom<string | null>(null);

// 导出基于配置的状态管理
export * from './profile-state';
