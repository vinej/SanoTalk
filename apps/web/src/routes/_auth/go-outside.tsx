import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldCheck, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { ACTIVITIES, CATEGORIES, INTENSITIES } from "../../components/outdoor/activity-catalog";
import type { OutdoorActivity, OutdoorCategory, IntensityLevel } from "../../components/outdoor/activity-catalog";
import { ActivityCard } from "../../components/outdoor/activity-card";
import { ActivityDetailDialog } from "../../components/outdoor/activity-detail-dialog";
import { LogOutdoorDialog } from "../../components/outdoor/log-outdoor-dialog";
import { CreateActivityDialog } from "../../components/outdoor/create-activity-dialog";
import { WeeklyGoalBar } from "../../components/outdoor/weekly-goal-bar";
import { OutdoorWeekCalendar } from "../../components/outdoor/outdoor-week-calendar";
import { OutdoorStatsCard } from "../../components/outdoor/outdoor-stats-card";
import { OutdoorHistoryTable } from "../../components/outdoor/outdoor-history-table";
import { OutdoorResourceList } from "../../components/outdoor/outdoor-resource-list";
import { trpc } from "../../lib/trpc";

export const Route = createFileRoute("/_auth/go-outside")({
  component: GoOutsidePage,
});

function GoOutsidePage() {
  const { t } = useTranslation(["goOutside", "common"]);

  const [selectedCategory, setSelectedCategory] = useState<OutdoorCategory | "all">("all");
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel | "all">("all");
  const [viewActivity, setViewActivity] = useState<OutdoorActivity | null>(null);
  const [logActivity, setLogActivity] = useState<{ activity: OutdoorActivity; name: string; activityId: string; category: OutdoorCategory; intensity: IntensityLevel } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Custom activities from DB
  const { data: customActivities } = trpc.outdoor.customActivities.list.useQuery();
  const utils = trpc.useUtils();
  const deleteCustomMutation = trpc.outdoor.customActivities.delete.useMutation({
    onSuccess: () => utils.outdoor.customActivities.invalidate(),
  });

  const filteredActivities = useMemo(() => {
    return ACTIVITIES.filter((a) => {
      if (selectedCategory !== "all" && a.category !== selectedCategory) return false;
      if (selectedIntensity !== "all" && a.intensity !== selectedIntensity) return false;
      return true;
    });
  }, [selectedCategory, selectedIntensity]);

  const filteredCustom = useMemo(() => {
    if (!customActivities) return [];
    return customActivities.filter((ca) => {
      if (selectedCategory !== "all" && ca.category !== selectedCategory) return false;
      if (selectedIntensity !== "all" && ca.intensity !== selectedIntensity) return false;
      return true;
    });
  }, [customActivities, selectedCategory, selectedIntensity]);

  function handleLogFromDetail(activity: OutdoorActivity) {
    const name = t(`goOutside:activities.${activity.id}.name`);
    setViewActivity(null);
    setLogActivity({ activity, name, activityId: activity.id, category: activity.category, intensity: activity.intensity });
  }

  function handleLogCustom(ca: { id: string; name: string; category: string; intensity: string; suggestedMins: number }) {
    const fakeActivity: OutdoorActivity = {
      id: `custom:${ca.id}`,
      category: ca.category as OutdoorCategory,
      intensity: ca.intensity as IntensityLevel,
      suggestedMins: ca.suggestedMins,
      tipCount: 0,
    };
    setLogActivity({ activity: fakeActivity, name: ca.name, activityId: `custom:${ca.id}`, category: ca.category as OutdoorCategory, intensity: ca.intensity as IntensityLevel });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 py-6 space-y-4 overflow-auto">
      <div className="shrink-0 space-y-1">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common:backToDashboard")}
        </Link>
        <h1 className="text-2xl font-bold">{t("goOutside:title")}</h1>
        <p className="text-sm text-muted-foreground">{t("goOutside:subtitle")}</p>
      </div>

      {/* Weekly Goal Bar */}
      <WeeklyGoalBar />

      {/* Safety disclaimer */}
      <details className="shrink-0 rounded-lg border bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
        <summary className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
          {t("goOutside:safety.title")}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("goOutside:safety.disclaimer")}
        </p>
      </details>

      <Tabs defaultValue="activities" className="flex flex-col sm:flex-1 sm:min-h-0">
        <TabsList className="shrink-0">
          <TabsTrigger value="activities">{t("goOutside:tabs.activities")}</TabsTrigger>
          <TabsTrigger value="progress">{t("goOutside:tabs.progress")}</TabsTrigger>
          <TabsTrigger value="resources">{t("goOutside:tabs.resources")}</TabsTrigger>
        </TabsList>

        {/* Activities Tab */}
        <TabsContent value="activities" className="sm:flex-1 sm:overflow-auto space-y-4 mt-4">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={selectedCategory === "all" ? "default" : "outline"}
              className="text-xs h-7"
              onClick={() => setSelectedCategory("all")}
            >
              {t("goOutside:categories.all")}
            </Button>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                className="text-xs h-7"
                onClick={() => setSelectedCategory(cat)}
              >
                {t(`goOutside:categories.${cat}`)}
              </Button>
            ))}
          </div>

          {/* Intensity filter */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={selectedIntensity === "all" ? "secondary" : "ghost"}
              className="text-xs h-6"
              onClick={() => setSelectedIntensity("all")}
            >
              {t("goOutside:intensity.all")}
            </Button>
            {INTENSITIES.map((int) => (
              <Button
                key={int}
                size="sm"
                variant={selectedIntensity === int ? "secondary" : "ghost"}
                className="text-xs h-6"
                onClick={() => setSelectedIntensity(int)}
              >
                {t(`goOutside:intensity.${int}`)}
              </Button>
            ))}
          </div>

          {/* Preset activity grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                name={t(`goOutside:activities.${activity.id}.name`)}
                description={t(`goOutside:activities.${activity.id}.description`)}
                onView={() => setViewActivity(activity)}
              />
            ))}

            {/* Add Your Own card */}
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer transition-colors hover:border-green-400 hover:text-green-600"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">{t("goOutside:activity.addYourOwn")}</span>
              <span className="text-xs">{t("goOutside:activity.addYourOwnDesc")}</span>
            </button>
          </div>

          {/* Custom activities section */}
          {customActivities && customActivities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t("goOutside:activity.myActivities")}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCustom.map((ca) => (
                  <div key={ca.id} className="rounded-lg border bg-card p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{ca.name}</h4>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(t("goOutside:activity.deleteCustomConfirm"))) {
                            deleteCustomMutation.mutate({ id: ca.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(`goOutside:categories.${ca.category}`)} &middot; {t(`goOutside:intensity.${ca.intensity}`)} &middot; {t("goOutside:activity.duration", { mins: ca.suggestedMins })}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-auto text-xs"
                      onClick={() => handleLogCustom(ca)}
                    >
                      {t("goOutside:activity.logActivity")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="sm:flex-1 sm:overflow-auto space-y-6 mt-4">
          <OutdoorWeekCalendar />
          <OutdoorStatsCard />
          <OutdoorHistoryTable />
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="sm:flex-1 sm:overflow-auto mt-4">
          <OutdoorResourceList />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ActivityDetailDialog
        activity={viewActivity}
        name={viewActivity ? t(`goOutside:activities.${viewActivity.id}.name`) : ""}
        description={viewActivity ? t(`goOutside:activities.${viewActivity.id}.description`) : ""}
        tips={viewActivity ? (t(`goOutside:activities.${viewActivity.id}.tips`, { returnObjects: true }) as string[]) : []}
        safetyTip={viewActivity ? t(`goOutside:activities.${viewActivity.id}.safetyTip`) : ""}
        open={!!viewActivity}
        onOpenChange={(open) => { if (!open) setViewActivity(null); }}
        onLogActivity={handleLogFromDetail}
      />
      <LogOutdoorDialog
        activity={logActivity?.activity ?? null}
        activityName={logActivity?.name ?? ""}
        activityId={logActivity?.activityId ?? ""}
        category={logActivity?.category ?? "walking"}
        intensity={logActivity?.intensity ?? "moderate"}
        open={!!logActivity}
        onOpenChange={(open) => { if (!open) setLogActivity(null); }}
      />
      <CreateActivityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
