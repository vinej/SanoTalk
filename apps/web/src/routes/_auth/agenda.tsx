import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { trpc } from "../../lib/trpc";
import { AgendaPlannerView } from "../../components/agenda/agenda-planner-view";
import { AgendaTodayView } from "../../components/agenda/agenda-today-view";
import { AgendaRangeView } from "../../components/agenda/agenda-range-view";
import { AgendaCalendarView } from "../../components/agenda/agenda-calendar-view";
import { AgendaMedicationSchedule } from "../../components/agenda/agenda-medication-schedule";
import { AgendaAvailabilityView } from "../../components/agenda/agenda-availability-view";

export const Route = createFileRoute("/_auth/agenda")({
  component: AgendaPage,
});

function AgendaPage() {
  const { t } = useTranslation("agenda");
  const { data: profile } = trpc.user.profile.useQuery();

  const isProfessional = profile?.role === "doctor" || profile?.role === "pharmacist";

  return (
    <div data-openreplay-obscured className="flex-1 min-h-0 flex flex-col">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Tabs defaultValue="planner">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="planner">{t("tabs.planner")}</TabsTrigger>
            <TabsTrigger value="today">{t("tabs.today")}</TabsTrigger>
            <TabsTrigger value="week">{t("tabs.week")}</TabsTrigger>
            <TabsTrigger value="month">{t("tabs.month")}</TabsTrigger>
            <TabsTrigger value="calendar">{t("tabs.calendar")}</TabsTrigger>
            <TabsTrigger value="medications">{t("tabs.medications")}</TabsTrigger>
            {isProfessional && (
              <TabsTrigger value="availability">{t("tabs.availability")}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="planner">
            <AgendaPlannerView />
          </TabsContent>

          <TabsContent value="today">
            <AgendaTodayView />
          </TabsContent>

          <TabsContent value="week">
            <AgendaRangeView mode="week" />
          </TabsContent>

          <TabsContent value="month">
            <AgendaRangeView mode="month" />
          </TabsContent>

          <TabsContent value="calendar">
            <AgendaCalendarView />
          </TabsContent>

          <TabsContent value="medications">
            <AgendaMedicationSchedule />
          </TabsContent>

          {isProfessional && (
            <TabsContent value="availability">
              <AgendaAvailabilityView />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
