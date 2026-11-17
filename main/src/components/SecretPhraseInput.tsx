import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { AlertTriangle, Check, Copy, Eye, Trash } from "@/kit";
import { EyeOff } from "@/kit/ext";
import { isBip39Word, suggestWords } from "@/lib/wallet/bip39";
import { cn } from "@/lib/utils";

const VALID_LENGTHS = [12, 15, 18, 21, 24];
const MASK = "•";

export function parsePhrase(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

export function phraseProblem(value: string): string | null {
  const words = parsePhrase(value);
  if (words.length === 0) return $t("Kurtarma ifadesini gir.");
  if (!VALID_LENGTHS.includes(words.length)) {
    return $t("{0} kelime girildi — geçerli uzunluklar 12, 15, 18, 21 veya 24 kelimedir.", [words.length]);
  }
  const bad = words.findIndex((w) => !isBip39Word(w));
  if (bad >= 0) return $t("{0}. kelime BIP-39 listesinde yok. Yazımı kontrol et.", [bad + 1]);
  return null;
}

function normalizePaste(text: string): string {
  return text.toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/ +/g, " ");
}

function maskPhrase(text: string, reveal: boolean): string {
  if (reveal) return text;
  const parts = text.split(/(\s+)/);
  let last = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].trim()) {
      last = i;
      break;
    }
  }
  const typing = last >= 0 && !/\s$/.test(text);
  return parts
    .map((part, i) => {
      if (!part.trim()) return part;
      if (typing && i === last) return part;
      return MASK.repeat(part.length);
    })
    .join("");
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SecretPhraseInput({ value, onChange, onSubmit, placeholder, autoFocus }: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const words = useMemo(() => parsePhrase(value), [value]);
  const problem = useMemo(() => phraseProblem(value), [value]);
  const target = words.length > 12 ? 24 : 12;
  const current = /\s$/.test(value) ? "" : (words[words.length - 1] ?? "");
  const suggestions = useMemo(
    () => (current.length >= 2 && !isBip39Word(current) ? suggestWords(current) : []),
    [current],
  );

  useEffect(() => {
    if (autoFocus) areaRef.current?.focus();
  }, [autoFocus]);

  function insert(text: string) {
    const area = areaRef.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    const head = value.slice(0, start).replace(/ +/g, " ");
    const tail = value.slice(end);
    const joiner = head && !head.endsWith(" ") ? " " : "";
    const next = `${head}${joiner}${text}${tail ? ` ${tail.trim()}` : " "}`;
    onChange(next);
    const caret = head.length + joiner.length + text.length + 1;
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(caret, caret);
    });
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const text = normalizePaste(e.clipboardData.getData("text"));
    if (text) insert(text);
  }

  async function pasteFromClipboard() {
    setPasteError(null);
    try {
      const text = normalizePaste(await navigator.clipboard.readText());
      if (!text) return setPasteError($t("Panoda kelime bulunamadı."));
      insert(text);
    } catch {
      setPasteError($t("Pano okunamadı. Alanın içine Ctrl+V ile yapıştır."));
      areaRef.current?.focus();
    }
  }

  function acceptSuggestion(word: string) {
    const head = value.slice(0, value.length - current.length);
    onChange(`${head}${word} `);
    requestAnimationFrame(() => {
      const area = areaRef.current;
      area?.focus();
      const caret = head.length + word.length + 1;
      area?.setSelectionRange(caret, caret);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      acceptSuggestion(suggestions[0]);
    }
  }

  const boxClass = "whitespace-pre-wrap break-words px-4 py-3.5 font-mono text-[13px] leading-6";

  return (
    <div>
      <div
        className={cn(
          "relative h-[188px] rounded-card border bg-bg2 transition-colors duration-150",
          focused ? "border-brand/55" : "border-line hover:border-linestrong",
          problem && words.length >= 12 && "border-danger/45",
        )}
        style={{ scrollbarGutter: "stable" }}
      >
        <div
          ref={mirrorRef}
          aria-hidden
          className={cn(boxClass, "pointer-events-none absolute inset-0 overflow-hidden text-text")}
          style={{ scrollbarGutter: "stable" }}
        >
          {maskPhrase(value, reveal)}
        </div>
        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.toLowerCase().replace(/[^a-z ]/g, " ").replace(/ {2,}/g, " "))
          }
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onScroll={(e) => {
            if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="none"
          autoComplete="off"
          maxLength={400}
          aria-label={$t("Gizli kurtarma ifadesi")}
          className={cn(
            boxClass,
            "absolute inset-0 h-full w-full resize-none overflow-y-auto bg-transparent text-transparent caret-brand outline-none placeholder:text-muted selection:bg-brand/30 selection:text-transparent",
          )}
          style={{ scrollbarGutter: "stable" }}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "tabular inline-flex items-center gap-1.5 rounded-ctrl border px-2.5 py-1 text-[11px] font-medium transition-colors",
              !problem
                ? "border-ok/30 bg-ok/[0.08] text-ok"
                : "border-line bg-surface2 text-muted",
            )}
          >
            {!problem && <Check size={11} />}
            {words.length} / {target} kelime
          </span>
          {words.length > 0 && !problem && (
            <span className="text-[11px] text-muted">{$t("İfade biçimi geçerli")}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            disabled={!value}
            className="inline-flex items-center gap-1.5 rounded-ctrl px-2 py-1 text-[12px] text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
            {reveal ? $t("Gizle") : $t("Göster")}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setPasteError(null);
              areaRef.current?.focus();
            }}
            disabled={!value}
            className="inline-flex items-center gap-1.5 rounded-ctrl px-2 py-1 text-[12px] text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            <Trash size={13} />
            {$t("Temizle")}
          </button>
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="inline-flex items-center gap-1.5 rounded-ctrl px-2 py-1 text-[13px] font-semibold text-text transition-colors hover:text-brand"
          >
            <Copy size={14} />
            {$t("Yapıştır")}
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{$t("öneri")}</span>
          {suggestions.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => acceptSuggestion(word)}
              className="rounded-ctrl border border-line bg-surface2 px-2 py-0.5 font-mono text-[11px] text-textsoft transition-colors hover:border-brand/40 hover:text-text"
            >
              {word}
            </button>
          ))}
          <span className="text-[10px] text-muted">{$t("Tab ile ilkini seç")}</span>
        </div>
      )}

      {(pasteError || (problem && words.length > 0)) && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-danger">
          <AlertTriangle size={12} className="mt-px shrink-0" />
          {pasteError ?? problem}
        </p>
      )}
    </div>
  );
}
