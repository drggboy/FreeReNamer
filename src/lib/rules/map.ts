import type { RuleCommonInfo, RuleDefine } from './base';
import { atomStore, fileSortConfigAtom } from '../atoms';
import { getSortedFileIndices } from '../queries/file';
import { store } from '../store';

// 定义全局变量类型
declare global {
  interface Window {
    __ALL_FILES__?: (string | FileSystemFileHandle)[];
  }
}

export const RULE_MAP_TYPE = 'map';

export interface ListConfig {
  name: string;
  targetNames: string[];
}

export interface RuleMapInfo extends RuleCommonInfo {
  lists: ListConfig[];
  activeListIndex: number;
}

/**
 * 全局列表映射配置存储键
 */
export const GLOBAL_MAP_LISTS_KEY = 'global_map_lists';

/**
 * 默认的全局列表配置
 */
export const DEFAULT_GLOBAL_LISTS: ListConfig[] = [
  { 
    name: '默认列表1', 
    targetNames: ['文件1', '文件2', '文件3', '文件4', '文件5'] 
  },
  { 
    name: '默认列表2', 
    targetNames: ['新文件A', '新文件B', '新文件C', '新文件D', '新文件E'] 
  }
];

/**
 * 获取全局列表配置
 */
export async function getGlobalMapLists(): Promise<ListConfig[]> {
  const lists = await store.get<ListConfig[]>(GLOBAL_MAP_LISTS_KEY);
  return lists || DEFAULT_GLOBAL_LISTS;
}

/**
 * 保存全局列表配置
 */
export async function saveGlobalMapLists(lists: ListConfig[]): Promise<void> {
  await store.set(GLOBAL_MAP_LISTS_KEY, lists);
}

/**
 * 定义列表映射规则
 * 该规则将文件名按照显示顺序进行映射替换
 */
export const RULE_MAP_DEFINE: RuleDefine<
  typeof RULE_MAP_TYPE,
  RuleMapInfo
> = {
  type: RULE_MAP_TYPE,
  label: '列表映射',
  getDefaultInfo: async () => {
    const globalLists = await getGlobalMapLists();
    return {
      lists: globalLists,
      activeListIndex: 0,
      includeExt: false,
    };
  },
  getDescription: (_ruleInfo) => {
    return `按显示顺序映射为指定列表的文件名`;
  },
  exec: async (ruleInfo, args) => {
    const { lists, activeListIndex, includeExt } = ruleInfo;
    const { fileInfo, index } = args;
    
    // 如果没有有效列表或活动列表索引无效
    if (lists.length === 0 || activeListIndex >= lists.length || activeListIndex < 0) {
      return includeExt ? fileInfo.fullName : fileInfo.name;
    }
    
    const activeList = lists[activeListIndex];
    
    // 获取所有文件和当前的排序配置
    // 注意: 这里是异步获取全局状态，在实际执行时需要注意处理并发情况
    const allFiles = window.__ALL_FILES__ || [];
    const sortConfig = atomStore.get(fileSortConfigAtom);
    
    // 如果没有文件或列表为空，则保持原文件名不变
    if (allFiles.length === 0 || activeList.targetNames.length === 0) {
      return includeExt ? fileInfo.fullName : fileInfo.name;
    }
    
    try {
      // 在route.tsx中传递的index已经是displayIndex（显示顺序中的索引）
      // 直接使用这个索引来映射目标名称
      const displayIndex = index;
      
      // 如果显示索引超出了目标名称列表范围，则保持原名不变
      if (displayIndex < 0 || displayIndex >= activeList.targetNames.length) {
        return includeExt ? fileInfo.fullName : fileInfo.name;
      }
      
      // 返回显示索引对应的目标名称
      return activeList.targetNames[displayIndex];
    } catch (error) {
      console.error('列表映射规则执行错误:', error);
      return includeExt ? fileInfo.fullName : fileInfo.name;
    }
  },
}; 