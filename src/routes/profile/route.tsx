import { ProfileNavList } from '@/components/profile/profile-nav-list';
import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addProfile, getProfile, type Profile } from '@/lib/profile';
import { QueryType } from '@/lib/query';
import { IconLayoutSidebarLeftCollapse } from '@tabler/icons-react';
import { atomStore, filesAtom } from '@/lib/atoms';
import { execRules } from '@/lib/rule';
import { getFileInfo } from '@/lib/file';
import { ScrollArea } from '@/components/ui/scroll-area';
import { showConfirm } from '@/lib/ui';
import { toast } from 'sonner';

export const Route = createFileRoute('/profile')({
  component: Component,
});

function Component() {
  const queryClient = useQueryClient();
  const params = useParams({ from: '/profile/$profileId' });
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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [QueryType.ProfileIds] });
    },
  });

  const { mutate: execProfile } = useMutation({
    mutationFn: async (profileId: string) => {
      const profile = await getProfile(profileId);
      const files = atomStore.get(filesAtom);
      
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
      
      // 然后执行规则重命名
      for (let i = 0, len = files.length; i < len; i++) {
        const file = files[i];
        const fileInfo = await getFileInfo(
          typeof file === 'string' ? file : file.name,
        );

        const output = await execRules(
          profile?.rules?.filter((rule) => rule.enabled) ?? [],
          {
            fileInfo,
            index: i,
          },
        );

        if (!output) {
          continue;
        }

        if (output === fileInfo.fullName) {
          continue;
        }

        if (__PLATFORM__ === __PLATFORM_TAURI__) {
          const { dirname, join } = await import('@tauri-apps/api/path');
          const { invoke } = await import('@tauri-apps/api');
          const dir = await dirname(file as string);
          const outputFile = await join(dir, output);

          await invoke('rename', {
            old: file,
            new: outputFile,
          });
        }

        if (__PLATFORM__ === __PLATFORM_WEB__) {
          await (file as FileSystemFileHandle).move(output);
        }
      }

      atomStore.set(filesAtom, []);
    },
  });

  function handleExecClick() {
    showConfirm({
      title: '确定执行？',
      description: '执行后原文件名无法恢复',
      onOk: () => {
        params.profileId && execProfile(params.profileId);
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
                rules: [],
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
          <Button size="sm" onClick={handleExecClick}>
            执行
          </Button>
        </div>
        <div className="h-[calc(100%-3rem)] w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
