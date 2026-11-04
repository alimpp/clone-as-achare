"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { toEnglishDigits } from "@/lib/domain";

/**
 * One-time code input: one box per digit, auto-advance, backspace across boxes,
 * arrow navigation, paste and SMS autofill of the whole code.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  label = "کد یکبارمصرف",
  error,
  disabled = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  label?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  const sanitize = (raw: string) => toEnglishDigits(raw).replace(/\D/g, "").slice(0, length);
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  function handleChange(i: number, raw: string) {
    // When a filled box is typed into, the browser value is "old + new": keep only the new digit.
    const current = chars[i] ?? "";
    const typed = raw.length > 1 && current && raw.startsWith(current) ? raw.slice(current.length) : raw;
    const digits = sanitize(typed);
    if (!digits) return;
    if (digits.length > 1) {
      onChange(digits);
      focusAt(Math.min(digits.length, length - 1));
      return;
    }
    onChange((value.slice(0, i) + digits + value.slice(i + 1)).slice(0, length));
    focusAt(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (chars[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const digits = sanitize(e.clipboardData.getData("text"));
    if (!digits) return;
    onChange(digits);
    focusAt(Math.min(digits.length, length - 1));
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label={label} dir="ltr" className="flex items-center justify-center gap-2 sm:gap-3">
        {chars.map((c, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`رقم ${i + 1} از ${length}`}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            value={c}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            onPaste={handlePaste}
            aria-invalid={error ? true : undefined}
            className={`h-14 w-11 rounded-2xl border-2 bg-surface text-center text-xl font-bold tabular-nums text-ink shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease-premium focus:-translate-y-0.5 focus:outline-none focus:ring-4 disabled:opacity-50 sm:h-16 sm:w-14 ${
              error
                ? "border-danger focus:border-danger focus:ring-danger/15"
                : c
                  ? "border-brand/40 focus:border-brand focus:ring-brand/15"
                  : "border-line focus:border-brand focus:ring-brand/15"
            }`}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-center text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
