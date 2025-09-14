/**
 * Tauri窗口管理工具
 * 提供窗口显示/隐藏等操作
 */

/**
 * 显示Tauri应用窗口
 * 在应用内容加载完成后调用
 */
export const showTauriWindow = async (): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.__TAURI__) {
      const { appWindow } = await import('@tauri-apps/api/window');
      await appWindow.show();
    }
  } catch (error) {
    console.error('Failed to show Tauri window:', error);
  }
};

/**
 * 隐藏Tauri应用窗口
 */
export const hideTauriWindow = async (): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.__TAURI__) {
      const { appWindow } = await import('@tauri-apps/api/window');
      await appWindow.hide();
    }
  } catch (error) {
    console.error('Failed to hide Tauri window:', error);
  }
};

/**
 * 检查是否在Tauri环境中运行
 */
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.__TAURI__);
};
