import { createFileRoute, Link } from "@tanstack/react-router";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Plus, Trash2, ArrowRight, ArrowLeft, User, Calendar, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import type { Task } from "@sanotalk/db";

export const Route = createFileRoute("/_auth/kanban")({
  component: KanbanPage,
});

type TaskWithUser = Task & { assignedUser: { id: string; name: string } | null };
type UserOption = { id: string; name: string; role: string };

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
    dot: "bg-slate-400",
    border: "border-slate-300",
    bg: "bg-slate-50",
    headerBg: "bg-slate-100",
    badgeBg: "bg-slate-200",
  },
  {
    status: "assigned",
    label: "Assigned",
    dot: "bg-blue-400",
    border: "border-blue-200",
    bg: "bg-blue-50",
    headerBg: "bg-blue-100",
    badgeBg: "bg-blue-200",
  },
  {
    status: "completed",
    label: "Completed",
    dot: "bg-emerald-400",
    border: "border-emerald-200",
    bg: "bg-green-50",
    headerBg: "bg-green-100",
    badgeBg: "bg-green-200",
  },
];

const STATUS_ORDER: Task["status"][] = ["not_assigned", "assigned", "completed"];

function KanbanPage() {
  const [minimizedTasks, setMinimizedTasks] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // User picker dialog (forward arrow from not_assigned)
  const [pickUserOpen, setPickUserOpen] = useState(false);
  const [pickUserTask, setPickUserTask] = useState<TaskWithUser | null>(null);
  const [pickedUserId, setPickedUserId] = useState("");

  // Edit dialog
  const [editTask, setEditTask] = useState<TaskWithUser | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRemark, setEditRemark] = useState("");

  // Confirm unassign dialog (back arrow from assigned, or dropdown unassign)
  const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
  const [confirmUnassignTask, setConfirmUnassignTask] = useState<TaskWithUser | null>(null);

  // Confirm delete dialog
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<TaskWithUser | null>(null);

  // Confirm reassign dialog (shown when current user is losing edit access)
  const [confirmReassignOpen, setConfirmReassignOpen] = useState(false);
  const [confirmReassignTask, setConfirmReassignTask] = useState<TaskWithUser | null>(null);
  const [confirmReassignNewUserId, setConfirmReassignNewUserId] = useState("");
  // true when assigning an unassigned task to someone else (uses assignOther keys instead of reassign)
  const [confirmReassignIsAssignOther, setConfirmReassignIsAssignOther] = useState(false);

  const { t } = useTranslation(["kanban", "common"]);

  const utils = trpc.useUtils();
  const { data: profile } = trpc.user.profile.useQuery();
  const currentUserId = (profile as any)?.id as string | undefined;
  const isAdmin = (profile as any)?.role === "admin";
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
      // Warn whenever the current user will lose visibility after the assignment
      // (reassigning away from self, unless the user is also the creator — creators
      // always see their own tasks regardless of assignment)
      const isCreator = task.createdByUserId === currentUserId;
      const isAssignOther = task.status === "not_assigned" && newUserId !== currentUserId && !isCreator;
      const willLoseVisibility =
        (task.status === "not_assigned" || task.assignedUserId === currentUserId) &&
        newUserId !== currentUserId &&
        !isCreator;
      if (willLoseVisibility) {
        setConfirmReassignTask(task);
        setConfirmReassignNewUserId(newUserId);
        setConfirmReassignIsAssignOther(isAssignOther);
        setConfirmReassignOpen(true);
      } else {
        const newStatus: Task["status"] = task.status === "not_assigned" ? "assigned" : task.status;
        updateMutation.mutate({ id: task.id, assignedUserId: newUserId, status: newStatus });
      }
    }
  }

  function handleConfirmReassign() {
    if (!confirmReassignTask || !confirmReassignNewUserId) return;
    const newStatus: Task["status"] = confirmReassignTask.status === "not_assigned" ? "assigned" : confirmReassignTask.status;
    updateMutation.mutate(
      { id: confirmReassignTask.id, assignedUserId: confirmReassignNewUserId, status: newStatus },
      { onSuccess: () => { setConfirmReassignOpen(false); setConfirmReassignTask(null); setConfirmReassignNewUserId(""); setConfirmReassignIsAssignOther(false); } }
    );
  }

  function handleOpenEdit(task: TaskWithUser) {
    setEditTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditRemark(task.remark ?? "");
  }

  function handleSaveEdit() {
    if (!editTask) return;
    if (editTask.taskType === "summary_review") {
      updateMutation.mutate(
        { id: editTask.id, remark: editRemark.trim() || null },
        { onSuccess: () => { setEditTask(null); } }
      );
    } else {
      if (!editTitle.trim()) return;
      updateMutation.mutate(
        { id: editTask.id, title: editTitle.trim(), description: editDescription.trim() || null, remark: editRemark.trim() || null },
        { onSuccess: () => { setEditTask(null); } }
      );
    }
  }

  function handleDeleteClick(task: TaskWithUser) {
    setConfirmDeleteTask(task);
    setConfirmDeleteOpen(true);
  }

  function handleConfirmDelete() {
    if (!confirmDeleteTask) return;
    deleteMutation.mutate(
      { id: confirmDeleteTask.id },
      { onSuccess: () => { setConfirmDeleteOpen(false); setConfirmDeleteTask(null); } }
    );
  }

  function handleCreate() {
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
    });
  }

  return (
    <div className="flex-1 bg-slate-50">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common:backToDashboard")}
        </Link>
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold m-0">{t("kanban:title")}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5 mb-0">
            {t("kanban:tasksTotal", { count: tasks.length })}
          </p>
        </div>
        <div className="flex gap-2">
          {!isAdmin && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              {t("kanban:newTask")}
            </Button>
          )}
        </div>
        </div>
      </div>

      {/* Board */}
      {(() => {
        const renderColumnCards = (col: typeof COLUMNS[number]) => {
          const colTasks = (tasks as TaskWithUser[]).filter(
            (task) => task.status === col.status
          );
          return (
            <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2.5">
              {isLoading && (
                <>
                  <div className="h-20 rounded-lg bg-slate-200" />
                  <div className="h-20 rounded-lg bg-slate-200" />
                </>
              )}

              {!isLoading && colTasks.length === 0 && (
                <div className="py-6 text-center text-[13px] text-slate-400 italic">
                  {t("kanban:noTasks")}
                </div>
              )}

              {colTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  users={users}
                  borderClass={col.border}
                  {...(!isAdmin && col.status !== "completed" ? { onMoveForward: () => handleMoveForward(task) } : {})}
                  {...(!isAdmin && col.status !== "not_assigned" && !(task.taskType === "summary_review" && col.status === "assigned") ? { onMoveBack: () => handleMoveBack(task) } : {})}
                  {...(!isAdmin && task.taskType !== "summary_review" ? { onDelete: () => handleDeleteClick(task) } : {})}
                  {...(!isAdmin && (task.assignedUserId === currentUserId || task.createdByUserId === currentUserId) ? { onEdit: () => handleOpenEdit(task) } : {})}
                  {...(!isAdmin ? { onAssignUser: (userId: string) => handleDropdownChange(task, userId) } : {})}
                  {...(!isAdmin ? { onUnassignUser: () => handleDropdownChange(task, "") } : {})}
                  readOnly={isAdmin}
                  minimized={minimizedTasks.has(task.id)}
                  onToggleMinimize={() => setMinimizedTasks((prev) => {
                    const next = new Set(prev);
                    next.has(task.id) ? next.delete(task.id) : next.add(task.id);
                    return next;
                  })}
                />
              ))}
            </div>
          );
        };

        return (
          <>
            {/* Mobile: tabs (< sm) */}
            <Tabs defaultValue="not_assigned" className="sm:hidden p-3">
              <TabsList className="w-full grid grid-cols-3">
                {COLUMNS.map((col) => {
                  const count = (tasks as TaskWithUser[]).filter((x) => x.status === col.status).length;
                  return (
                    <TabsTrigger
                      key={col.status}
                      value={col.status}
                      className="flex items-center gap-1.5 min-w-0"
                    >
                      <span className={`inline-block w-2 h-2 rounded-full ${col.dot} shrink-0`} />
                      <span className="truncate text-xs">{t(`kanban:columns.${col.status}`)}</span>
                      <span className={`text-[10px] font-semibold ${col.badgeBg} text-slate-600 rounded-full px-1.5 shrink-0`}>
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {COLUMNS.map((col) => (
                <TabsContent key={col.status} value={col.status} className="mt-3">
                  <div className={`rounded-xl border-2 ${col.border} ${col.bg} shadow-sm`}>
                    {renderColumnCards(col)}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Desktop: 3-column grid (>= sm) */}
            <div className="hidden sm:grid p-6 grid-cols-3 gap-5 items-start">
              {COLUMNS.map((col) => {
                const colTasks = (tasks as TaskWithUser[]).filter(
                  (task) => task.status === col.status
                );
                return (
                  <div key={col.status} className={`rounded-xl border-2 ${col.border} ${col.bg} shadow-sm`}>
                    {/* Column header */}
                    <div className={`px-4 py-3 ${col.headerBg} rounded-t-[10px] flex items-center justify-between border-b ${col.border}`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${col.dot} shrink-0`} />
                        <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-600">
                          {t(`kanban:columns.${col.status}`)}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold ${col.badgeBg} text-slate-600 rounded-full px-2.5 py-0.5`}>
                        {colTasks.length}
                      </span>
                    </div>

                    {renderColumnCards(col)}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("kanban:dialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
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
            <div className="flex flex-col gap-1.5">
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
          <DialogDescription className="text-[13px] text-slate-500 mb-3">
            {t("kanban:assign.dialogDescription")}
          </DialogDescription>
          <div className="py-2 pb-1">
            <select
              value={pickedUserId}
              onChange={(e) => setPickedUserId(e.target.value)}
              className="w-full px-2.5 py-2 text-[13px] rounded-md border border-slate-300 bg-white text-slate-800 outline-none"
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

      {/* Edit dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => { if (!open) setEditTask(null); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("kanban:editDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {editTask?.taskType !== "summary_review" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-title">{t("kanban:dialog.titleLabel")}</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    className="!border-slate-400"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-desc">{t("kanban:dialog.descriptionLabel")}</Label>
                  <Input
                    id="edit-desc"
                    placeholder={t("kanban:dialog.descriptionPlaceholder")}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="!border-slate-400"
                  />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-remark">{t("kanban:editDialog.remarkLabel")}</Label>
              <Input
                id="edit-remark"
                placeholder={t("kanban:editDialog.remarkPlaceholder")}
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                autoFocus={editTask?.taskType === "summary_review"}
                className="!border-slate-400"
              />
            </div>
            {editTask && (
              <p className="text-xs text-slate-400 m-0">
                {t("kanban:editDialog.lastUpdated", {
                  date: new Date(editTask.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
                })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTask(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={(editTask?.taskType !== "summary_review" && !editTitle.trim()) || updateMutation.isPending}
            >
              {t("kanban:editDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={(open) => { if (!open) { setConfirmDeleteOpen(false); setConfirmDeleteTask(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("kanban:delete.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-[13px] text-slate-500 py-2">
            {t("kanban:delete.dialogDescription", { title: confirmDeleteTask?.title ?? "" })}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDeleteOpen(false); setConfirmDeleteTask(null); }}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {t("kanban:delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm reassign dialog — warns current assignee they will lose edit access,
           or warns any user they won't see the task after assigning it to someone else */}
      <Dialog open={confirmReassignOpen} onOpenChange={(open) => { if (!open) { setConfirmReassignOpen(false); setConfirmReassignTask(null); setConfirmReassignNewUserId(""); setConfirmReassignIsAssignOther(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmReassignIsAssignOther ? t("kanban:assignOther.dialogTitle") : t("kanban:reassign.dialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-[13px] text-slate-500 py-2">
            {confirmReassignIsAssignOther ? t("kanban:assignOther.dialogDescription") : t("kanban:reassign.dialogDescription")}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmReassignOpen(false); setConfirmReassignTask(null); setConfirmReassignNewUserId(""); setConfirmReassignIsAssignOther(false); }}>
              {t("common:cancel")}
            </Button>
            <Button onClick={handleConfirmReassign} disabled={updateMutation.isPending}>
              {confirmReassignIsAssignOther ? t("kanban:assignOther.confirm") : t("kanban:reassign.confirm")}
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
          <DialogDescription className="text-[13px] text-slate-500 py-2">
            {t("kanban:unassign.dialogDescription")}
          </DialogDescription>
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
  borderClass,
  onMoveForward,
  onMoveBack,
  onDelete,
  onEdit,
  onAssignUser,
  onUnassignUser,
  minimized,
  onToggleMinimize,
  readOnly,
}: {
  task: TaskWithUser;
  users: UserOption[];
  borderClass: string;
  onMoveForward?: (() => void) | undefined;
  onMoveBack?: (() => void) | undefined;
  onDelete?: () => void;
  onEdit?: () => void;
  onAssignUser?: (userId: string) => void;
  onUnassignUser?: () => void;
  minimized: boolean;
  onToggleMinimize: () => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation("kanban");
  const createdDate = new Date(task.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === "") {
      onUnassignUser?.();
    } else {
      onAssignUser?.(val);
    }
  }

  return (
    <Card className={`shadow-sm hover:shadow-md transition-shadow gap-0 p-0 border ${borderClass}`}>
      {/* Title row — always visible */}
      <div className="py-2.5 px-3 pl-4 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold leading-snug m-0 flex-1">{task.title}</p>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onToggleMinimize} title={minimized ? t("actions.expand") : t("actions.minimize")}>
          {minimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Expanded content */}
      {!minimized && (
        <>
          <CardContent className="px-4 pb-2.5 pt-0 flex flex-col gap-2">
            {task.description && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
                  {t("dialog.descriptionLabel")}
                </p>
                {(() => { try { return /^https?:\/\//.test(task.description) && new URL(task.description).origin === window.location.origin; } catch { return false; } })() ? (
                  readOnly ? (
                    <p className="text-[13px] text-slate-400 font-medium m-0">
                      {t("viewSummary")}
                    </p>
                  ) : (
                    <a href={task.description} target="_blank" rel="noopener noreferrer" className="text-[13px] text-blue-600 font-medium underline">
                      {t("viewSummary")}
                    </a>
                  )
                ) : (
                  <p className="text-[13px] text-slate-500 leading-normal m-0 line-clamp-3">
                    {task.description}
                  </p>
                )}
              </div>
            )}

            {task.remark && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
                  {t("editDialog.remarkLabel")}
                </p>
                <p className="text-[13px] text-slate-500 leading-normal m-0 line-clamp-2">
                  {task.remark}
                </p>
              </div>
            )}
          </CardContent>

          {/* User assignment dropdown (hidden for summary_review tasks) */}
          {task.taskType !== "summary_review" && (
            <div className="px-3 pb-2.5">
              <select
                value={task.assignedUserId ?? ""}
                onChange={handleSelectChange}
                className={`w-full py-1 px-2 text-xs rounded-md border border-slate-200 outline-none cursor-pointer ${task.assignedUserId ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"}`}
              >
                <option value="">{t("assign.unassigned")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          <CardFooter className="px-3 py-2 bg-slate-50 flex items-center justify-between gap-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {task.assignedUser ? (
                <span className="flex items-center gap-1 text-primary font-medium">
                  <User className="w-3 h-3" />
                  {task.assignedUser.name}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {createdDate}
                </span>
              )}
            </div>

            <div className="flex items-center gap-0.5">
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
              {onEdit && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit} title={t("actions.edit")}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
          {onDelete && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDelete} title={t("actions.delete")}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          )}
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
