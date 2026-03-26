import { useTranslation } from "react-i18next";

interface LogoProps {
  size?: number;
  showText?: boolean;
  light?: boolean;
}

export function SanoTalkLogoV2({ size = 64, showText = true, light = false }: LogoProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-center gap-4 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="v2-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="v2-heart" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Circle background */}
        <circle cx="32" cy="32" r="32" fill="url(#v2-bg)" />

        {/* Subtle inner ring */}
        <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="0.5" strokeOpacity="0.2" fill="none" />

        {/* Stethoscope — left earpiece */}
        <circle cx="14" cy="13" r="3" fill="white" fillOpacity="0.9" />
        {/* Stethoscope — right earpiece */}
        <circle cx="28" cy="13" r="3" fill="white" fillOpacity="0.9" />

        {/* Stethoscope — tube connecting earpieces */}
        <path
          d="M14 16 Q14 22 21 22 Q28 22 28 16"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Stethoscope — tube going down to chest piece */}
        <path
          d="M21 22 Q21 34 30 40"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Stethoscope — chest piece (ring + center) */}
        <circle cx="33" cy="43" r="7" stroke="white" strokeWidth="2.2" fill="white" fillOpacity="0.12" />
        <circle cx="33" cy="43" r="2.5" fill="white" fillOpacity="0.95" filter="url(#glow)" />

        {/* Microphone — overlapping top-right */}
        {/* Mic body */}
        <rect x="38" y="10" width="10" height="16" rx="5" fill="white" fillOpacity="0.95" />
        {/* Mic grille lines */}
        <line x1="39" y1="15" x2="47" y2="15" stroke="#6366f1" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="39" y1="18" x2="47" y2="18" stroke="#6366f1" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="39" y1="21" x2="47" y2="21" stroke="#6366f1" strokeWidth="0.8" strokeOpacity="0.5" />
        {/* Mic arc */}
        <path
          d="M35 24 Q35 32 43 32 Q51 32 51 24"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Mic stand */}
        <line x1="43" y1="32" x2="43" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="38" y1="38" x2="48" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round" />

        {/* Sound wave dots — bottom left */}
        <circle cx="10" cy="46" r="1.5" fill="white" fillOpacity="0.5" />
        <circle cx="15" cy="42" r="1.5" fill="white" fillOpacity="0.65" />
        <circle cx="10" cy="52" r="1.5" fill="white" fillOpacity="0.35" />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none gap-0.5">
          <span className={light
            ? "text-3xl font-black tracking-tight text-white"
            : "text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 bg-clip-text text-transparent"
          }>
            SanoTalk
          </span>
          <span className={light
            ? "text-[11px] font-medium tracking-widest text-white/70 uppercase"
            : "text-[11px] font-medium tracking-widest text-muted-foreground uppercase"
          }>
            {t("appSubtitle")}
          </span>
        </div>
      )}
    </div>
  );
}
