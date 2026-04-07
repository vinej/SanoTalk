import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
