"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Field } from "@/components/ui";
import { normalizeFa } from "@/lib/domain";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

/**
 * Custom single-select with keyboard support, optional search and a bottom sheet on small screens.
 * The trigger is a real combobox button, so screen readers and touch targets work correctly.
 */
export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "انتخاب کنید",
  error,
  hint,
  required = false,
  searchable = false,
  clearable = false,
  disabled = false,
  emptyText = "موردی پیدا نشد",
}: {
  id?: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  emptyText?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = normalizeFa(query);
    if (!q) return options;
    return options.filter((o) => normalizeFa(`${o.label} ${o.description ?? ""}`).includes(q));
  }, [options, query]);

  // Close on outside pointer interaction.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // On open: start at the selected option, focus the panel (or its search box).
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const idx = Math.max(0, filtered.findIndex((o) => o.value === value));
    setActive(idx);
    const focusTarget = panelRef.current?.querySelector<HTMLElement>("input") ?? panelRef.current;
    focusTarget?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the active option visible inside the scroll container.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${inputId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, inputId]);

  function choose(o: SelectOption) {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveActive(delta: number) {
    if (filtered.length === 0) return;
    let next = active;
    for (let step = 0; step < filtered.length; step++) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next]?.disabled) break;
    }
    setActive(next);
  }

  function onPanelKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, filtered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o) choose(o);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <Field label={label} htmlFor={inputId} required={required} error={error} hint={hint}>
      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          id={inputId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onTriggerKey}
          className={`group flex h-12 w-full items-center gap-3 rounded-2xl border bg-surface ps-4 pe-11 text-start text-sm transition-[border-color,box-shadow] duration-200 ease-premium hover:border-brand/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-60 ${
            error ? "border-danger" : open ? "border-brand ring-4 ring-brand/15" : "border-line"
          }`}
        >
          {selected?.icon && <span className="shrink-0 text-brand">{selected.icon}</span>}
          <span className={`min-w-0 flex-1 truncate ${selected ? "font-medium text-ink" : "text-muted/80"}`}>{selected ? selected.label : placeholder}</span>
        </button>
        <ChevronDown
          aria-hidden="true"
          className={`pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 transition-transform duration-300 ease-premium ${open ? "rotate-180 text-brand" : "text-muted"}`}
        />
        {clearable && selected && !disabled && (
          <button
            type="button"
            aria-label="پاک کردن انتخاب"
            onClick={() => onChange("")}
            className="absolute end-11 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}

        {open && (
          <>
            <button type="button" tabIndex={-1} aria-label="بستن فهرست" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-night/40 sm:hidden" />
            <div
              ref={panelRef}
              tabIndex={-1}
              onKeyDown={onPanelKey}
              className="animate-sheet-up fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border border-line bg-surface p-4 shadow-lift outline-none sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-full sm:mt-2 sm:max-h-80 sm:rounded-2xl sm:p-2 sm:shadow-lift"
            >
              <div className="mb-3 flex items-center justify-between sm:hidden">
                <span className="text-sm font-bold text-ink">{label}</span>
                <span className="h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
              </div>
              {searchable && (
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onPanelKey}
                    placeholder="جستجو در گزینه‌ها"
                    aria-label="جستجو در گزینه‌ها"
                    aria-controls={listId}
                    className="h-11 w-full rounded-xl border border-line bg-canvas ps-10 pe-3 text-sm placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
                  />
                </div>
              )}
              <ul id={listId} role="listbox" aria-label={label} className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
                {filtered.map((o, i) => {
                  const isSelected = o.value === value;
                  return (
                    <li
                      key={o.value}
                      id={`${inputId}-opt-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={o.disabled || undefined}
                      onMouseEnter={() => !o.disabled && setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(o)}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 ${
                        i === active ? "bg-brand-soft" : ""
                      } ${o.disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {o.icon && <span className="shrink-0 text-brand">{o.icon}</span>}
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${isSelected ? "font-bold text-brand-strong" : "font-semibold text-ink"}`}>{o.label}</span>
                        {o.description && <span className="block truncate text-xs text-muted">{o.description}</span>}
                      </span>
                      {isSelected && <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />}
                    </li>
                  );
                })}
                {filtered.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">{emptyText}</li>}
              </ul>
            </div>
          </>
        )}
      </div>
    </Field>
  );
}
