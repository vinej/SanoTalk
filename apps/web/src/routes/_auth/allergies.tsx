import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { AllergyList } from "../../components/allergies/allergy-list";
import { ConditionList } from "../../components/allergies/condition-list";
import { MedicalIdCard } from "../../components/allergies/medical-id-card";

export const Route = createFileRoute("/_auth/allergies")({
  component: AllergiesPage,
});

function AllergiesPage() {
  const { t } = useTranslation("allergies");

  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 py-6 space-y-8 overflow-y-auto">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common:backToDashboard")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="max-w-3xl space-y-8">
        <AllergyList />
        <ConditionList />
        <MedicalIdCard />
      </div>
    </div>
  );
}
