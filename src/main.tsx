import ReactDOM from 'react-dom/client';
import './styles.css';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { atomStore } from './lib/atoms';
import { Toaster } from 'sonner';
import { preloadMonacoEditor } from './lib/monaco-preload';

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

// 在应用启动时预加载 Monaco Editor
// 使用 requestIdleCallback 在浏览器空闲时进行预加载，避免阻塞主线程
const preload = () => {
  preloadMonacoEditor().catch(console.error);
};

if (window.requestIdleCallback) {
  // 在浏览器空闲时预加载，超时时间为 5 秒
  window.requestIdleCallback(preload, { timeout: 5000 });
} else {
  // 降级到 setTimeout
  setTimeout(preload, 1000);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <Provider store={atomStore}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </Provider>
  </QueryClientProvider>,
);
