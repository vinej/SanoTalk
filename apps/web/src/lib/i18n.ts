import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// English
import enCommon from "../locales/en/common.json";
import enDashboard from "../locales/en/dashboard.json";
import enKanban from "../locales/en/kanban.json";
import enSessions from "../locales/en/sessions.json";
import enProfile from "../locales/en/profile.json";

// French
import frCommon from "../locales/fr/common.json";
import frDashboard from "../locales/fr/dashboard.json";
import frKanban from "../locales/fr/kanban.json";
import frSessions from "../locales/fr/sessions.json";
import frProfile from "../locales/fr/profile.json";

// Spanish
import esCommon from "../locales/es/common.json";
import esDashboard from "../locales/es/dashboard.json";
import esKanban from "../locales/es/kanban.json";
import esSessions from "../locales/es/sessions.json";
import esProfile from "../locales/es/profile.json";

// Chinese (Simplified)
import zhCommon from "../locales/zh/common.json";
import zhDashboard from "../locales/zh/dashboard.json";
import zhKanban from "../locales/zh/kanban.json";
import zhSessions from "../locales/zh/sessions.json";
import zhProfile from "../locales/zh/profile.json";

// Arabic
import arCommon from "../locales/ar/common.json";
import arDashboard from "../locales/ar/dashboard.json";
import arKanban from "../locales/ar/kanban.json";
import arSessions from "../locales/ar/sessions.json";
import arProfile from "../locales/ar/profile.json";

// Hindi
import hiCommon from "../locales/hi/common.json";
import hiDashboard from "../locales/hi/dashboard.json";
import hiKanban from "../locales/hi/kanban.json";
import hiSessions from "../locales/hi/sessions.json";
import hiProfile from "../locales/hi/profile.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const RTL_LANGUAGES: LanguageCode[] = ["ar"];

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang as LanguageCode);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, dashboard: enDashboard, kanban: enKanban, sessions: enSessions, profile: enProfile },
      fr: { common: frCommon, dashboard: frDashboard, kanban: frKanban, sessions: frSessions, profile: frProfile },
      es: { common: esCommon, dashboard: esDashboard, kanban: esKanban, sessions: esSessions, profile: esProfile },
      zh: { common: zhCommon, dashboard: zhDashboard, kanban: zhKanban, sessions: zhSessions, profile: zhProfile },
      ar: { common: arCommon, dashboard: arDashboard, kanban: arKanban, sessions: arSessions, profile: arProfile },
      hi: { common: hiCommon, dashboard: hiDashboard, kanban: hiKanban, sessions: hiSessions, profile: hiProfile },
    },
    fallbackLng: "en",
    defaultNS: "common",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "sanotalk-language",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
