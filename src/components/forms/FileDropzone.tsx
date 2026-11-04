"use client";

import { useId, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui";
import { faNum, type Attachment } from "@/lib/domain";

const DEFAULT_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${faNum((bytes / 1_000_000).toFixed(1))} مگابایت` : `${faNum(Math.round(bytes / 1000))} کیلوبایت`;
}

/**
 * Drag-and-drop image upload with validation and previews. Files are read locally
 * (FileReader); the "reading" state reflects a real operation, not a simulated progress bar.
 */
export function FileDropzone({
  label,
  value,
  onChange,
  maxFiles = 4,
  maxBytes = 1_500_000,
  accept = DEFAULT_TYPES,
  hint,
  error,
}: {
  label: string;
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  maxFiles?: number;
  maxBytes?: number;
  accept?: string[];
  hint?: string;
  error?: string;
}) {
  const inputId = useId();
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  async function addFiles(list: FileList | File[] | null) {
    if (!list || list.length === 0) return;
    const next = [...value];
    setReading(true);
    try {
      for (const file of Array.from(list)) {
        if (next.length >= maxFiles) {
          toast.error(`حداکثر ${faNum(maxFiles)} فایل مجاز است`);
          break;
        }
        if (!accept.includes(file.type)) {
          toast.error(`«${file.name}» فرمت مجاز ندارد. فقط JPG، PNG یا WebP.`);
          continue;
        }
        if (file.size > maxBytes) {
          toast.error(`حجم «${file.name}» بیش از ${formatSize(maxBytes)} است.`);
          continue;
        }
        next.push({ name: file.name, type: file.type, size: file.size, dataUrl: await readFile(file) });
      }
      onChange(next);
    } catch {
      toast.error("خواندن فایل انجام نشد. دوباره تلاش کنید.");
    } finally {
      setReading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <p id={`${inputId}-label`} className="text-sm font-medium text-ink">
        {label}
      </p>
      <input
        id={inputId}
        type="file"
        multiple={maxFiles > 1}
        accept={accept.join(",")}
        aria-labelledby={`${inputId}-label`}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className="peer sr-only"
        disabled={reading || value.length >= maxFiles}
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-3xl border-2 border-dashed p-6 text-center transition-[border-color,background-color] duration-300 ease-premium ${
          dragging ? "border-brand bg-brand-soft" : error ? "border-danger/50 bg-red-50/40" : "border-line bg-surface hover:border-brand/50 hover:bg-brand/[0.02]"
        }`}
      >
        <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20">
          <span className={`grid size-12 place-items-center rounded-2xl transition-transform duration-300 ${dragging ? "scale-110 bg-brand text-white" : "bg-brand-soft text-brand"}`}>
            {reading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
          </span>
          <span className="text-sm font-semibold text-ink">{reading ? "در حال پردازش تصاویر…" : "فایل را اینجا رها کنید یا انتخاب کنید"}</span>
          <span id={`${inputId}-hint`} className="text-xs leading-6 text-muted">
            {hint ?? `حداکثر ${faNum(maxFiles)} تصویر؛ هرکدام تا ${formatSize(maxBytes)} (JPG، PNG، WebP)`}
          </span>
        </label>
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((file, i) => (
            <li key={`${file.name}-${i}`} className="group relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={file.dataUrl} alt={file.name} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2.5">
                <span className="min-w-0 truncate text-xs text-ink">{file.name}</span>
                <span className="shrink-0 text-[11px] text-muted">{formatSize(file.size)}</span>
              </div>
              <button
                type="button"
                aria-label={`حذف ${file.name}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-night/80 text-white transition hover:bg-danger focus-visible:ring-4 focus-visible:ring-white/50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
