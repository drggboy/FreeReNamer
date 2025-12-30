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

const MIN_WINDOW_WIDTH = 1100;
const MIN_WINDOW_HEIGHT = 600;

/**
 * 设置并强制桌面端窗口最小尺寸
 */
export const enforceTauriWindowMinSize = async (): Promise<(() => void) | undefined> => {
  try {
    if (!isTauriEnvironment()) {
      return undefined;
    }

    const { appWindow, LogicalSize } = await import('@tauri-apps/api/window');
    const minSize = new LogicalSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT);

    await appWindow.setMinSize(minSize);

    type SizeLike = {
      width: number;
      height: number;
      toLogical?: (factor: number) => { width: number; height: number };
    };

    const toLogicalSize = (size: SizeLike, scaleFactor: number) => {
      if (typeof size.toLogical === 'function') {
        return size.toLogical(scaleFactor);
      }
      return new LogicalSize(size.width / scaleFactor, size.height / scaleFactor);
    };

    const ensureMinSize = async (size: SizeLike) => {
      const scaleFactor = await appWindow.scaleFactor();
      const logicalSize = toLogicalSize(size, scaleFactor);

      if (logicalSize.width < MIN_WINDOW_WIDTH || logicalSize.height < MIN_WINDOW_HEIGHT) {
        await appWindow.setSize(
          new LogicalSize(
            Math.max(logicalSize.width, MIN_WINDOW_WIDTH),
            Math.max(logicalSize.height, MIN_WINDOW_HEIGHT),
          ),
        );
      }
    };

    const currentSize = await appWindow.innerSize();
    await ensureMinSize(currentSize);

    const unlisten = await appWindow.onResized(async ({ payload }) => {
      await ensureMinSize(payload);
    });

    return () => {
      unlisten();
    };
  } catch (error) {
    console.error('Failed to enforce Tauri window min size:', error);
    return undefined;
  }
};
