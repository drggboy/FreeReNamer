import { GlobalAlert } from '@/components/global/global-alert';
import { GlobalDialog } from '@/components/global/global-dialog';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: () => (
      <div className="h-screen w-screen bg-neutral-100 supports-[height:100dvh]:h-dvh supports-[width:100dvw]:w-dvw animate-in fade-in duration-500">
        <div className="h-full w-full animate-in slide-in-from-bottom-2 duration-700 delay-200">
          <Outlet />
        </div>
        <GlobalDialog />
        <GlobalAlert />
      </div>
    ),
  },
);
