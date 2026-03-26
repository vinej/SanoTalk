import { SanoTalkLogoV2 } from "./logo-v2";
import { Mic, FileText, Users, Bot, Heart, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const features = [
  { icon: Mic,         key: "feature1" },
  { icon: FileText,    key: "feature2" },
  { icon: Users,       key: "feature3" },
  { icon: Bot,         key: "feature4" },
  { icon: Heart,       key: "feature5" },
  { icon: ShieldCheck, key: "feature6" },
];

export function AuthLeftPanel() {
  const { t } = useTranslation("auth");

  return (
    <div className="hidden lg:flex flex-col justify-between h-full px-12 py-10
                    bg-gradient-to-br from-indigo-600 via-sky-500 to-teal-400
                    text-white relative overflow-hidden">

      {/* Background decorative circles */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
      <div className="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] rounded-full bg-white/5" />
      <div className="absolute top-1/2 -right-16 w-64 h-64 rounded-full bg-white/5" />

      {/* Logo */}
      <div className="relative z-10">
        <SanoTalkLogoV2 size={56} showText={true} light={true} />
      </div>

      {/* Centre content */}
      <div className="relative z-10 space-y-8">
        {/* Illustration — abstract sound/health waves */}
        <svg viewBox="0 0 280 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-xs opacity-80">
          {/* Heartbeat line */}
          <polyline
            points="0,60 40,60 55,20 65,95 75,35 90,75 105,60 280,60"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
          {/* Pulse rings */}
          <circle cx="72" cy="60" r="18" stroke="white" strokeWidth="1" strokeOpacity="0.3" fill="none" />
          <circle cx="72" cy="60" r="30" stroke="white" strokeWidth="1" strokeOpacity="0.15" fill="none" />
          {/* Mic dot */}
          <circle cx="72" cy="60" r="5" fill="white" fillOpacity="0.9" />
          {/* Sound bars */}
          <rect x="160" y="45" width="6" height="30" rx="3" fill="white" fillOpacity="0.5" />
          <rect x="172" y="35" width="6" height="50" rx="3" fill="white" fillOpacity="0.7" />
          <rect x="184" y="50" width="6" height="20" rx="3" fill="white" fillOpacity="0.5" />
          <rect x="196" y="40" width="6" height="40" rx="3" fill="white" fillOpacity="0.65" />
          <rect x="208" y="52" width="6" height="16" rx="3" fill="white" fillOpacity="0.4" />
          <rect x="220" y="44" width="6" height="32" rx="3" fill="white" fillOpacity="0.55" />
        </svg>

        <div>
          <h2 className="text-3xl font-bold leading-snug">
            {t("panel.headline")}
          </h2>
          <p className="mt-3 text-white/75 text-base leading-relaxed">
            {t("panel.subheadline")}
          </p>
        </div>

        <ul className="space-y-3">
          {features.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center gap-3 text-sm text-white/90">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </span>
              {t(`panel.${key}`)}
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-white/40 text-xs">
        {t("panel.footer")}
      </p>
    </div>
  );
}
