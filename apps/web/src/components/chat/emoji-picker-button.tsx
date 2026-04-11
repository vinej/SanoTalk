import { useRef, useState, useEffect } from "react";
import { Smile } from "lucide-react";
import { Button } from "../ui/button";

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPickerButton({ onEmojiSelect }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [Picker, setPicker] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Lazy-load emoji-mart only when opened
  useEffect(() => {
    if (open && !Picker) {
      Promise.all([
        import("@emoji-mart/react"),
        import("@emoji-mart/data"),
      ]).then(([pickerMod, dataMod]) => {
        setPicker(() => pickerMod.default);
        setData(dataMod.default);
      });
    }
  }, [open, Picker]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setOpen((v) => !v)}
      >
        <Smile className="h-4 w-4" />
      </Button>
      {open && Picker && data && (
        <div className="absolute bottom-10 left-0 z-50">
          <Picker
            data={data}
            onEmojiSelect={(emoji: any) => {
              onEmojiSelect(emoji.native);
              setOpen(false);
            }}
            theme="light"
            previewPosition="none"
            skinTonePosition="search"
            maxFrequentRows={2}
          />
        </div>
      )}
    </div>
  );
}
