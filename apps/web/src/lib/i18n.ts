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
import enMedications from "../locales/en/medications.json";
import enSymptoms from "../locales/en/symptoms.json";
import enAllergies from "../locales/en/allergies.json";
import enPrivacy from "../locales/en/privacy.json";
import enChat from "../locales/en/chat.json";
import enTrainBody from "../locales/en/trainBody.json";
import enGoOutside from "../locales/en/goOutside.json";
import enAgenda from "../locales/en/agenda.json";

// French
import frCommon from "../locales/fr/common.json";
import frDashboard from "../locales/fr/dashboard.json";
import frKanban from "../locales/fr/kanban.json";
import frSessions from "../locales/fr/sessions.json";
import frProfile from "../locales/fr/profile.json";
import frAuth from "../locales/fr/auth.json";
import frHealthHelp from "../locales/fr/healthHelp.json";
import frVitals from "../locales/fr/vitals.json";
import frMedications from "../locales/fr/medications.json";
import frSymptoms from "../locales/fr/symptoms.json";
import frAllergies from "../locales/fr/allergies.json";
import frPrivacy from "../locales/fr/privacy.json";
import frChat from "../locales/fr/chat.json";
import frTrainBody from "../locales/fr/trainBody.json";
import frGoOutside from "../locales/fr/goOutside.json";
import frAgenda from "../locales/fr/agenda.json";

// Spanish
import esCommon from "../locales/es/common.json";
import esDashboard from "../locales/es/dashboard.json";
import esKanban from "../locales/es/kanban.json";
import esSessions from "../locales/es/sessions.json";
import esProfile from "../locales/es/profile.json";
import esAuth from "../locales/es/auth.json";
import esHealthHelp from "../locales/es/healthHelp.json";
import esVitals from "../locales/es/vitals.json";
import esMedications from "../locales/es/medications.json";
import esSymptoms from "../locales/es/symptoms.json";
import esAllergies from "../locales/es/allergies.json";
import esPrivacy from "../locales/es/privacy.json";
import esChat from "../locales/es/chat.json";
import esTrainBody from "../locales/es/trainBody.json";
import esGoOutside from "../locales/es/goOutside.json";
import esAgenda from "../locales/es/agenda.json";

// Chinese (Simplified)
import zhCommon from "../locales/zh/common.json";
import zhDashboard from "../locales/zh/dashboard.json";
import zhKanban from "../locales/zh/kanban.json";
import zhSessions from "../locales/zh/sessions.json";
import zhProfile from "../locales/zh/profile.json";
import zhAuth from "../locales/zh/auth.json";
import zhHealthHelp from "../locales/zh/healthHelp.json";
import zhVitals from "../locales/zh/vitals.json";
import zhMedications from "../locales/zh/medications.json";
import zhSymptoms from "../locales/zh/symptoms.json";
import zhAllergies from "../locales/zh/allergies.json";
import zhPrivacy from "../locales/zh/privacy.json";
import zhChat from "../locales/zh/chat.json";
import zhTrainBody from "../locales/zh/trainBody.json";
import zhGoOutside from "../locales/zh/goOutside.json";
import zhAgenda from "../locales/zh/agenda.json";

// Arabic
import arCommon from "../locales/ar/common.json";
import arDashboard from "../locales/ar/dashboard.json";
import arKanban from "../locales/ar/kanban.json";
import arSessions from "../locales/ar/sessions.json";
import arProfile from "../locales/ar/profile.json";
import arAuth from "../locales/ar/auth.json";
import arHealthHelp from "../locales/ar/healthHelp.json";
import arVitals from "../locales/ar/vitals.json";
import arMedications from "../locales/ar/medications.json";
import arSymptoms from "../locales/ar/symptoms.json";
import arAllergies from "../locales/ar/allergies.json";
import arPrivacy from "../locales/ar/privacy.json";
import arChat from "../locales/ar/chat.json";
import arTrainBody from "../locales/ar/trainBody.json";
import arGoOutside from "../locales/ar/goOutside.json";
import arAgenda from "../locales/ar/agenda.json";

// Hindi
import hiCommon from "../locales/hi/common.json";
import hiDashboard from "../locales/hi/dashboard.json";
import hiKanban from "../locales/hi/kanban.json";
import hiSessions from "../locales/hi/sessions.json";
import hiProfile from "../locales/hi/profile.json";
import hiAuth from "../locales/hi/auth.json";
import hiHealthHelp from "../locales/hi/healthHelp.json";
import hiVitals from "../locales/hi/vitals.json";
import hiMedications from "../locales/hi/medications.json";
import hiSymptoms from "../locales/hi/symptoms.json";
import hiAllergies from "../locales/hi/allergies.json";
import hiPrivacy from "../locales/hi/privacy.json";
import hiChat from "../locales/hi/chat.json";
import hiTrainBody from "../locales/hi/trainBody.json";
import hiGoOutside from "../locales/hi/goOutside.json";
import hiAgenda from "../locales/hi/agenda.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "fr", label: "Français", flag: "⚜️" },
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
      en: { common: enCommon, dashboard: enDashboard, kanban: enKanban, sessions: enSessions, profile: enProfile, auth: enAuth, healthHelp: enHealthHelp, vitals: enVitals, medications: enMedications, symptoms: enSymptoms, allergies: enAllergies, privacy: enPrivacy, chat: enChat, trainBody: enTrainBody, goOutside: enGoOutside, agenda: enAgenda },
      fr: { common: frCommon, dashboard: frDashboard, kanban: frKanban, sessions: frSessions, profile: frProfile, auth: frAuth, healthHelp: frHealthHelp, vitals: frVitals, medications: frMedications, symptoms: frSymptoms, allergies: frAllergies, privacy: frPrivacy, chat: frChat, trainBody: frTrainBody, goOutside: frGoOutside, agenda: frAgenda },
      es: { common: esCommon, dashboard: esDashboard, kanban: esKanban, sessions: esSessions, profile: esProfile, auth: esAuth, healthHelp: esHealthHelp, vitals: esVitals, medications: esMedications, symptoms: esSymptoms, allergies: esAllergies, privacy: esPrivacy, chat: esChat, trainBody: esTrainBody, goOutside: esGoOutside, agenda: esAgenda },
      zh: { common: zhCommon, dashboard: zhDashboard, kanban: zhKanban, sessions: zhSessions, profile: zhProfile, auth: zhAuth, healthHelp: zhHealthHelp, vitals: zhVitals, medications: zhMedications, symptoms: zhSymptoms, allergies: zhAllergies, privacy: zhPrivacy, chat: zhChat, trainBody: zhTrainBody, goOutside: zhGoOutside, agenda: zhAgenda },
      ar: { common: arCommon, dashboard: arDashboard, kanban: arKanban, sessions: arSessions, profile: arProfile, auth: arAuth, healthHelp: arHealthHelp, vitals: arVitals, medications: arMedications, symptoms: arSymptoms, allergies: arAllergies, privacy: arPrivacy, chat: arChat, trainBody: arTrainBody, goOutside: arGoOutside, agenda: arAgenda },
      hi: { common: hiCommon, dashboard: hiDashboard, kanban: hiKanban, sessions: hiSessions, profile: hiProfile, auth: hiAuth, healthHelp: hiHealthHelp, vitals: hiVitals, medications: hiMedications, symptoms: hiSymptoms, allergies: hiAllergies, privacy: hiPrivacy, chat: hiChat, trainBody: hiTrainBody, goOutside: hiGoOutside, agenda: hiAgenda },
    },
    fallbackLng: "en",
    defaultNS: "common",
    // Strip region from detected language ("fr-CA" → "fr") so server-side
    // Zod enums that only accept ["en","fr","es","zh","ar","hi"] don't reject
    // requests from phones whose navigator.language includes a region.
    load: "languageOnly",
    supportedLngs: ["en", "fr", "es", "zh", "ar", "hi"],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "sanotalk-language",
    },
    interpolation: {
      escapeValue: true,
    },
  });

export default i18n;
