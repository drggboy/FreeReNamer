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
  preview: number;   // 预览列宽
}

// 默认栏目宽度配置
export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  checkbox: 2,     // 2rem
  index: 3,        // 3rem
  filename: 36,    // 36%
  time: 20,        // 20%
  preview: 1       // 1fr
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
