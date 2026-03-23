import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../../lib/trpc";
import { Button } from "../../../components/ui/button";

export const Route = createFileRoute("/_auth/sessions/new")({
  component: NewSessionPage,
});

function NewSessionPage() {
  const navigate = useNavigate();
  const createSession = trpc.sessions.create.useMutation({
    onSuccess: (session) => {
      if (session) navigate({ to: `/sessions/${session.id}` as any });
    },
  });

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">New Session</h1>
        <p className="text-muted-foreground">Start a new medical consultation session.</p>
        <Button
          onClick={() => createSession.mutate({})}
          disabled={createSession.isPending}
        >
          {createSession.isPending ? "Creating…" : "Start Session"}
        </Button>
        {createSession.isError && (
          <p className="text-destructive text-sm">{createSession.error.message}</p>
        )}
      </div>
    </div>
  );
}
