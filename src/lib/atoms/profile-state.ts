import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { UndoOperation, FileSortConfig } from './index';
import { debouncedSaveProfileState } from '../profile-persistence';

/**
 * 每个配置的独立状态
 */
export interface ProfileState {
  files: string[] | FileSystemFileHandle[];
  selectedFiles: string[];
  currentFolder: string | FileSystemDirectoryHandle | null;
  selectedThumbnail: string | null;
  showThumbnails: boolean;
  undoHistory: UndoOperation[];
  fileSortConfig: FileSortConfig;
  folderExists?: boolean; // 文件夹是否存在（仅在Tauri环境下使用）
}

/**
 * 默认的配置状态
 */
export const defaultProfileState: ProfileState = {
  files: [],
  selectedFiles: [],
  currentFolder: null,
  selectedThumbnail: null,
  showThumbnails: true,
  undoHistory: [],
  fileSortConfig: {
    type: 'index',
    order: 'asc'
  },
  folderExists: undefined // 默认为undefined，表示未检查
};

/**
 * 基于 profileId 的状态原子族
 * 每个配置都有自己独立的状态
 */
export const profileStateAtomFamily = atomFamily((_profileId: string) =>
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
      const newState = {
        ...currentState,
        files: newFiles
      };
      set(profileStateAtomFamily(profileId), newState);
      
      // 文件列表不再自动保存，只有文件夹路径和排序配置会被保存
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
      const newState = {
        ...currentState,
        currentFolder
      };
      set(profileStateAtomFamily(profileId), newState);
      
      // 自动保存状态到持久化存储（防抖）
      debouncedSaveProfileState(profileId, newState);
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
 * 获取指定配置的缩略图显示开关原子
 */
export const getProfileShowThumbnailsAtom = (profileId: string) =>
  atom(
    (get) => get(profileStateAtomFamily(profileId)).showThumbnails,
    (get, set, showThumbnails: boolean) => {
      const currentState = get(profileStateAtomFamily(profileId));
      const newState = {
        ...currentState,
        showThumbnails
      };
      set(profileStateAtomFamily(profileId), newState);
      debouncedSaveProfileState(profileId, newState);
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
      const newState = {
        ...currentState,
        fileSortConfig: newFileSortConfig
      };
      set(profileStateAtomFamily(profileId), newState);
      
      // 自动保存状态到持久化存储（防抖）
      debouncedSaveProfileState(profileId, newState);
    }
  );

/**
 * 获取指定配置的文件夹存在状态原子
 */
export const getProfileFolderExistsAtom = (profileId: string) =>
  atom(
    (get) => get(profileStateAtomFamily(profileId)).folderExists,
    (get, set, folderExists: boolean | undefined) => {
      const currentState = get(profileStateAtomFamily(profileId));
      const newState = {
        ...currentState,
        folderExists
      };
      set(profileStateAtomFamily(profileId), newState);
      // 注意：folderExists 不需要持久化保存，因为每次启动都会重新检查
    }
  );

/**
 * 重置指定配置的状态
 */
export const resetProfileState = (profileId: string, atomStore: any) => {
  atomStore.set(profileStateAtomFamily(profileId), defaultProfileState);
};

/**
 * 从持久化存储加载配置状态
 */
export const loadProfileStateFromStorage = async (profileId: string, atomStore: any) => {
  try {
    const { loadProfileState } = await import('../profile-persistence');
    const savedState = await loadProfileState(profileId);
    
    if (savedState) {
      // 合并保存的状态和默认状态
      const currentState = atomStore.get(profileStateAtomFamily(profileId));
      const mergedState = {
        ...defaultProfileState,
        ...currentState,
        ...savedState
      };
      
      atomStore.set(profileStateAtomFamily(profileId), mergedState);
      console.log(`已加载配置 ${profileId} 的保存状态`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`加载配置 ${profileId} 状态失败:`, error);
    return false;
  }
};
