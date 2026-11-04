"use client";

import { useId } from "react";
import { toEnglishDigits } from "@/lib/domain";

/**
 * Toman amount input. Stores plain digits (ASCII) and displays grouped Persian digits.
 * Input is restricted to digits, so pasted separators or Persian numerals are normalised.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  error,
  placeholder = "۰",
  suffix = "تومان",
  disabled = false,
  maxDigits = 12,
}: {
  id?: string;
  value: string;
  onChange: (digits: string) => void;
  error?: string;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
  maxDigits?: number;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const digits = value.replace(/\D/g, "").slice(0, maxDigits);
  const display = digits ? new Intl.NumberFormat("fa-IR").format(Number(digits)) : "";

  return (
    <div className="relative">
      <input
        id={inputId}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, maxDigits))}
        className={`h-12 w-full rounded-2xl border bg-surface ps-4 pe-24 text-start text-base font-semibold tabular-nums text-ink transition-[border-color,box-shadow] duration-200 ease-premium placeholder:text-muted/60 focus:outline-none focus:ring-4 disabled:bg-canvas disabled:opacity-60 ${
          error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-line hover:border-brand/40 focus:border-brand focus:ring-brand/15"
        }`}
      />
      <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">{suffix}</span>
    </div>
  );
}
