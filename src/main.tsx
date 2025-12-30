import ReactDOM from 'react-dom/client';
import './styles.css';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { atomStore } from './lib/atoms';
import { Toaster } from 'sonner';
import { preloadMonacoEditor } from './lib/monaco-preload';
import { AppLoading } from './components/loading/app-loading';
import { Suspense, useEffect } from 'react';
import { enforceTauriWindowMinSize, isTauriEnvironment } from './lib/tauri-window';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分钟内数据被视为新鲜，不会重新获取
      gcTime: 1000 * 60 * 10, // 10分钟内数据保留在缓存中
    },
  },
});

const router = createRouter({ routeTree, context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/**
 * 延迟预加载 Monaco Editor
 * 避免阻塞应用启动，在应用渲染完成后再加载
 */
const delayedPreloadMonaco = () => {
  // 延迟更长时间，确保应用已完全启动
  setTimeout(() => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        preloadMonacoEditor().catch(console.error);
      }, { timeout: 10000 });
    } else {
      setTimeout(() => {
        preloadMonacoEditor().catch(console.error);
      }, 2000);
    }
  }, 3000);
};

/**
 * 应用主组件
 * 包含启动优化和Tauri窗口显示逻辑
 */
const App = () => {
  useEffect(() => {
    console.log('App initialized');
    
    // 启动Monaco Editor延迟预加载
    delayedPreloadMonaco();

    let unlistenResize: (() => void) | undefined;
    if (isTauriEnvironment()) {
      enforceTauriWindowMinSize().then((cleanup) => {
        unlistenResize = cleanup;
      });
    }

    return () => {
      unlistenResize?.();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={atomStore}>
        <Suspense fallback={<AppLoading />}>
          <RouterProvider router={router} />
        </Suspense>
        <Toaster position="top-right" richColors />
      </Provider>
    </QueryClientProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
