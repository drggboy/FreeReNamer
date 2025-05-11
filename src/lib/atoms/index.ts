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
