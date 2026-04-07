import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ExternalLink, Pencil, Trash2, Plus, ShieldCheck } from "lucide-react";

type Props = {
  properties: Array<{ id: string; key: string; value: string }>;
  onPropertyChange: () => void;
};

const RAMQ_NUMBER_REGEX = /^[A-Z]{4}\s?\d{4}\s?\d{4}$/i;
const COVERAGE_COUNT = 7;

function getExpiryStatus(expiryValue: string): "valid" | "soon" | "expired" | null {
  if (!expiryValue) return null;
  const [year, month] = expiryValue.split("-").map(Number);
  if (!year || !month) return null;
  // Expiry is end of the given month
  const expiryDate = new Date(year, month, 0); // last day of month
  const now = new Date();
  if (expiryDate < now) return "expired";
  const threeMonths = new Date();
  threeMonths.setMonth(threeMonths.getMonth() + 3);
  if (expiryDate < threeMonths) return "soon";
  return "valid";
}

function formatExpiry(value: string): string {
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
}

export function RamqSection({ properties, onPropertyChange }: Props) {
  const { t } = useTranslation("profile");

  const ramqNumber = useMemo(() => properties.find((p) => p.key === "ramq_number"), [properties]);
  const ramqExpiry = useMemo(() => properties.find((p) => p.key === "ramq_expiry"), [properties]);
  const hasCard = !!ramqNumber || !!ramqExpiry;

  const [editing, setEditing] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [expiryInput, setExpiryInput] = useState("");
  const [numberError, setNumberError] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const setPropertyMutation = trpc.user.setProperty.useMutation({
    onSuccess: () => void onPropertyChange(),
  });
  const deletePropertyMutation = trpc.user.deleteProperty.useMutation({
    onSuccess: () => void onPropertyChange(),
  });

  function startEditing() {
    setNumberInput(ramqNumber?.value ?? "");
    setExpiryInput(ramqExpiry?.value ?? "");
    setNumberError(false);
    setEditing(true);
  }

  function handleSave() {
    const num = numberInput.trim().toUpperCase();
    if (num && !RAMQ_NUMBER_REGEX.test(num)) {
      setNumberError(true);
      return;
    }
    setNumberError(false);

    if (num) {
      setPropertyMutation.mutate({ key: "ramq_number", value: num });
    }
    if (expiryInput) {
      setPropertyMutation.mutate({ key: "ramq_expiry", value: expiryInput });
    }
    setEditing(false);
  }

  function handleRemove() {
    if (ramqNumber) deletePropertyMutation.mutate({ id: ramqNumber.id });
    if (ramqExpiry) deletePropertyMutation.mutate({ id: ramqExpiry.id });
    setConfirmRemove(false);
  }

  const expiryStatus = ramqExpiry ? getExpiryStatus(ramqExpiry.value) : null;

  const coverageItems = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < COVERAGE_COUNT; i++) {
      items.push(t(`ramq.coverage_${i}`));
    }
    return items;
  }, [t]);

  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <Label className="text-sm font-medium">{t("ramq.title")}</Label>
      </div>
      <p className="text-xs text-muted-foreground">{t("ramq.description")}</p>

      {/* Card info */}
      {editing ? (
        <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">{t("ramq.cardNumber")}</Label>
            <Input
              className="h-8 text-xs font-mono uppercase"
              placeholder="VINJ 9001 0151"
              value={numberInput}
              onChange={(e) => { setNumberInput(e.target.value); setNumberError(false); }}
              maxLength={14}
            />
            {numberError && (
              <p className="text-xs text-red-500">{t("ramq.invalidNumber")}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("ramq.cardExpiry")}</Label>
            <Input
              type="month"
              className="h-8 text-xs"
              value={expiryInput}
              onChange={(e) => setExpiryInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={setPropertyMutation.isPending}>
              {t("ramq.saveCard")}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>
              {t("ramq.cancelEdit")}
            </Button>
          </div>
        </div>
      ) : hasCard ? (
        <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
          {ramqNumber && (
            <div>
              <span className="text-xs text-muted-foreground">{t("ramq.cardNumber")}</span>
              <p className="text-sm font-mono font-medium">{ramqNumber.value}</p>
            </div>
          )}
          {ramqExpiry && (
            <div>
              <span className="text-xs text-muted-foreground">{t("ramq.cardExpiry")}</span>
              <p className={`text-sm font-medium ${
                expiryStatus === "expired" ? "text-red-600" :
                expiryStatus === "soon" ? "text-amber-600" :
                "text-emerald-600"
              }`}>
                {expiryStatus === "expired"
                  ? t("ramq.expiryExpired", { date: formatExpiry(ramqExpiry.value) })
                  : expiryStatus === "soon"
                    ? t("ramq.expirySoon", { date: formatExpiry(ramqExpiry.value) })
                    : t("ramq.expiryValid", { date: formatExpiry(ramqExpiry.value) })
                }
              </p>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={startEditing}>
              <Pencil className="h-3 w-3 mr-1" />
              {t("ramq.editCard")}
            </Button>
            {confirmRemove ? (
              <>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleRemove} disabled={deletePropertyMutation.isPending}>
                  {t("ramq.confirmRemove")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmRemove(false)}>
                  {t("ramq.cancelEdit")}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setConfirmRemove(true)}>
                <Trash2 className="h-3 w-3 mr-1" />
                {t("ramq.removeCard")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3 text-center space-y-2">
          <p className="text-xs text-muted-foreground italic">{t("ramq.noCardYet")}</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={startEditing}>
            <Plus className="h-3 w-3 mr-1" />
            {t("ramq.addCard")}
          </Button>
        </div>
      )}

      {/* Coverage info */}
      <details className="group">
        <summary className="text-xs font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground">
          {t("ramq.coverageTitle")}
        </summary>
        <ul className="mt-2 space-y-1 pl-4 text-xs text-muted-foreground list-disc">
          {coverageItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground/70 italic">{t("ramq.coverageNote")}</p>
      </details>

      {/* Portal link */}
      <a
        href="https://www.ramq.gouv.qc.ca/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        {t("ramq.portalLink")}
      </a>
      <p className="text-[11px] text-muted-foreground">{t("ramq.portalDescription")}</p>
    </div>
  );
}
