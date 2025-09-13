import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { UndoOperation, FileSortConfig } from './index';

/**
 * 每个配置的独立状态
 */
export interface ProfileState {
  files: string[] | FileSystemFileHandle[];
  selectedFiles: string[];
  currentFolder: string | FileSystemDirectoryHandle | null;
  selectedThumbnail: string | null;
  undoHistory: UndoOperation[];
  fileSortConfig: FileSortConfig;
}

/**
 * 默认的配置状态
 */
export const defaultProfileState: ProfileState = {
  files: [],
  selectedFiles: [],
  currentFolder: null,
  selectedThumbnail: null,
  undoHistory: [],
  fileSortConfig: {
    type: 'index',
    order: 'asc'
  }
};

/**
 * 基于 profileId 的状态原子族
 * 每个配置都有自己独立的状态
 */
export const profileStateAtomFamily = atomFamily((profileId: string) =>
  atom<ProfileState>(defaultProfileState)
);

/**
 * 获取指定配置的文件列表原子
 */
export const getProfileFilesAtom = (profileId: string) =>
  atom(
    (get) => get(profileStateAtomFamily(profileId)).files,
    (get, set, update: string[] | FileSystemFileHandle[] | ((prev: string[] | FileSystemFileHandle[]) => string[] | FileSystemFileHandle[])) => {
      const currentState = get(profileStateAtomFamily(profileId));
      const newFiles = typeof update === 'function' ? update(currentState.files) : update;
      set(profileStateAtomFamily(profileId), {
        ...currentState,
        files: newFiles
      });
    }
  );

/**
 * 获取指定配置的选中文件原子
 */
export const getProfileSelectedFilesAtom = (profileId: string) =>
  atom(
    (get) => get(profileStateAtomFamily(profileId)).selectedFiles,
    (get, set, update: string[] | ((prev: string[]) => string[])) => {
      const currentState = get(profileStateAtomFamily(profileId));
      const newSelectedFiles = typeof update === 'function' ? update(currentState.selectedFiles) : update;
      set(profileStateAtomFamily(profileId), {
        ...currentState,
        selectedFiles: newSelectedFiles
      });
    }
  );

/**
 * 获取指定配置的当前文件夹原子
 */
export const getProfileCurrentFolderAtom = (profileId: string) =>
  atom(
    (get) => get(profileStateAtomFamily(profileId)).currentFolder,
    (get, set, currentFolder: string | FileSystemDirectoryHandle | null) => {
      const currentState = get(profileStateAtomFamily(profileId));
      set(profileStateAtomFamily(profileId), {
        ...currentState,
        currentFolder
      });
    }
  );

/**
 * 获取指定配置的选中缩略图原子
 */
export const getProfileSelectedThumbnailAtom = (profileId: string) =>
  atom(
    (get) => get(profileStateAtomFamily(profileId)).selectedThumbnail,
    (get, set, selectedThumbnail: string | null) => {
      const currentState = get(profileStateAtomFamily(profileId));
      set(profileStateAtomFamily(profileId), {
        ...currentState,
        selectedThumbnail
      });
    }
  );

/**
 * 获取指定配置的撤销历史原子
 */
export const getProfileUndoHistoryAtom = (profileId: string) =>
  atom(
    (get) => get(profileStateAtomFamily(profileId)).undoHistory,
    (get, set, undoHistory: UndoOperation[]) => {
      const currentState = get(profileStateAtomFamily(profileId));
      set(profileStateAtomFamily(profileId), {
        ...currentState,
        undoHistory
      });
    }
  );

/**
 * 获取指定配置的文件排序配置原子
 */
export const getProfileFileSortConfigAtom = (profileId: string) =>
  atom(
    (get) => get(profileStateAtomFamily(profileId)).fileSortConfig,
    (get, set, update: FileSortConfig | ((prev: FileSortConfig) => FileSortConfig)) => {
      const currentState = get(profileStateAtomFamily(profileId));
      const newFileSortConfig = typeof update === 'function' ? update(currentState.fileSortConfig) : update;
      set(profileStateAtomFamily(profileId), {
        ...currentState,
        fileSortConfig: newFileSortConfig
      });
    }
  );

/**
 * 重置指定配置的状态
 */
export const resetProfileState = (profileId: string, atomStore: any) => {
  atomStore.set(profileStateAtomFamily(profileId), defaultProfileState);
};
