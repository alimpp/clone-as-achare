"use client";

import { Printer } from "lucide-react";
import { buttonClasses } from "@/components/ui";

/** Opens the browser print dialog (use "Save as PDF" to download an invoice). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClasses("primary", "md")}>
      <Printer className="size-4" aria-hidden="true" />
      چاپ یا ذخیره PDF
    </button>
  );
}
