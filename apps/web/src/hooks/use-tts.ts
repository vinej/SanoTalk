import { useState, useEffect, useRef } from "react";

const LANG_MAP: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  zh: "zh-CN",
  ar: "ar-SA",
  hi: "hi-IN",
};

function getBCP47(lang: string): string {
  const prefix = (lang.split("-")[0] ?? "en").toLowerCase();
  return LANG_MAP[prefix] ?? lang;
}

export function useTts() {
  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  function speak(text: string, lang: string) {
    if (!isSupported) return;
    window.speechSynthesis.cancel();

    const bcp47 = getBCP47(lang);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = bcp47;

    // Pick best available voice for the language
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(bcp47.toLowerCase().slice(0, 2)));
    if (match) utterance.voice = match;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  useEffect(() => {
    return () => { stop(); };
  }, []);

  return { speak, stop, isSpeaking, isSupported };
}
