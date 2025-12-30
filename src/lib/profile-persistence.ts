import { store } from './store';
import type { ProfileState } from './atoms/profile-state';
import type { FileSortType, FileSortOrder } from './atoms';

/**
 * 配置状态持久化管理
 */

// 为每个配置生成存储键
export const getProfileStateKey = (profileId: string) => `profile-state/${profileId}`;

/**
 * 可持久化的配置状态接口
 * 只保存必要的状态，文件列表会根据文件夹路径重新扫描
 */
export interface SerializableProfileState {
  currentFolder: string | null; // 只保存文件夹路径字符串，不保存FileSystemDirectoryHandle
  fileSortConfig: {
    type: FileSortType;
    order: FileSortOrder;
  };
  showThumbnails: boolean;
}

/**
 * 将ProfileState转换为可序列化的格式
 */
export function serializeProfileState(state: ProfileState): SerializableProfileState {
  return {
    currentFolder: typeof state.currentFolder === 'string' ? state.currentFolder : null,
    fileSortConfig: state.fileSortConfig,
    showThumbnails: state.showThumbnails
  };
}

/**
 * 将可序列化的状态转换回ProfileState格式
 */
export function deserializeProfileState(serializedState: SerializableProfileState): Partial<ProfileState> {
  return {
    currentFolder: serializedState.currentFolder,
    fileSortConfig: serializedState.fileSortConfig,
    showThumbnails: serializedState.showThumbnails ?? true
  };
}

/**
 * 保存配置状态到持久化存储
 */
export async function saveProfileState(profileId: string, state: ProfileState): Promise<void> {
  try {
    const key = getProfileStateKey(profileId);
    const serializedState = serializeProfileState(state);
    await store.set(key, serializedState);
    console.log(`已保存配置 ${profileId} 的状态`);
  } catch (error) {
    console.error(`保存配置 ${profileId} 状态失败:`, error);
  }
}


/**
 * 从持久化存储加载配置状态
 */
export async function loadProfileState(profileId: string): Promise<Partial<ProfileState> | null> {
  try {
    const key = getProfileStateKey(profileId);
    const serializedState = await store.get<SerializableProfileState>(key);
    
    if (serializedState) {
      console.log(`已加载配置 ${profileId} 的状态`);
      
      // 直接反序列化状态，不验证文件夹路径
      // 文件夹存在性检查现在在应用启动时处理，保持原始路径以便用户知道之前选择的文件夹
      const result = deserializeProfileState(serializedState);
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error(`加载配置 ${profileId} 状态失败:`, error);
    return null;
  }
}

/**
 * 删除配置的持久化状态
 */
export async function deleteProfileState(profileId: string): Promise<void> {
  try {
    const key = getProfileStateKey(profileId);
    await store.delete(key);
    console.log(`已删除配置 ${profileId} 的状态`);
  } catch (error) {
    console.error(`删除配置 ${profileId} 状态失败:`, error);
  }
}

/**
 * 防抖保存函数，避免频繁保存
 */
const saveTimeouts = new Map<string, NodeJS.Timeout>();

export function debouncedSaveProfileState(profileId: string, state: ProfileState, delay: number = 1000): void {
  // 清除之前的定时器
  const existingTimeout = saveTimeouts.get(profileId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  
  // 设置新的定时器
  const timeout = setTimeout(() => {
    saveProfileState(profileId, state);
    saveTimeouts.delete(profileId);
  }, delay);
  
  saveTimeouts.set(profileId, timeout);
}
