import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// English
import enCommon from "../locales/en/common.json";
import enDashboard from "../locales/en/dashboard.json";
import enKanban from "../locales/en/kanban.json";
import enSessions from "../locales/en/sessions.json";
import enProfile from "../locales/en/profile.json";
import enAuth from "../locales/en/auth.json";
import enHealthHelp from "../locales/en/healthHelp.json";
import enVitals from "../locales/en/vitals.json";

// French
import frCommon from "../locales/fr/common.json";
import frDashboard from "../locales/fr/dashboard.json";
import frKanban from "../locales/fr/kanban.json";
import frSessions from "../locales/fr/sessions.json";
import frProfile from "../locales/fr/profile.json";
import frAuth from "../locales/fr/auth.json";
import frHealthHelp from "../locales/fr/healthHelp.json";
import frVitals from "../locales/fr/vitals.json";

// Spanish
import esCommon from "../locales/es/common.json";
import esDashboard from "../locales/es/dashboard.json";
import esKanban from "../locales/es/kanban.json";
import esSessions from "../locales/es/sessions.json";
import esProfile from "../locales/es/profile.json";
import esAuth from "../locales/es/auth.json";
import esHealthHelp from "../locales/es/healthHelp.json";
import esVitals from "../locales/es/vitals.json";

// Chinese (Simplified)
import zhCommon from "../locales/zh/common.json";
import zhDashboard from "../locales/zh/dashboard.json";
import zhKanban from "../locales/zh/kanban.json";
import zhSessions from "../locales/zh/sessions.json";
import zhProfile from "../locales/zh/profile.json";
import zhAuth from "../locales/zh/auth.json";
import zhHealthHelp from "../locales/zh/healthHelp.json";
import zhVitals from "../locales/zh/vitals.json";

// Arabic
import arCommon from "../locales/ar/common.json";
import arDashboard from "../locales/ar/dashboard.json";
import arKanban from "../locales/ar/kanban.json";
import arSessions from "../locales/ar/sessions.json";
import arProfile from "../locales/ar/profile.json";
import arAuth from "../locales/ar/auth.json";
import arHealthHelp from "../locales/ar/healthHelp.json";
import arVitals from "../locales/ar/vitals.json";

// Hindi
import hiCommon from "../locales/hi/common.json";
import hiDashboard from "../locales/hi/dashboard.json";
import hiKanban from "../locales/hi/kanban.json";
import hiSessions from "../locales/hi/sessions.json";
import hiProfile from "../locales/hi/profile.json";
import hiAuth from "../locales/hi/auth.json";
import hiHealthHelp from "../locales/hi/healthHelp.json";
import hiVitals from "../locales/hi/vitals.json";

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
      en: { common: enCommon, dashboard: enDashboard, kanban: enKanban, sessions: enSessions, profile: enProfile, auth: enAuth, healthHelp: enHealthHelp, vitals: enVitals },
      fr: { common: frCommon, dashboard: frDashboard, kanban: frKanban, sessions: frSessions, profile: frProfile, auth: frAuth, healthHelp: frHealthHelp, vitals: frVitals },
      es: { common: esCommon, dashboard: esDashboard, kanban: esKanban, sessions: esSessions, profile: esProfile, auth: esAuth, healthHelp: esHealthHelp, vitals: esVitals },
      zh: { common: zhCommon, dashboard: zhDashboard, kanban: zhKanban, sessions: zhSessions, profile: zhProfile, auth: zhAuth, healthHelp: zhHealthHelp, vitals: zhVitals },
      ar: { common: arCommon, dashboard: arDashboard, kanban: arKanban, sessions: arSessions, profile: arProfile, auth: arAuth, healthHelp: arHealthHelp, vitals: arVitals },
      hi: { common: hiCommon, dashboard: hiDashboard, kanban: hiKanban, sessions: hiSessions, profile: hiProfile, auth: hiAuth, healthHelp: hiHealthHelp, vitals: hiVitals },
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
