import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { ShieldAlert, Plus } from "lucide-react";

export const Route: any = createFileRoute("/_auth/admin-breaches")({
  beforeLoad: async ({ context }: { context: { user?: { role?: string } } }) => {
    if ((context.user as any)?.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminBreachesPage,
});

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  investigating: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function AdminBreachesPage() {
  const { data: profile } = trpc.user.profile.useQuery();
  const { data: breaches = [], refetch } = trpc.privacy.listBreaches.useQuery(undefined, {
    enabled: profile?.role === "admin",
  });

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [dataTypes, setDataTypes] = useState("");
  const [usersAffected, setUsersAffected] = useState(0);
  const [remediation, setRemediation] = useState("");

  const createMutation = trpc.privacy.createBreach.useMutation({
    onSuccess: () => {
      toast.success("Breach recorded");
      setShowCreate(false);
      resetForm();
      void refetch();
    },
  });

  const updateMutation = trpc.privacy.updateBreach.useMutation({
    onSuccess: () => {
      toast.success("Breach updated");
      void refetch();
    },
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setSeverity("medium");
    setDataTypes("");
    setUsersAffected(0);
    setRemediation("");
  }

  if (profile?.role !== "admin") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 py-6 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <h1 className="text-2xl font-bold">Privacy Breach Register</h1>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Record Breach
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Quebec Law 25 requires maintaining a register of confidentiality incidents and reporting breaches to the CAI within 72 hours.
      </p>

      {breaches.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-8 text-center">No breach records.</p>
      ) : (
        <div className="space-y-3">
          {breaches.map((b) => (
            <div key={b.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-sm">{b.title}</h3>
                <div className="flex gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[b.severity]}`}>
                    {b.severity}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                    {b.status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{b.description}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Discovered: {new Date(b.discoveredAt).toLocaleDateString()}</span>
                <span>Users affected: {b.usersAffected}</span>
                {b.dataTypesAffected && <span>Data types: {b.dataTypesAffected}</span>}
                {b.reportedToCaiAt && <span>Reported to CAI: {new Date(b.reportedToCaiAt).toLocaleDateString()}</span>}
                {b.usersNotifiedAt && <span>Users notified: {new Date(b.usersNotifiedAt).toLocaleDateString()}</span>}
              </div>
              {b.remediationSteps && (
                <p className="text-xs bg-muted/50 rounded p-2">{b.remediationSteps}</p>
              )}
              <div className="flex gap-2 pt-1">
                {b.status !== "investigating" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => updateMutation.mutate({ id: b.id, status: "investigating" })}
                    disabled={updateMutation.isPending}
                  >
                    Mark Investigating
                  </Button>
                )}
                {b.status !== "resolved" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => updateMutation.mutate({ id: b.id, status: "resolved" })}
                    disabled={updateMutation.isPending}
                  >
                    Mark Resolved
                  </Button>
                )}
                {!b.reportedToCaiAt && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => updateMutation.mutate({ id: b.id, reportedToCaiAt: new Date().toISOString() })}
                    disabled={updateMutation.isPending}
                  >
                    Mark Reported to CAI
                  </Button>
                )}
                {!b.usersNotifiedAt && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => updateMutation.mutate({ id: b.id, usersNotifiedAt: new Date().toISOString() })}
                    disabled={updateMutation.isPending}
                  >
                    Mark Users Notified
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create breach dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Privacy Breach</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Severity</Label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Users Affected</Label>
                <Input
                  type="number"
                  min={0}
                  value={usersAffected}
                  onChange={(e) => setUsersAffected(Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Types Affected</Label>
              <Input value={dataTypes} onChange={(e) => setDataTypes(e.target.value)} className="h-8 text-sm" placeholder="e.g. health records, chat messages" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remediation Steps</Label>
              <textarea
                value={remediation}
                onChange={(e) => setRemediation(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate({
                title,
                description,
                severity,
                dataTypesAffected: dataTypes || undefined,
                usersAffected,
                discoveredAt: new Date().toISOString(),
                remediationSteps: remediation || undefined,
              })}
              disabled={!title.trim() || !description.trim() || createMutation.isPending}
            >
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
