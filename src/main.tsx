import ReactDOM from 'react-dom/client';
import './styles.css';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { atomStore } from './lib/atoms';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分钟内数据被视为新鲜，不会重新获取
      cacheTime: 1000 * 60 * 10, // 10分钟内数据保留在缓存中
    },
  },
});

const router = createRouter({ routeTree, context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <Provider store={atomStore}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </Provider>
  </QueryClientProvider>,
);
