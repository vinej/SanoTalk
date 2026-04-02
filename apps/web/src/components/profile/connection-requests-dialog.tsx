import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function ConnectionRequestsDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation(["dashboard", "common"]);
  const utils = trpc.useUtils();

  const { data: requests = [], isLoading } = trpc.user.listPendingRequests.useQuery(
    undefined,
    { enabled: open }
  );

  const respond = trpc.user.respondToRequest.useMutation({
    onSuccess: () => {
      void utils.user.listPendingRequests.invalidate();
      void utils.user.listLinkedUsers.invalidate();
      void utils.user.listFriends.invalidate();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("dashboard:requestsTitle")}</DialogTitle>
          <DialogDescription>{t("dashboard:requestsDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground">…</p>
          )}
          {!isLoading && requests.length === 0 && (
            <p className="text-sm text-muted-foreground italic">{t("dashboard:requestsEmpty")}</p>
          )}
          {requests.map((req) => {
            const from = (req as any).fromUser;
            const description =
              req.type === "link"
                ? t("dashboard:linkRequest", { name: from?.name ?? from?.id, role: from?.role })
                : t("dashboard:friendRequest", { name: from?.name ?? from?.id });

            return (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{from?.name ?? from?.id}</p>
                  <p className="text-xs text-muted-foreground truncate">{description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => respond.mutate({ requestId: req.id, response: "refused" })}
                    disabled={respond.isPending}
                  >
                    {t("dashboard:refuse")}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => respond.mutate({ requestId: req.id, response: "accepted" })}
                    disabled={respond.isPending}
                  >
                    {t("dashboard:accept")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
