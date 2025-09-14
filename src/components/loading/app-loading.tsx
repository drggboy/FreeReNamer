import type { FC } from 'react';

/**
 * 应用加载组件
 * 在应用初始化时显示加载状态，带有淡入动画效果
 */
export const AppLoading: FC = () => {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-100 animate-in fade-in duration-300">
      <div className="flex flex-col items-center space-y-4 animate-in slide-in-from-bottom-4 duration-500 delay-150">
        {/* 加载动画 */}
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-300 border-t-blue-600 drop-shadow-sm"></div>
        
        {/* 应用标题 */}
        <div className="text-xl font-semibold text-neutral-700 tracking-wide">
          FreeReNamer
        </div>
        
        {/* 加载提示 */}
        <div className="text-sm text-neutral-500 animate-pulse">
          正在启动应用...
        </div>
        
        {/* 进度指示器 */}
        <div className="mt-4 h-1 w-32 bg-neutral-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full animate-pulse w-full"></div>
        </div>
      </div>
    </div>
  );
};
