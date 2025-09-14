import { FilesPanel } from '@/components/file/files-panel';
import { RulesPanel } from '@/components/rule/rules-panel';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import { atomStore } from '@/lib/atoms';
import { loadProfileStateFromStorage, getProfileFilesAtom, getProfileSelectedFilesAtom, getProfileSelectedThumbnailAtom, getProfileCurrentFolderAtom } from '@/lib/atoms/profile-state';
import { useQueryClient } from '@tanstack/react-query';
import { QueryType } from '@/lib/query';

export const Route = createFileRoute('/profile/$profileId')({
  component: Component,
});

function Component() {
  const { profileId } = Route.useParams();
  const queryClient = useQueryClient();
  
  console.log(`🌟 [Component] Profile组件已加载，profileId: ${profileId}`);

  // 在组件挂载时加载保存的配置状态
  useEffect(() => {
    const loadState = async () => {
      try {
        console.log(`🚀 [应用启动] 开始加载配置状态，profileId: ${profileId}`);
        await loadProfileStateFromStorage(profileId, atomStore);
        
        // 获取当前状态中的文件夹路径
        const currentState = atomStore.get(getProfileCurrentFolderAtom(profileId));
        console.log(`🚀 [应用启动] 获取到的文件夹路径: ${currentState}`);
        
        // 如果有文件夹路径，重新扫描文件夹
        if (currentState && typeof currentState === 'string') {
          console.log(`✅ [应用启动] 检测到保存的文件夹路径: ${currentState}`);
          
          // 检查是否在Tauri环境下
          // @ts-ignore
          const isTauri = typeof window !== 'undefined' && window.__TAURI_IPC__;
          console.log(`🔍 [应用启动] Tauri环境检查: ${isTauri}`);
          
          if (isTauri) {
            try {
              const { invoke } = await import('@tauri-apps/api');
              
              // 首先检查文件夹是否还存在
              console.log(`🔍 [应用启动] 检查文件夹是否存在: ${currentState}`);
              const folderExists = await invoke<boolean>('exists', { path: currentState });
              console.log(`📁 [应用启动] 文件夹存在性检查结果: ${folderExists}`);
              
              if (!folderExists) {
                console.log(`⚠️ [应用启动] 文件夹不存在，保持路径但清空文件列表: ${currentState}`);
                // 文件夹不存在，清空文件列表但保持文件夹路径（让用户知道之前选择过哪个文件夹）
                atomStore.set(getProfileFilesAtom(profileId), []);
                atomStore.set(getProfileSelectedFilesAtom(profileId), []);
                atomStore.set(getProfileSelectedThumbnailAtom(profileId), null);
                
                // 设置文件夹不存在状态
                const { getProfileFolderExistsAtom } = await import('@/lib/atoms');
                atomStore.set(getProfileFolderExistsAtom(profileId), false);
                console.log(`⚠️ [应用启动] 已设置文件夹不存在状态: false`);
                
                // 清理缓存
                const cache = window.__THUMBNAIL_CACHE__;
                if (cache) {
                  cache.clear();
                  console.log('🧹 [应用启动] 清理了缓存的缩略图');
                }
                return; // 不继续扫描文件
              }
              
              // 文件夹存在，继续正常流程
              console.log(`✅ [应用启动] 文件夹存在，继续扫描`);
              
              // 设置文件夹存在状态
              const { getProfileFolderExistsAtom } = await import('@/lib/atoms');
              atomStore.set(getProfileFolderExistsAtom(profileId), true);
              console.log(`✅ [应用启动] 已设置文件夹存在状态: true`);
              
              // 清理React Query缓存，确保文件信息重新查询
              console.log('🧹 [应用启动] 清理React Query文件信息缓存');
              queryClient.removeQueries({ 
                queryKey: [QueryType.FileItemInfo],
                exact: false 
              });
              
              // 清理缩略图缓存（应用重启后需要重新生成）
              const cache = window.__THUMBNAIL_CACHE__;
              if (cache) {
                cache.clear();
                console.log('🧹 [应用启动] 清理了缓存的缩略图');
              }
              
              // 重新扫描文件夹
              console.log(`📂 [应用启动] 重新扫描文件夹: ${currentState}`);
              const files = await invoke<string[]>('read_dir', { path: currentState });
              console.log(`📂 [应用启动] 扫描完成，找到 ${files.length} 个文件`);
              
              // 更新文件列表
              console.log('📝 [应用启动] 更新文件列表到atom');
              atomStore.set(getProfileFilesAtom(profileId), files);
              
              // 清空选中状态
              atomStore.set(getProfileSelectedFilesAtom(profileId), []);
              atomStore.set(getProfileSelectedThumbnailAtom(profileId), null);
              
              // 强制刷新组件，确保缩略图重新加载
              setTimeout(() => {
                console.log('⏰ [应用启动] 延迟触发文件列表更新，确保缩略图重新生成');
                // 触发一次状态更新，强制组件重新渲染
                atomStore.set(getProfileFilesAtom(profileId), [...files]);
              }, 100);
              
            } catch (error) {
              console.error('❌ [应用启动] 重新扫描文件夹失败:', error);
            }
          }
        } else {
          console.log('❌ [应用启动] 没有保存的文件夹路径');
        }
      } catch (error) {
        console.error('❌ [应用启动] 加载配置状态失败:', error);
      }
    };
    
    loadState();
  }, [profileId, queryClient]);

  return (
    <div className="flex size-full flex-col gap-y-2 px-4 py-2">
      <fieldset className="h-2/3 w-full rounded border p-4 pt-2">
        <legend className="font-bold text-sm">操作文件</legend>
        <Suspense fallback="...">
          <FilesPanel profileId={profileId} />
        </Suspense>
      </fieldset>
      <fieldset className="h-1/3 w-full rounded border p-4 pt-2">
        <legend className="font-bold text-sm">处理规则</legend>
        <RulesPanel profileId={profileId} />
      </fieldset>
    </div>
  );
}
