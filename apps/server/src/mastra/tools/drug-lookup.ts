import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ── Canadian brand prefixes to strip when RxNorm doesn't find the raw name ──
const CA_PREFIXES = [
  "Apo-", "Teva-", "ratio-", "Sandoz-", "Mylan-", "pms-", "ACT-", "Jamp-",
  "Mint-", "Mar-", "Riva-", "GD-", "AG-", "Bio-", "Dom-", "Novo-", "Nu-",
];

// ── Tool 1: lookupDrug ─────────────────────────────────────────────────────
// Normalizes any drug name (brand, generic, Canadian brand, French name) to
// a standard RxCUI + generic name via the NLM RxNorm API.

async function rxNormLookup(name: string) {
  const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as any;
  const groups = data?.drugGroup?.conceptGroup;
  if (!Array.isArray(groups)) return null;

  // Prefer SCD (Semantic Clinical Drug) or SBD (Semantic Branded Drug)
  for (const tty of ["SCD", "SBD", "GPCK", "BPCK"]) {
    const group = groups.find((g: any) => g.tty === tty && g.conceptProperties?.length);
    if (group) {
      const first = group.conceptProperties[0];
      return {
        rxcui: first.rxcui as string,
        name: first.name as string,
        tty: first.tty as string,
      };
    }
  }
  return null;
}

async function rxNormGetGenericName(name: string): Promise<string | null> {
  // Try /rxcui endpoint for a cleaner ingredient-level match
  const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as any;
  const ids = data?.idGroup?.rxnormId;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  return name; // the name was recognized as-is
}

function stripCanadianPrefix(name: string): string | null {
  const lower = name.toLowerCase();
  for (const prefix of CA_PREFIXES) {
    if (lower.startsWith(prefix.toLowerCase())) {
      return name.slice(prefix.length);
    }
  }
  return null;
}

export const lookupDrug = createTool({
  id: "lookupDrug",
  description:
    "Normalize a drug name (brand, generic, Canadian brand, or French name) to its standard generic name using the RxNorm API. " +
    "Always call this FIRST before getDrugLabel to get the correct generic name.",
  inputSchema: z.object({
    name: z.string().describe("The drug name as entered by the user (brand or generic, any language)"),
  }),
  execute: async ({ name }) => {
    // 1. Try as-is
    let result = await rxNormLookup(name);
    let matchedTerm = name;

    // 2. If no result, strip Canadian prefix and retry
    if (!result) {
      const stripped = stripCanadianPrefix(name);
      if (stripped) {
        result = await rxNormLookup(stripped);
        if (result) matchedTerm = stripped;
      }
    }

    // 3. If still no result, try the rxcui endpoint for ingredient-level match
    if (!result) {
      const generic = await rxNormGetGenericName(name);
      if (!generic) {
        const stripped = stripCanadianPrefix(name);
        const fallback = stripped ? await rxNormGetGenericName(stripped) : null;
        if (!fallback) {
          return { found: false, searchedName: name, message: `No drug found for "${name}" in RxNorm.` };
        }
        matchedTerm = stripped!;
      } else {
        matchedTerm = name;
      }
    }

    // Extract generic name from the full SCD/SBD name (e.g. "metformin hydrochloride 500 MG ..." → "metformin")
    // Use the matched term as the generic name for OpenFDA lookup
    const genericName = matchedTerm.toLowerCase().replace(/\s+(hydrochloride|hcl|sodium|potassium|calcium|mesylate|maleate|tartrate|fumarate|succinate|besylate)$/i, "");

    return {
      found: true,
      rxcui: result?.rxcui ?? null,
      genericName,
      fullName: result?.name ?? matchedTerm,
      matchedTerm,
    };
  },
});

// ── Tool 2: getDrugLabel ────────────────────────────────────────────────────
// Fetches the FDA-approved drug label (monograph) from OpenFDA.
// Returns structured sections: indications, adverse reactions, interactions,
// dosage, warnings, contraindications.

const LABEL_FIELDS = [
  "indications_and_usage",
  "adverse_reactions",
  "drug_interactions",
  "warnings_and_cautions",
  "warnings",
  "dosage_and_administration",
  "contraindications",
] as const;

const MAX_FIELD_CHARS = 3000; // clip each section to avoid blowing context

function clipField(text: string | undefined): string | null {
  if (!text) return null;
  if (text.length <= MAX_FIELD_CHARS) return text;
  return text.slice(0, MAX_FIELD_CHARS) + "\n…[truncated]";
}

export const getDrugLabel = createTool({
  id: "getDrugLabel",
  description:
    "Fetch the FDA-approved drug label (monograph) from OpenFDA for a given generic drug name. " +
    "Returns indications, adverse reactions, drug interactions, dosage, warnings, and contraindications. " +
    "Use the generic name returned by lookupDrug.",
  inputSchema: z.object({
    drugName: z.string().describe("The generic drug name (e.g. 'metformin', 'warfarin', 'amoxicillin')"),
  }),
  execute: async ({ drugName }) => {
    const searchTerm = encodeURIComponent(`"${drugName}"`);
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${searchTerm}&limit=1`;

    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      return { found: false, drugName, message: "Failed to reach OpenFDA API." };
    }

    if (!res.ok) {
      // Try a broader search (substance_name)
      const fallbackUrl = `https://api.fda.gov/drug/label.json?search=openfda.substance_name:${searchTerm}&limit=1`;
      try {
        res = await fetch(fallbackUrl);
      } catch {
        return { found: false, drugName, message: "Failed to reach OpenFDA API." };
      }
      if (!res.ok) {
        return { found: false, drugName, message: `No FDA label found for "${drugName}".` };
      }
    }

    const data = await res.json() as any;
    const label = data?.results?.[0];
    if (!label) {
      return { found: false, drugName, message: `No FDA label found for "${drugName}".` };
    }

    // Extract the brand name if available
    const brandName = label.openfda?.brand_name?.[0] ?? null;
    const manufacturer = label.openfda?.manufacturer_name?.[0] ?? null;

    const sections: Record<string, string | null> = {};
    for (const field of LABEL_FIELDS) {
      const raw = label[field];
      sections[field] = clipField(Array.isArray(raw) ? raw.join("\n\n") : raw);
    }

    return {
      found: true,
      drugName,
      brandName,
      manufacturer,
      ...sections,
    };
  },
});
