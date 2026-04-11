import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { CheckCircle, XCircle, Users, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";

export const Route = createFileRoute("/_auth/admin-approvals")({
  beforeLoad: async ({ context }: { context: { user?: { role?: string } } }) => {
    if ((context.user as any)?.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminApprovalsPage,
});

function AdminApprovalsPage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const { data: profile } = trpc.user.profile.useQuery();
  const { data: pending = [], refetch } = trpc.user.listPendingApprovals.useQuery(undefined, {
    enabled: profile?.role === "admin",
  });
  const approveMutation = trpc.user.approveUser.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard:approvedSuccess"));
      refetch();
    },
  });
  const refuseMutation = trpc.user.refuseUser.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard:refusedSuccess"));
      refetch();
    },
  });

  const [refuseTarget, setRefuseTarget] = useState<string | null>(null);

  // Redirect non-admins
  if (profile && profile.role !== "admin") {
    navigate({ to: "/dashboard" as any });
    return null;
  }

  return (
    <div className="px-6 py-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common:backToDashboard")}
        </Link>
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("dashboard:adminApprovals")}</h1>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{t("dashboard:noApprovals")}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t("common:signUp.name")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("common:signUp.email")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("common:signUp.role")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("common:create")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {pending.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {t(`common:roles.${u.role}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-3 text-xs"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate({ targetUserId: u.id })}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t("dashboard:approveButton")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-3 text-xs"
                        disabled={refuseMutation.isPending}
                        onClick={() => setRefuseTarget(u.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        {t("dashboard:refuseButton")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!refuseTarget} onOpenChange={() => setRefuseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard:refuseButton")}</DialogTitle>
            <DialogDescription>{t("dashboard:refuseConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefuseTarget(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={refuseMutation.isPending}
              onClick={() => {
                if (refuseTarget) {
                  refuseMutation.mutate({ targetUserId: refuseTarget });
                  setRefuseTarget(null);
                }
              }}
            >
              {t("dashboard:refuseButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
