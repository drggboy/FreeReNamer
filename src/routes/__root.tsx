import { GlobalAlert } from '@/components/global/global-alert';
import { GlobalDialog } from '@/components/global/global-dialog';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';

const RootComponent = () => {
  useEffect(() => {
    // 只在生产环境且为Tauri环境时禁用右键菜单
    const isProduction = import.meta.env.PROD;
    // @ts-ignore
    const isTauri = typeof window !== 'undefined' && window.__TAURI_IPC__;
    
    // 环境检测完成
    
    // 只在生产环境且为Tauri环境时禁用右键菜单
    if (isProduction && isTauri) {
      // 添加CSS类来禁用右键菜单样式
      document.body.classList.add('disable-context-menu');
      
      const handleContextMenu = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        // 检查是否在输入框等可编辑元素内
        if (target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' || 
            target.contentEditable === 'true') {
          return true;
        }
        
        // 检查是否在有 allow-context-menu class 的元素内
        const allowedElement = target.closest('.allow-context-menu');
        if (allowedElement) {
          return true;
        }
        
        // 空白区域或其他地方，禁用默认右键菜单
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      const handleSelectStart = (e: Event) => {
        const target = e.target as HTMLElement;
        
        // 允许Monaco Editor中的文本选择（优先检查，因为Monaco用的是普通div）
        const isInMonacoEditor = target.closest('.monaco-editor');
        if (isInMonacoEditor) {
          // 完全不干预Monaco Editor的选择事件
          e.stopPropagation();
          return true;
        }
        
        // 允许输入框和可编辑元素的文本选择
        if (target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' || 
            target.contentEditable === 'true') {
          return true;
        }
        
        // 允许自定义右键菜单相关元素的文本选择
        const isInContextMenuTrigger = target.closest('[data-radix-context-menu-trigger]');
        const isInContextMenuContent = target.closest('[data-radix-context-menu-content]');
        const isInContextMenuPortal = target.closest('[data-radix-context-menu-portal]');
        const isInAllowContextMenu = target.closest('.allow-context-menu');
        
        if (isInContextMenuTrigger || isInContextMenuContent || isInContextMenuPortal || isInAllowContextMenu) {
          return true;
        }
        
        // 其他地方禁用文本选择
        e.preventDefault();
        return false;
      };

      // 禁用F12开发者工具（生产环境）
      const handleKeyDown = (e: KeyboardEvent) => {
        // 禁用F12
        if (e.key === 'F12') {
          e.preventDefault();
          return false;
        }
        // 禁用Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
          e.preventDefault();
          return false;
        }
        // 禁用Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
          e.preventDefault();
          return false;
        }
        // 禁用Ctrl+U (查看源代码)
        if (e.ctrlKey && e.key === 'u') {
          e.preventDefault();
          return false;
        }
      };

      // 添加事件监听器
      // selectstart使用捕获阶段，但不使用passive以允许preventDefault
      document.addEventListener('contextmenu', handleContextMenu, true);
      document.addEventListener('selectstart', handleSelectStart, { capture: true, passive: false });
      document.addEventListener('keydown', handleKeyDown, true);

      // 清理函数
      return () => {
        document.body.classList.remove('disable-context-menu');
        document.removeEventListener('contextmenu', handleContextMenu, true);
        document.removeEventListener('selectstart', handleSelectStart, { capture: true, passive: false } as any);
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, []);

  // 检查是否应该禁用右键菜单
  const isProduction = import.meta.env.PROD;
  // @ts-ignore
  const isTauri = typeof window !== 'undefined' && window.__TAURI_IPC__;
  const shouldDisableContextMenu = isProduction && isTauri;

  return (
    <div className={`h-screen w-screen bg-neutral-100 supports-[height:100dvh]:h-dvh supports-[width:100dvw]:w-dvw animate-in fade-in duration-500 ${shouldDisableContextMenu ? 'disable-context-menu' : ''}`}>
      <div className="h-full w-full animate-in slide-in-from-bottom-2 duration-700 delay-200">
        <Outlet />
      </div>
      <GlobalDialog />
      <GlobalAlert />
    </div>
  );
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootComponent,
  },
);
