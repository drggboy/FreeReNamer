import { ProfileNavList } from '@/components/profile/profile-nav-list';
import { createFileRoute, Outlet, useParams, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useAtomValue } from 'jotai';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addProfile, getProfile, type Profile } from '@/lib/profile';
import { QueryType } from '@/lib/query';
import { IconLayoutSidebarLeftCollapse } from '@tabler/icons-react';
import { atomStore, filesAtom, fileSortConfigAtom, undoHistoryAtom, currentFolderAtom, getProfileFilesAtom, getProfileFileSortConfigAtom, getProfileSelectedFilesAtom, getProfileCurrentFolderAtom, getProfileSelectedThumbnailAtom, selectedFilesAtom, selectedThumbnailAtom, isExecutingAtom, type UndoOperation } from '@/lib/atoms';
import { execRules } from '@/lib/rule';
import { getFileInfo } from '@/lib/file';
import { getSortedFileIndices } from '@/lib/queries/file';
import { ScrollArea } from '@/components/ui/scroll-area';
import { showConfirm, showRenameDialog } from '@/lib/ui';
import { toast } from 'sonner';
import { updateProfile } from '@/lib/profile';

// 冲突检查结果类型
/* 已废弃：ConflictCheckResult 接口
interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: Array<{
    targetName: string;
    files: string[];
    type: 'duplicate_rename' | 'existing_file';
  }>;
}
*/

/* 已废弃：检查重命名冲突逻辑已合并到主执行流程中
async function checkRenameConflicts_DEPRECATED(
  files: (string | FileSystemFileHandle)[],
  sortedIndices: number[],
  profile: any,
  fileItemRefs: any
): Promise<ConflictCheckResult> {
  const conflicts: ConflictCheckResult['conflicts'] = [];
  const targetNames = new Map<string, string[]>(); // 目标名称 -> 源文件列表
  
  // 获取当前文件夹路径
  let currentFolderPath: string | null = null;
  if (__PLATFORM__ === __PLATFORM_TAURI__) {
    const currentFolder = atomStore.get(getProfileCurrentFolderAtom(profile?.id || ''));
    currentFolderPath = typeof currentFolder === 'string' ? currentFolder : null;
  }

  // 第一步：并行收集所有重命名操作的目标名称
  console.log(`🔍 开始冲突检查，并行处理 ${sortedIndices.length} 个文件`);
  
  const conflictCheckPromises = sortedIndices.map(async (displayIndex) => {
    const originalIndex = displayIndex;
    const file = files[originalIndex] as string;
    
    try {
      const fileInfo = await getFileInfo(file);
      let targetName = fileInfo.fullName;
      
      // 直接使用"手动修改"列的内容作为最终文件名
      if (fileItemRefs) {
        const fileRef = fileItemRefs.get(file);
        if (fileRef?.current?.getFinalName) {
          const finalName = fileRef.current.getFinalName();
          if (finalName && finalName.trim()) {
            targetName = finalName;
          }
        }
      }

      // 如果目标名称与原名称不同，记录重命名操作
      if (targetName !== fileInfo.fullName) {
        return { file, targetName };
      }
      return null;
    } catch (error) {
      console.error(`检查重命名冲突时失败: ${file}`, error);
      return null;
    }
  });
  
  const conflictCheckResults = await Promise.all(conflictCheckPromises);
  console.log(`✅ 冲突检查文件信息获取完成`);
  
  // 构建目标名称映射
  for (const result of conflictCheckResults) {
    if (result) {
      if (!targetNames.has(result.targetName)) {
        targetNames.set(result.targetName, []);
      }
      targetNames.get(result.targetName)!.push(result.file);
    }
  }

  // 第二步：检查重命名目标名称之间的冲突
  for (const [targetName, sourceFiles] of targetNames.entries()) {
    if (sourceFiles.length > 1) {
      conflicts.push({
        targetName,
        files: sourceFiles,
        type: 'duplicate_rename'
      });
    }
  }

  // 第三步：检查目标名称是否与被移除的文件冲突（Tauri平台）
  if (__PLATFORM__ === __PLATFORM_TAURI__ && currentFolderPath) {
    try {
      const { invoke } = await import('@tauri-apps/api');
      
      // 获取文件夹中的所有文件（包括已从列表移除的文件）
      const allFilesInFolder = await invoke<string[]>('read_dir', { path: currentFolderPath });
      
      // 获取当前文件列表中的所有文件路径
      const currentFileSet = new Set(files.map(f => typeof f === 'string' ? f : f.name));
      
      // 找出被移除的文件（在文件系统中存在但不在当前文件列表中）
      const removedFiles: string[] = [];
      for (const filePath of allFilesInFolder) {
        if (!currentFileSet.has(filePath)) {
          removedFiles.push(filePath);
        }
      }
      
      // 获取被移除文件的名称集合
      const removedFileNames = new Set<string>();
      for (const filePath of removedFiles) {
        try {
          const fileInfo = await getFileInfo(filePath);
          removedFileNames.add(fileInfo.fullName);
        } catch (error) {
          console.warn(`无法获取被移除文件的信息: ${filePath}`, error);
        }
      }
      
      // 检查重命名目标名称是否与被移除的文件名冲突
      for (const [targetName, sourceFiles] of targetNames.entries()) {
        if (removedFileNames.has(targetName)) {
          conflicts.push({
            targetName,
            files: sourceFiles,
            type: 'existing_file'
          });
        }
      }
    } catch (error) {
      console.error('检查与被移除文件的冲突时失败:', error);
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}
*/

export const Route = createFileRoute('/profile')({
  component: Component,
});

function Component() {
  const queryClient = useQueryClient();
  const params = useParams({ from: '/profile/$profileId' });
  const navigate = useNavigate();
  const [sidePanelOpened, setSidePanelOpened] = useState(false);
  const isExecuting = useAtomValue(isExecutingAtom);

  const navStyle = useSpring({
    width: sidePanelOpened ? 240 : 0,
    opacity: sidePanelOpened ? 1 : 0,
  });

  const addProfileButtonStyle = useSpring({
    transform: sidePanelOpened ? 'rotate(0deg)' : 'rotate(180deg)',
  });

  const { mutate: execAddProfile } = useMutation({
    mutationFn: async (info: Omit<Profile, 'id'>) => {
      return addProfile(info);
    },
    onSuccess: async (newProfileId: string) => {
      // 清除所有相关的查询缓存，确保数据是最新的
      await queryClient.invalidateQueries({ queryKey: [QueryType.ProfileIds] });
      await queryClient.invalidateQueries({ queryKey: [QueryType.Profile] });
      await queryClient.invalidateQueries({ queryKey: [QueryType.FileItemInfo] });
      
      // 注意：由于现在每个配置都有独立的状态，不需要手动重置状态
      
      // 自动跳转到新创建的配置页面
      navigate({
        to: '/profile/$profileId',
        params: {
          profileId: newProfileId,
        },
      });
      
      // 延迟一小段时间后自动弹出重命名对话框
      setTimeout(() => {
        showRenameDialog((newName) => {
          // 执行配置重命名
          updateProfile(newProfileId, { name: newName }).then(() => {
            // 刷新配置数据
            queryClient.invalidateQueries({ queryKey: [QueryType.Profile, { id: newProfileId }] });
            toast.success(`配置已重命名为"${newName}"`);
          }).catch((error) => {
            console.error('重命名配置失败:', error);
            toast.error('重命名失败，请重试');
          });
        });
      }, 100); // 短暂延迟确保页面跳转完成
    },
  });

  const { mutate: execProfile, isPending: isExecPending } = useMutation({
    mutationFn: async (profileId: string) => {
      // 性能计时开始
      const startTime = performance.now();
      console.log(`🚀 开始执行重命名操作`);
      
      // 设置执行状态为 true
      atomStore.set(isExecutingAtom, true);
      
      const profile = await getProfile(profileId);
      // 根据平台获取正确的文件列表
      const files = __PLATFORM__ === __PLATFORM_TAURI__ 
        ? atomStore.get(getProfileFilesAtom(profileId))
        : atomStore.get(filesAtom);
      
      // 统一重命名执行：将手动修改和规则重命名合并为一个步骤
      const updatedFiles = [...files];
      const filePathMap = new Map<string, string>(); // 记录旧路径到新路径的映射
      let successCount = 0;
      let failedCount = 0;
      const failedFiles: string[] = [];
      
      // 获取当前的排序配置和排序后的索引
      const sortConfig = __PLATFORM__ === __PLATFORM_TAURI__ 
        ? atomStore.get(getProfileFileSortConfigAtom(profileId))
        : atomStore.get(fileSortConfigAtom);
      const sortedIndices = await getSortedFileIndices(files, sortConfig);
      
      // 获取所有待重命名的文件项引用（用于获取手动修改的名称）
      const fileItemRefs = window.__FILE_ITEM_REFS__;
      
      // 优化：一次性获取所有文件信息，避免重复调用
      console.log(`🚀 开始收集重命名操作，总文件数: ${sortedIndices.length}`);
      
      // 并行获取所有文件信息，同时进行冲突检查和重命名收集
      const fileInfoPromises = sortedIndices.map(async (displayIndex) => {
        const originalIndex = displayIndex;
        const file = files[originalIndex] as string;
        
        try {
          // 提前检查：先获取最终名称，如果可以提前判断无需重命名则跳过
          let targetName: string | null = null;
          
          if (fileItemRefs) {
            const fileRef = fileItemRefs.get(file);
            if (fileRef?.current?.getFinalName) {
              const finalName = fileRef.current.getFinalName();
              if (finalName && finalName.trim()) {
                targetName = finalName;
              }
            }
          }
          
          // 获取文件信息进行比较
          const fileInfo = await getFileInfo(file);
          if (!targetName) {
            targetName = fileInfo.fullName;
          }
          
          return {
            originalIndex,
            file,
            targetName,
            fileInfo,
            needsRename: targetName !== fileInfo.fullName
          };
        } catch (error) {
          console.error(`准备重命名操作失败: ${file}`, error);
          return { error: true, file, originalIndex };
        }
      });
      
      // 并行等待所有文件信息获取完成
      const fileInfoResults = await Promise.all(fileInfoPromises);
      console.log(`📊 文件信息获取完成，开始筛选和冲突检查`);
      
      // 分离成功结果和错误结果
      const successResults = fileInfoResults.filter(result => !('error' in result)) as Array<{
        originalIndex: number;
        file: string;
        targetName: string;
        fileInfo: any;
        needsRename: boolean;
      }>;
      
      const errorResults = fileInfoResults.filter(result => 'error' in result);
      
      // 更新失败计数
      for (const errorResult of errorResults) {
        failedCount++;
        failedFiles.push(errorResult.file);
      }
      
      // 冲突检查：检查需要重命名的文件
      const targetNames = new Map<string, string[]>();
      const renameResults: Array<{
        originalIndex: number;
        file: string;
        targetName: string;
      }> = [];
      
      for (const result of successResults) {
        if (result.needsRename) {
          // 记录重命名操作
          renameResults.push({
            originalIndex: result.originalIndex,
            file: result.file,
            targetName: result.targetName,
          });
          
          // 冲突检查
          if (!targetNames.has(result.targetName)) {
            targetNames.set(result.targetName, []);
          }
          targetNames.get(result.targetName)!.push(result.file);
        }
      }
      
      // 检查冲突
      const conflicts: Array<{
        targetName: string;
        files: string[];
        type: 'duplicate_rename' | 'existing_file';
      }> = [];
      
      for (const [targetName, sourceFiles] of targetNames.entries()) {
        if (sourceFiles.length > 1) {
          conflicts.push({
            targetName,
            files: sourceFiles,
            type: 'duplicate_rename'
          });
        }
      }
      
      if (conflicts.length > 0) {
        // 重置执行状态
        atomStore.set(isExecutingAtom, false);
        
        // 显示冲突警告
        let conflictMessage = '检测到文件名冲突，无法执行重命名：\n\n';
        conflictMessage += '【重复的重命名目标】\n';
        conflictMessage += conflicts.map(conflict => 
          `"${conflict.targetName}" ← (${conflict.files.join(', ')})`
        ).join('\n');
        conflictMessage += '\n\n请检查规则配置或手动修改的文件名。';
        
        toast.error(conflictMessage, { duration: 10000 });
        return;
      }
      
      const initialSkippedCount = successResults.length - renameResults.length;
      console.log(`✅ 收集完成，需要重命名的文件数: ${renameResults.length}，跳过的文件数: ${initialSkippedCount}`);
      
      if (__PLATFORM__ === __PLATFORM_TAURI__) {
        // Tauri平台：使用两阶段重命名
        const { dirname, join } = await import('@tauri-apps/api/path');
        const { invoke } = await import('@tauri-apps/api');
        
        // 使用已收集的重命名操作
        const renameOperations: Array<{
          originalIndex: number;
          file: string;
          targetName: string;
          tempName?: string;
          tempPath?: string;
          finalPath?: string;
        }> = renameResults;
        
        // 为撤销操作准备记录
        const undoOperations: Array<{
          oldPath: string;
          newPath: string;
        }> = [];
        
        // 第二步：并行生成临时名称并执行第一阶段重命名
        console.log(`🔄 开始第一阶段重命名，文件数: ${renameOperations.length}`);
        
        // 优化4：并行生成临时文件名，减少串行等待时间
        const tempNamePromises = renameOperations.map(async (operation) => {
          try {
            const dir = await dirname(operation.file);
            const tempName = await invoke<string>('generate_temp_filename', {
              dir: dir,
              originalName: operation.targetName
            });
            const tempPath = await join(dir, tempName);
            const finalPath = await join(dir, operation.targetName);
            
            return {
              operation,
              tempName,
              tempPath,
              finalPath,
              dir
            };
          } catch (error) {
            console.error(`生成临时文件名失败: ${operation.file}`, error);
            return { operation, error: true };
          }
        });
        
        const tempNameResults = await Promise.all(tempNamePromises);
        
        // 更新操作信息并执行第一阶段重命名
        for (const result of tempNameResults) {
          if ('error' in result) {
            failedCount++;
            failedFiles.push(result.operation.file);
            result.operation.tempPath = undefined;
            continue;
          }
          
          const { operation, tempName, tempPath, finalPath } = result;
          operation.tempName = tempName;
          operation.tempPath = tempPath;
          operation.finalPath = finalPath;
          
          try {
            // 第一阶段：重命名为临时名称
            await invoke('rename', {
              old: operation.file,
              new: tempPath,
            });
            
            console.log(`第一阶段成功：${operation.file} -> ${tempName}`);
          } catch (error) {
            console.error(`第一阶段重命名失败: ${operation.file}`, error);
            failedCount++;
            failedFiles.push(operation.file);
            // 标记为失败，不参与第二阶段
            operation.tempPath = undefined;
          }
        }
        
        console.log(`✅ 第一阶段完成`);
        
        // 第三步：并行执行第二阶段重命名（临时名称 -> 最终名称）
        console.log(`🔄 开始第二阶段重命名`);
        
        const validOperations = renameOperations.filter(op => op.tempPath && op.finalPath);
        console.log(`待处理第二阶段文件数: ${validOperations.length}`);
        
        // 优化5：并行执行第二阶段重命名，大幅提升性能
        const secondPhasePromises = validOperations.map(async (operation) => {
          try {
            // 第二阶段：临时名称 -> 最终名称
            await invoke('rename', {
              old: operation.tempPath,
              new: operation.finalPath,
            });
            
            console.log(`第二阶段成功：${operation.tempName} -> ${operation.targetName}`);
            
            return {
              operation,
              success: true,
            };
          } catch (error) {
            console.error(`第二阶段重命名失败: ${operation.tempPath}`, error);
            
            // 尝试回滚：将临时文件重命名回原名
            try {
              await invoke('rename', {
                old: operation.tempPath,
                new: operation.file,
              });
              console.log(`已回滚: ${operation.tempName} -> 原文件名`);
            } catch (rollbackError) {
              console.error(`回滚失败: ${operation.tempPath}`, rollbackError);
            }
            
            return {
              operation,
              success: false,
              error,
            };
          }
        });
        
        const secondPhaseResults = await Promise.all(secondPhasePromises);
        
        // 处理第二阶段结果
        for (const result of secondPhaseResults) {
          const { operation, success } = result;
          
          if (success) {
            // 更新文件列表中的路径
            updatedFiles[operation.originalIndex] = operation.finalPath!;
            // 记录路径映射，用于更新选中文件列表
            filePathMap.set(operation.file, operation.finalPath!);
            // 记录撤销操作
            undoOperations.push({
              oldPath: operation.file,
              newPath: operation.finalPath!,
            });
            successCount++;
          } else {
            failedCount++;
            failedFiles.push(operation.file);
          }
        }
        
        console.log(`✅ 第二阶段完成，成功: ${successCount}，失败: ${failedCount}`);
        
        // 如果有成功的操作，保存撤销历史
        if (undoOperations.length > 0) {
          const undoOperation: UndoOperation = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            operations: undoOperations,
          };
          
          atomStore.set(undoHistoryAtom, (prevHistory) => {
            // 只保留最近10次操作
            const newHistory = [undoOperation, ...prevHistory].slice(0, 10);
            return newHistory;
          });
        }
      }

      if (__PLATFORM__ === __PLATFORM_WEB__) {
        // Web平台：保持原有逻辑（Web API可能不支持两阶段重命名）
        for (let displayIndex = 0; displayIndex < sortedIndices.length; displayIndex++) {
          const originalIndex = sortedIndices[displayIndex];
          const file = files[originalIndex];
          
          try {
            const fileInfo = await getFileInfo(
              typeof file === 'string' ? file : file.name,
            );
            const output = await execRules(
              profile?.rules?.filter((rule) => rule.enabled) ?? [],
              {
                fileInfo,
                index: displayIndex,
              },
            );

            if (!output || output === fileInfo.fullName) {
              continue;
            }

            await (file as FileSystemFileHandle).move(output);
            successCount++;
          } catch (error) {
            console.error(`重命名文件失败: ${file}`, error);
            failedCount++;
            failedFiles.push((file as FileSystemFileHandle).name);
          }
        }
      }
      
      // 性能计时结束
      const endTime = performance.now();
      const totalTime = Math.round(endTime - startTime);
      const actualRenameCount = successCount + failedCount;
      const finalSkippedCount = sortedIndices.length - actualRenameCount;
      
      console.log(`🎯 重命名操作完成统计:`);
      console.log(`   📊 总文件数: ${sortedIndices.length}`);
      console.log(`   ✅ 成功重命名: ${successCount}`);
      console.log(`   ⏭️ 跳过文件: ${finalSkippedCount} (文件名未变化)`);
      console.log(`   ❌ 失败文件: ${failedCount}`);
      console.log(`   ⏱️ 总耗时: ${totalTime}ms`);
      console.log(`   🚀 平均处理速度: ${Math.round(sortedIndices.length / (totalTime / 1000))} 文件/秒`);
      
      // 显示执行结果统计（包含性能信息）
      if (failedCount === 0) {
        toast.success(`所有 ${successCount} 个文件重命名成功！耗时 ${totalTime}ms，跳过 ${finalSkippedCount} 个未变化的文件`);
      } else {
        toast.error(`重命名完成：成功 ${successCount} 个，失败 ${failedCount} 个，跳过 ${finalSkippedCount} 个。耗时 ${totalTime}ms。失败的文件：${failedFiles.slice(0, 3).join(', ')}${failedFiles.length > 3 ? '...' : ''}`);
      }

      // 刷新文件列表而不是清空
      if (__PLATFORM__ === __PLATFORM_TAURI__) {
        // 更新profile-based的文件列表
        atomStore.set(getProfileFilesAtom(profileId), updatedFiles as string[]);
        
        // 同时更新profile-based的选中文件列表中的路径
        atomStore.set(getProfileSelectedFilesAtom(profileId), (prevSelected) => 
          (prevSelected as string[]).map(filePath => filePathMap.get(filePath) || filePath)
        );
      }
      // Web平台不需要更新，因为FileSystemFileHandle已经自动更新了
      
      // 清理缩略图缓存，因为文件路径已经改变
      if (successCount > 0) {
        const cache = window.__THUMBNAIL_CACHE__;
        if (cache) {
          console.log('清理缩略图缓存，因为文件已重命名');
          // 释放所有blob URL
          for (const url of cache.values()) {
            if (url && url.startsWith('blob:')) {
              URL.revokeObjectURL(url);
            }
          }
          cache.clear();
        }
      }
    },
    onSuccess: async (_, profileId) => {
      // 重置执行状态
      atomStore.set(isExecutingAtom, false);
      
      // 自动刷新文件列表
      try {
        if (__PLATFORM__ === __PLATFORM_TAURI__) {
          // Tauri环境：重新扫描当前文件夹
          const currentFolder = atomStore.get(getProfileCurrentFolderAtom(profileId));
          if (currentFolder) {
            console.log('🔄 [执行完成] 自动刷新文件列表');
            
            // 清理React Query缓存，确保文件信息重新查询
            queryClient.removeQueries({ 
              queryKey: [QueryType.FileItemInfo],
              exact: false 
            });
            
            // 清理缩略图缓存（文件重命名后需要重新生成）
            const cache = window.__THUMBNAIL_CACHE__;
            if (cache) {
              cache.clear();
              console.log('🧹 [执行完成] 清理了缓存的缩略图');
            }
            
            // 重新扫描文件夹
            const { invoke } = await import('@tauri-apps/api');
            const files = await invoke<string[]>('read_dir', { path: currentFolder });
            
            // 更新文件列表
            atomStore.set(getProfileFilesAtom(profileId), files);
            
            // 清空选中状态（因为文件名可能已改变）
            atomStore.set(getProfileSelectedFilesAtom(profileId), []);
            atomStore.set(getProfileSelectedThumbnailAtom(profileId), null);
            
            console.log(`✅ [执行完成] 文件列表已自动刷新，共 ${files.length} 个文件`);
          }
        } else {
          // Web环境：刷新当前文件夹
          const currentFolder = atomStore.get(currentFolderAtom);
          if (currentFolder && typeof currentFolder !== 'string') {
            console.log('🔄 [执行完成] 自动刷新文件列表');
            
            // 清理缩略图缓存（文件重命名后需要重新生成）
            const cache = window.__THUMBNAIL_CACHE__;
            if (cache) {
              // 释放所有blob URL
              for (const url of cache.values()) {
                if (url && url.startsWith('blob:')) {
                  URL.revokeObjectURL(url);
                }
              }
              cache.clear();
              console.log('🧹 [执行完成] 清理了缓存的缩略图');
            }
            
            // 获取文件夹中的所有文件
            const getAllFiles = async (directoryHandle: FileSystemDirectoryHandle) => {
              const fileHandles: FileSystemFileHandle[] = [];
              for await (const [, handle] of directoryHandle.entries()) {
                if (handle.kind === 'file') {
                  fileHandles.push(handle);
                }
              }
              return fileHandles;
            };
            
            const files = await getAllFiles(currentFolder);
            
            // 更新文件列表
            atomStore.set(filesAtom, files);
            
            // 清空选中状态
            atomStore.set(selectedFilesAtom, []);
            atomStore.set(selectedThumbnailAtom, null);
            
            console.log(`✅ [执行完成] 文件列表已自动刷新，共 ${files.length} 个文件`);
          }
        }
      } catch (error) {
        console.error('❌ [执行完成] 自动刷新文件列表失败:', error);
        // 刷新失败时，至少清理缓存让用户手动刷新时能看到最新数据
        queryClient.removeQueries({ 
          queryKey: [QueryType.FileItemInfo],
          exact: false 
        });
      }
    },
    onError: (error) => {
      // 重置执行状态
      atomStore.set(isExecutingAtom, false);
      console.error('执行失败:', error);
    },
  });

  const { mutate: execUndo } = useMutation({
    mutationFn: async (undoOperation: UndoOperation) => {
      if (__PLATFORM__ === __PLATFORM_TAURI__) {
        const { invoke } = await import('@tauri-apps/api');
        let successCount = 0;
        let failedCount = 0;
        
        // 反向执行撤销操作（新路径 -> 旧路径）
        for (const op of undoOperation.operations) {
          try {
            await invoke('rename', {
              old: op.newPath,
              new: op.oldPath,
            });
            successCount++;
          } catch (error) {
            console.error(`撤销失败: ${op.newPath} -> ${op.oldPath}`, error);
            failedCount++;
          }
        }
        
        if (failedCount === 0) {
          toast.success(`成功撤销 ${successCount} 个文件的重命名操作`);
          
          // 重新读取文件列表
          const currentFolder = __PLATFORM__ === __PLATFORM_TAURI__ 
            ? atomStore.get(getProfileCurrentFolderAtom(params.profileId))
            : atomStore.get(currentFolderAtom);
          if (currentFolder && typeof currentFolder === 'string') {
            const files = await invoke<string[]>('read_dir', { path: currentFolder });
            // 更新正确的文件列表atom
            if (__PLATFORM__ === __PLATFORM_TAURI__) {
              atomStore.set(getProfileFilesAtom(params.profileId), files);
            } else {
              atomStore.set(filesAtom, files);
            }
          }
          
          // 从历史记录中移除已撤销的操作
          atomStore.set(undoHistoryAtom, (prevHistory) => 
            prevHistory.filter(h => h.id !== undoOperation.id)
          );
        } else {
          toast.error(`撤销操作完成：成功 ${successCount} 个，失败 ${failedCount} 个`);
        }
      } else {
        toast.info('Web环境暂不支持撤销功能');
      }
    },
  });

  function handleExecClick() {
    showConfirm({
      title: '确定执行？',
      description: '执行后可以通过撤销按钮恢复',
      onOk: () => {
        params.profileId && execProfile(params.profileId);
      },
    });
  }

  function handleUndoClick() {
    const undoHistory = atomStore.get(undoHistoryAtom);
    if (undoHistory.length === 0) {
      toast.info('没有可撤销的操作');
      return;
    }
    
    const lastOperation = undoHistory[0];
    const operationTime = new Date(lastOperation.timestamp).toLocaleString();
    
    showConfirm({
      title: '确定撤销？',
      description: `将撤销 ${operationTime} 的重命名操作（${lastOperation.operations.length} 个文件）`,
      onOk: () => {
        execUndo(lastOperation);
      },
    });
  }

  // 以下函数未使用，可以注释或删除
  /*
  async function executeAllRenames() {
    try {
      setPendingOperation(true);
      setRenameStats({
        total: 0,
        success: 0,
        failed: 0,
        messages: []
      });

      const fileItemRefs = window.__FILE_ITEM_REFS__;
      if (!fileItemRefs) {
        console.error('无法获取文件引用');
        return;
      }

      // 筛选出所有待重命名的文件及其引用
      const pendingRenames = Array.from(fileItemRefs.entries())
        .filter(([_, ref]) => ref.current?.hasPendingRename())
        .map(([_, ref]) => ref);

      if (pendingRenames.length === 0) {
        toast.info('没有待执行的重命名操作');
        return;
      }

      let stats = {
        total: pendingRenames.length,
        success: 0,
        failed: 0,
        messages: [] as string[]
      };

      // 执行所有重命名操作
      const promises = Array.from(fileItemRefs.entries())
        .filter(([_, ref]) => ref.current?.hasPendingRename())
        .map(async ([_, ref]) => {
          try {
            const success = await ref.current?.executeRename();
            if (success) {
              stats.success++;
            } else {
              stats.failed++;
              stats.messages.push('重命名操作失败');
            }
          } catch (error) {
            stats.failed++;
            stats.messages.push(`错误: ${error instanceof Error ? error.message : String(error)}`);
          }
        });

      await Promise.all(promises);
      setRenameStats(stats);

      // 显示统计结果
      if (stats.failed === 0) {
        toast.success(`所有 ${stats.total} 个文件重命名成功！`);
      } else {
        toast.error(`已完成 ${stats.total} 个重命名操作，成功: ${stats.success}，失败: ${stats.failed}`);
      }
    } catch (error) {
      console.error('执行所有重命名操作失败:', error);
      toast.error(`执行重命名操作失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPendingOperation(false);
    }
  }
  */

  return (
    <div className="flex size-full bg-white">
      <animated.nav
        style={navStyle}
        className="h-full overflow-hidden border-r"
      >
        <div className="h-[calc(100%-3.5rem)] w-full">
          <ScrollArea className="size-full">
            <ProfileNavList />
          </ScrollArea>
        </div>
        <div className="flex h-14 w-full items-center justify-center border-t px-2">
          <Button
            variant="ghost"
            className="w-full rounded text-sm"
            size="sm"
            onClick={() => {
              execAddProfile({
                name: '新配置',
                rules: [], // 确保新配置是空白的，不继承任何默认规则
              });
            }}
          >
            添加配置
          </Button>
        </div>
      </animated.nav>
      <main className="h-full flex-1">
        <div className="flex h-12 w-full items-center justify-between px-2 pr-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidePanelOpened((prevOpend) => !prevOpend)}
            asChild
          >
            <animated.button style={addProfileButtonStyle}>
              <IconLayoutSidebarLeftCollapse />
            </animated.button>
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleUndoClick} variant="outline" disabled={isExecuting}>
              撤销
            </Button>
            <Button size="sm" onClick={handleExecClick} disabled={isExecPending}>
              {isExecPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  执行中...
                </>
              ) : (
                "执行"
              )}
            </Button>
          </div>
        </div>
        <div className="h-[calc(100%-3rem)] w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
