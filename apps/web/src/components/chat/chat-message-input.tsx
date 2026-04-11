import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "../ui/button";
import { EmojiPickerButton } from "./emoji-picker-button";
import { useTranslation } from "react-i18next";

interface ChatMessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatMessageInput({ onSend, disabled }: ChatMessageInputProps) {
  const { t } = useTranslation("chat");
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    // Auto-grow up to 3 lines
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 80) + "px";
  }

  function handleEmojiSelect(emoji: string) {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = value.slice(0, start) + emoji + value.slice(end);
      setValue(newVal);
      // Restore cursor after emoji
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + emoji.length;
        el.focus();
      });
    } else {
      setValue((v) => v + emoji);
    }
  }

  return (
    <div className="flex items-end gap-1.5 border-t bg-card px-3 py-2">
      <EmojiPickerButton onEmojiSelect={handleEmojiSelect} />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={t("typeMessage")}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        style={{ maxHeight: 80 }}
      />
      <Button
        size="sm"
        className="h-8 w-8 p-0 shrink-0"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
