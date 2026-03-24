import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Plus, Trash2, ArrowRight, ArrowLeft, User, Calendar, LayoutDashboard } from "lucide-react";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Link } from "@tanstack/react-router";
import type { Task } from "@sanotalk/db";

export const Route = createFileRoute("/_auth/kanban")({
  component: KanbanPage,
});

type TaskWithUser = Task & { assignedUser: { id: string; name: string } | null };
type UserOption = { id: string; name: string; email: string; role: string };

const COLUMNS: {
  status: Task["status"];
  label: string;
  dot: string;
  border: string;
  bg: string;
  headerBg: string;
  badgeBg: string;
}[] = [
  {
    status: "not_assigned",
    label: "Not Assigned",
    dot: "#94a3b8",
    border: "#cbd5e1",
    bg: "#f8fafc",
    headerBg: "#f1f5f9",
    badgeBg: "#e2e8f0",
  },
  {
    status: "assigned",
    label: "Assigned",
    dot: "#60a5fa",
    border: "#bfdbfe",
    bg: "#eff6ff",
    headerBg: "#dbeafe",
    badgeBg: "#bfdbfe",
  },
  {
    status: "completed",
    label: "Completed",
    dot: "#34d399",
    border: "#a7f3d0",
    bg: "#f0fdf4",
    headerBg: "#dcfce7",
    badgeBg: "#bbf7d0",
  },
];

const STATUS_ORDER: Task["status"][] = ["not_assigned", "assigned", "completed"];

function KanbanPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // User picker dialog (forward arrow from not_assigned)
  const [pickUserOpen, setPickUserOpen] = useState(false);
  const [pickUserTask, setPickUserTask] = useState<TaskWithUser | null>(null);
  const [pickedUserId, setPickedUserId] = useState("");

  // Confirm unassign dialog (back arrow from assigned, or dropdown unassign)
  const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
  const [confirmUnassignTask, setConfirmUnassignTask] = useState<TaskWithUser | null>(null);

  const { t } = useTranslation(["kanban", "common"]);

  const utils = trpc.useUtils();
  const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery();
  const { data: users = [] } = trpc.tasks.listUsers.useQuery();

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      void utils.tasks.list.invalidate();
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
    },
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => void utils.tasks.list.invalidate(),
  });

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => void utils.tasks.list.invalidate(),
  });

  function handleMoveForward(task: TaskWithUser) {
    if (task.status === "not_assigned") {
      // Must pick a user before moving to assigned
      setPickUserTask(task);
      setPickedUserId("");
      setPickUserOpen(true);
    } else {
      const idx = STATUS_ORDER.indexOf(task.status as Task["status"]);
      if (idx + 1 < STATUS_ORDER.length) {
        updateMutation.mutate({ id: task.id, status: STATUS_ORDER[idx + 1] });
      }
    }
  }

  function handleMoveBack(task: TaskWithUser) {
    if (task.status === "assigned") {
      // Confirmation required before removing assignment
      setConfirmUnassignTask(task);
      setConfirmUnassignOpen(true);
    } else {
      const idx = STATUS_ORDER.indexOf(task.status as Task["status"]);
      if (idx - 1 >= 0) {
        updateMutation.mutate({ id: task.id, status: STATUS_ORDER[idx - 1] });
      }
    }
  }

  function handleConfirmAssign() {
    if (!pickUserTask || !pickedUserId) return;
    updateMutation.mutate({
      id: pickUserTask.id,
      status: "assigned",
      assignedUserId: pickedUserId,
    });
    setPickUserOpen(false);
    setPickUserTask(null);
    setPickedUserId("");
  }

  function handleConfirmUnassign() {
    if (!confirmUnassignTask) return;
    updateMutation.mutate({
      id: confirmUnassignTask.id,
      status: "not_assigned",
      assignedUserId: null,
    });
    setConfirmUnassignOpen(false);
    setConfirmUnassignTask(null);
  }

  function handleDropdownChange(task: TaskWithUser, newUserId: string) {
    if (newUserId === "") {
      if (task.assignedUserId) {
        setConfirmUnassignTask(task);
        setConfirmUnassignOpen(true);
      }
    } else {
      const newStatus: Task["status"] = task.status === "not_assigned" ? "assigned" : task.status;
      updateMutation.mutate({
        id: task.id,
        assignedUserId: newUserId,
        status: newStatus,
      });
    }
  }

  function handleCreate() {
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
    });
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* Page header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "white", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>{t("kanban:title")}</h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "2px 0 0 0" }}>
            {t("kanban:tasksTotal", { count: tasks.length })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="sm" variant="outline" asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="w-4 h-4 mr-1.5" />
              {t("common:dashboard")}
            </Link>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            {t("kanban:newTask")}
          </Button>
        </div>
      </div>

      {/* Board */}
      <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", alignItems: "start" }}>
        {COLUMNS.map((col) => {
          const colTasks = (tasks as TaskWithUser[]).filter(
            (t) => t.status === col.status
          );
          return (
            <div key={col.status} style={{ borderRadius: "12px", border: `2px solid ${col.border}`, backgroundColor: col.bg, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              {/* Column header */}
              <div style={{ padding: "12px 16px", backgroundColor: col.headerBg, borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${col.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: col.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "#475569" }}>
                    {t(`kanban:columns.${col.status}`)}
                  </span>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 600, backgroundColor: col.badgeBg, color: "#475569", borderRadius: "999px", padding: "2px 10px" }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {isLoading && (
                  <>
                    <div style={{ height: "80px", borderRadius: "8px", backgroundColor: "#e2e8f0" }} />
                    <div style={{ height: "80px", borderRadius: "8px", backgroundColor: "#e2e8f0" }} />
                  </>
                )}

                {!isLoading && colTasks.length === 0 && (
                  <div style={{ padding: "24px 0", textAlign: "center", fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>
                    {t("kanban:noTasks")}
                  </div>
                )}

                {colTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    users={users}
                    borderColor={col.border}
                    onMoveForward={
                      col.status !== "completed"
                        ? () => handleMoveForward(t)
                        : undefined
                    }
                    onMoveBack={
                      col.status !== "not_assigned"
                        ? () => handleMoveBack(t)
                        : undefined
                    }
                    onDelete={() => deleteMutation.mutate({ id: t.id })}
                    onAssignUser={(userId) => handleDropdownChange(t, userId)}
                    onUnassignUser={() => handleDropdownChange(t, "")}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("kanban:dialog.title")}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Label htmlFor="task-title">{t("kanban:dialog.titleLabel")}</Label>
              <Input
                id="task-title"
                placeholder={t("kanban:dialog.titlePlaceholder")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
                className="!border-slate-400"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Label htmlFor="task-desc">{t("kanban:dialog.descriptionLabel")}</Label>
              <Input
                id="task-desc"
                placeholder={t("kanban:dialog.descriptionPlaceholder")}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="!border-slate-400"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createMutation.isPending}
            >
              {t("common:create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pick user dialog (forward arrow from not_assigned) */}
      <Dialog open={pickUserOpen} onOpenChange={(open) => { if (!open) { setPickUserOpen(false); setPickUserTask(null); setPickedUserId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("kanban:assign.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div style={{ padding: "8px 0 4px" }}>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>
              {t("kanban:assign.dialogDescription")}
            </p>
            <select
              value={pickedUserId}
              onChange={(e) => setPickedUserId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", fontSize: "13px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "white", color: "#1e293b", outline: "none" }}
            >
              <option value="">{t("kanban:assign.placeholder")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPickUserOpen(false); setPickUserTask(null); setPickedUserId(""); }}>
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleConfirmAssign}
              disabled={!pickedUserId || updateMutation.isPending}
            >
              {t("kanban:assign.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm unassign dialog */}
      <Dialog open={confirmUnassignOpen} onOpenChange={(open) => { if (!open) { setConfirmUnassignOpen(false); setConfirmUnassignTask(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("kanban:unassign.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: "13px", color: "#64748b", padding: "8px 0" }}>
            {t("kanban:unassign.dialogDescription")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmUnassignOpen(false); setConfirmUnassignTask(null); }}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmUnassign}
              disabled={updateMutation.isPending}
            >
              {t("kanban:unassign.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCard({
  task,
  users,
  borderColor,
  onMoveForward,
  onMoveBack,
  onDelete,
  onAssignUser,
  onUnassignUser,
}: {
  task: TaskWithUser;
  users: UserOption[];
  borderColor: string;
  onMoveForward?: (() => void) | undefined;
  onMoveBack?: (() => void) | undefined;
  onDelete: () => void;
  onAssignUser: (userId: string) => void;
  onUnassignUser: () => void;
}) {
  const { t } = useTranslation("kanban");
  const createdDate = new Date(task.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === "") {
      onUnassignUser();
    } else {
      onAssignUser(val);
    }
  }

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow" style={{ gap: 0, padding: 0, border: `1px solid ${borderColor}` }}>
      <CardHeader style={{ padding: "14px 16px 8px" }}>
        <CardTitle style={{ fontSize: "14px", lineHeight: "1.4" }}>{task.title}</CardTitle>
      </CardHeader>

      {task.description && (
        <CardContent style={{ padding: "0 16px 10px" }}>
          <p style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {task.description}
          </p>
        </CardContent>
      )}

      {/* User assignment dropdown */}
      <div style={{ padding: "0 12px 10px" }}>
        <select
          value={task.assignedUserId ?? ""}
          onChange={handleSelectChange}
          style={{ width: "100%", padding: "5px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: task.assignedUserId ? "#eff6ff" : "#f8fafc", color: task.assignedUserId ? "#2563eb" : "#94a3b8", outline: "none", cursor: "pointer" }}
        >
          <option value="">{t("assign.unassigned")}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      <CardFooter style={{ padding: "8px 12px", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
          {task.assignedUser ? (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "hsl(var(--primary))", fontWeight: 500 }}>
              <User className="w-3 h-3" />
              {task.assignedUser.name}
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Calendar className="w-3 h-3" />
              {createdDate}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {onMoveBack && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveBack} title={t("actions.moveBack")}>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          )}
          {onMoveForward && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveForward} title={t("actions.moveForward")}>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDelete} title={t("actions.delete")}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
