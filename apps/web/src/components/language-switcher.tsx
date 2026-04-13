import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES, isRTL } from "../lib/i18n";

// Quebec flag (Fleurdelisé): blue field, white cross, four white fleurs-de-lys.
// Unicode doesn't have an emoji for subdivision flags that renders on all OSes,
// so we render it inline. Sized at 1em to match surrounding emoji flags.
//
// The fleur-de-lys uses the Unicode character ⚜ with the text-variation selector
// (U+FE0E) to force monochrome glyph rendering instead of the gold emoji, so we
// can recolor it white via SVG `fill`. This renders crisply at small sizes using
// the OS's heraldic font glyph — much cleaner than a hand-authored path.
function QuebecFlag() {
  const quadrants: Array<[number, number]> = [
    [7.5, 5],
    [22.5, 5],
    [7.5, 15],
    [22.5, 15],
  ];
  return (
    <svg
      viewBox="0 0 30 20"
      aria-label="Drapeau du Québec"
      className="inline-block align-[-0.15em]"
      style={{ width: "1.3em", height: "0.9em" }}
    >
      <rect width="30" height="20" fill="#003DA5" />
      <path d="M13 0h4v20h-4zM0 8h30v4H0z" fill="#fff" />
      {quadrants.map(([cx, cy], i) => (
        <text
          key={i}
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="7"
          fill="#fff"
          style={{ fontFamily: "'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', serif" }}
        >
          {"\u269C\uFE0E"}
        </text>
      ))}
    </svg>
  );
}

function Flag({ lang }: { lang: (typeof SUPPORTED_LANGUAGES)[number] }) {
  if (lang.code === "fr") return <QuebecFlag />;
  return <>{lang.flag}</>;
}

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  // Update document direction when language changes
  useEffect(() => {
    document.documentElement.dir = isRTL(i18n.language) ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)
    ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline"><Flag lang={current} /> {current.label}</span>
          <span className="sm:hidden"><Flag lang={current} /></span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={i18n.language === lang.code ? "font-semibold bg-accent" : ""}
          >
            <span className="mr-2"><Flag lang={lang} /></span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
