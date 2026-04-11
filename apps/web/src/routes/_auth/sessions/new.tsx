import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../../lib/trpc";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/sessions/new")({
  component: NewSessionPage,
});

function NewSessionPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("sessions");
  const utils = trpc.useUtils();
  const createSession = trpc.sessions.create.useMutation({
    onSuccess: (session) => {
      if (session) {
        void utils.sessions.list.invalidate();
        navigate({ to: `/sessions/${session.id}` as any });
      }
    },
  });

  return (
    <div className="flex items-center justify-center flex-1">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">{t("new.title")}</h1>
        <p className="text-muted-foreground">{t("new.subtitle")}</p>
        <Button
          onClick={() => createSession.mutate({})}
          disabled={createSession.isPending}
        >
          {createSession.isPending ? t("new.creating") : t("new.start")}
        </Button>
        {createSession.isError && (
          <p className="text-destructive text-sm">{t("new.failed", "Failed to create session. Please try again.")}</p>
        )}
      </div>
    </div>
  );
}
