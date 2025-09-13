import { ProfileNavList } from '@/components/profile/profile-nav-list';
import { createFileRoute, Outlet, useParams, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addProfile, getProfile, type Profile } from '@/lib/profile';
import { QueryType } from '@/lib/query';
import { IconLayoutSidebarLeftCollapse } from '@tabler/icons-react';
import { atomStore, filesAtom, fileSortConfigAtom, undoHistoryAtom, currentFolderAtom, getProfileFilesAtom, getProfileFileSortConfigAtom, getProfileSelectedFilesAtom, getProfileCurrentFolderAtom, type UndoOperation } from '@/lib/atoms';
import { execRules } from '@/lib/rule';
import { getFileInfo } from '@/lib/file';
import { getSortedFileIndices } from '@/lib/queries/file';
import { ScrollArea } from '@/components/ui/scroll-area';
import { showConfirm, showRenameDialog } from '@/lib/ui';
import { toast } from 'sonner';
import { updateProfile } from '@/lib/profile';

export const Route = createFileRoute('/profile')({
  component: Component,
});

function Component() {
  const queryClient = useQueryClient();
  const params = useParams({ from: '/profile/$profileId' });
  const navigate = useNavigate();
  const [sidePanelOpened, setSidePanelOpened] = useState(false);

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

  const { mutate: execProfile } = useMutation({
    mutationFn: async (profileId: string) => {
      const profile = await getProfile(profileId);
      // 根据平台获取正确的文件列表
      const files = __PLATFORM__ === __PLATFORM_TAURI__ 
        ? atomStore.get(getProfileFilesAtom(profileId))
        : atomStore.get(filesAtom);
      
      // 首先尝试执行所有待处理的手动修改
      let manualRenamedCount = 0;
      
      try {
        // 获取所有待重命名的文件项引用
        const fileItemRefs = window.__FILE_ITEM_REFS__;
        if (fileItemRefs) {
          // 执行所有待处理的手动修改
          const promises = Array.from(fileItemRefs.entries()).map(async ([_, ref]) => {
            if (ref.current?.hasPendingRename && ref.current.hasPendingRename()) {
              const success = await ref.current.executeRename();
              if (success) {
                manualRenamedCount++;
              }
            }
          });
          
          await Promise.all(promises);
          
          // 显示手动重命名结果
          if (manualRenamedCount > 0) {
            toast.success(`已应用 ${manualRenamedCount} 个手动修改`);
          }
        }
      } catch (error) {
        console.error('执行手动修改失败:', error);
      }
      
      // 然后执行规则重命名（使用两阶段重命名避免文件名交换冲突）
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
      
      if (__PLATFORM__ === __PLATFORM_TAURI__) {
        // Tauri平台：使用两阶段重命名
        const { dirname, join } = await import('@tauri-apps/api/path');
        const { invoke } = await import('@tauri-apps/api');
        
        // 收集所有需要重命名的文件信息
        const renameOperations: Array<{
          originalIndex: number;
          file: string;
          targetName: string;
          tempName?: string;
          tempPath?: string;
          finalPath?: string;
        }> = [];
        
        // 为撤销操作准备记录
        const undoOperations: Array<{
          oldPath: string;
          newPath: string;
        }> = [];
        
        // 第一步：收集所有重命名操作
        for (let displayIndex = 0; displayIndex < sortedIndices.length; displayIndex++) {
          const originalIndex = sortedIndices[displayIndex];
          const file = files[originalIndex] as string;
          
          try {
            const fileInfo = await getFileInfo(file);
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

            renameOperations.push({
              originalIndex,
              file,
              targetName: output,
            });
          } catch (error) {
            console.error(`准备重命名操作失败: ${file}`, error);
            failedCount++;
            failedFiles.push(file);
          }
        }
        
        // 第二步：为所有需要重命名的文件生成临时名称（第一阶段）
        for (const operation of renameOperations) {
          try {
            const dir = await dirname(operation.file);
            const tempName = await invoke<string>('generate_temp_filename', {
              dir: dir,
              originalName: operation.targetName
            });
            const tempPath = await join(dir, tempName);
            const finalPath = await join(dir, operation.targetName);
            
            operation.tempName = tempName;
            operation.tempPath = tempPath;
            operation.finalPath = finalPath;
            
            // 第一阶段：重命名为临时名称
            await invoke('rename', {
              old: operation.file,
              new: tempPath,
            });
            
            console.log(`第一阶段：${operation.file} -> ${tempName}`);
          } catch (error) {
            console.error(`第一阶段重命名失败: ${operation.file}`, error);
            failedCount++;
            failedFiles.push(operation.file);
            // 标记为失败，不参与第二阶段
            operation.tempPath = undefined;
          }
        }
        
        // 第三步：将临时文件重命名为最终名称（第二阶段）
        for (const operation of renameOperations) {
          if (!operation.tempPath || !operation.finalPath) {
            continue; // 跳过第一阶段失败的操作
          }
          
          try {
            // 第二阶段：临时名称 -> 最终名称
            await invoke('rename', {
              old: operation.tempPath,
              new: operation.finalPath,
            });
            
            // 更新文件列表中的路径
            updatedFiles[operation.originalIndex] = operation.finalPath;
            // 记录路径映射，用于更新选中文件列表
            filePathMap.set(operation.file, operation.finalPath);
            // 记录撤销操作
            undoOperations.push({
              oldPath: operation.file,
              newPath: operation.finalPath,
            });
            successCount++;
            
            console.log(`第二阶段：${operation.tempName} -> ${operation.targetName}`);
          } catch (error) {
            console.error(`第二阶段重命名失败: ${operation.tempPath}`, error);
            failedCount++;
            failedFiles.push(operation.file);
            
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
          }
        }
        
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
      
      // 显示执行结果统计
      if (failedCount === 0) {
        toast.success(`所有 ${successCount} 个文件重命名成功！`);
      } else {
        toast.error(`重命名完成：成功 ${successCount} 个，失败 ${failedCount} 个。失败的文件：${failedFiles.slice(0, 3).join(', ')}${failedFiles.length > 3 ? '...' : ''}`);
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
            <Button size="sm" onClick={handleUndoClick} variant="outline">
              撤销
            </Button>
            <Button size="sm" onClick={handleExecClick}>
              执行
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
