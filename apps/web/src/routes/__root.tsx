import {
  createRootRouteWithContext,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });

  return (
    <>
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary animate-pulse" />
      )}
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  );
}
