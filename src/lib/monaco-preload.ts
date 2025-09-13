/**
 * Monaco Editor 预加载模块
 * 用于在应用启动时预先初始化 Monaco Editor，减少首次加载脚本规则时的等待时间
 */

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

let isPreloaded = false;
let preloadPromise: Promise<void> | null = null;

/**
 * 预加载 Monaco Editor
 * 创建一个隐藏的编辑器实例来触发 Monaco 的初始化过程
 */
export function preloadMonacoEditor(): Promise<void> {
  if (isPreloaded) {
    return Promise.resolve();
  }

  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = new Promise((resolve) => {
    // 创建一个隐藏的容器元素
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.position = 'absolute';
    hiddenContainer.style.top = '-9999px';
    hiddenContainer.style.left = '-9999px';
    hiddenContainer.style.width = '1px';
    hiddenContainer.style.height = '1px';
    hiddenContainer.style.visibility = 'hidden';
    document.body.appendChild(hiddenContainer);

    // 创建一个临时编辑器来触发 Monaco 的初始化
    const tempEditor = monaco.editor.create(hiddenContainer, {
      value: '// Monaco Editor 预加载中...',
      language: 'javascript',
      theme: 'vs-dark',
      automaticLayout: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
    });

    // 等待编辑器完全初始化
    setTimeout(() => {
      // 清理临时编辑器
      tempEditor.dispose();
      document.body.removeChild(hiddenContainer);
      
      isPreloaded = true;
      console.log('Monaco Editor 预加载完成');
      resolve();
    }, 100);
  });

  return preloadPromise;
}

/**
 * 检查 Monaco Editor 是否已预加载
 */
export function isMonacoPreloaded(): boolean {
  return isPreloaded;
}

/**
 * 获取预加载状态
 */
export function getPreloadStatus(): 'not-started' | 'loading' | 'completed' {
  if (isPreloaded) return 'completed';
  if (preloadPromise) return 'loading';
  return 'not-started';
}
