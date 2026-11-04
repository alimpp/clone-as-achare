"use client";

import { Field, Input, Select, Textarea, Toggle } from "@/components/ui";
import { type FormQuestion } from "@/lib/domain";

/** Renders one service-specific question. The field type comes from the service's dynamic form definition. */
export function QuestionField({ q, value, error, onChange }: { q: FormQuestion; value: unknown; error?: string; onChange: (v: unknown) => void }) {
  const id = `q-${q.key}`;
  const label = q.label;
  switch (q.type) {
    case "textarea":
      return (
        <Field label={label} htmlFor={id} required={q.required} error={error} hint={q.helpText}>
          <Textarea id={id} value={String(value ?? "")} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} error={error} />
        </Field>
      );
    case "select":
      return (
        <Field label={label} htmlFor={id} required={q.required} error={error}>
          <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} error={error}>
            <option value="">انتخاب کنید</option>
            {q.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "radio":
      return (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            {label}
            {q.required && <span className="ms-1 text-danger">*</span>}
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {q.options?.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={value === o}
                onClick={() => onChange(o)}
                className={`rounded-xl border px-4 py-2.5 text-sm transition-all duration-200 ease-premium ${value === o ? "border-brand bg-brand-soft font-semibold text-brand-strong shadow-card" : "border-line bg-surface hover:-translate-y-px hover:border-brand/40"}`}
              >
                {o}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </fieldset>
      );
    case "checkbox": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            {label}
            {q.required && <span className="ms-1 text-danger">*</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {q.options?.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input type="checkbox" className="size-4 accent-brand" checked={arr.includes(o)} onChange={() => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])} />
                {o}
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </fieldset>
      );
    }
    case "boolean":
      return (
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4 text-sm">
          <span>{label}</span>
          <Toggle checked={value === true} onChange={(v) => onChange(v)} label={label} />
        </label>
      );
    case "file":
      return null;
    default: {
      const inputType = q.type === "number" ? "number" : q.type === "date" ? "date" : q.type === "time" ? "time" : "text";
      return (
        <Field label={label} htmlFor={id} required={q.required} error={error} hint={q.helpText}>
          <Input id={id} type={inputType} dir={inputType === "text" ? undefined : "ltr"} min={q.min} max={q.max} placeholder={q.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} error={error} />
        </Field>
      );
    }
  }
}
