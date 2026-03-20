import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/components/sessions/session-card";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: sessions, isLoading } = trpc.sessions.list.useQuery();
  const { context } = Route.useRouteContext();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground mt-1">
            Manage your medical consultations
          </p>
        </div>
        <Button asChild>
          <Link to="/sessions/new">
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions?.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
          {!sessions?.length && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              No sessions yet. Create your first one!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
