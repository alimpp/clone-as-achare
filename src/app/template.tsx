import type { ReactNode } from "react";

/**
 * Re-mounted on every navigation (unlike layout.tsx), so each page gets a
 * short, transform-only entrance. Header and footer stay mounted and do not flash.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page-enter">{children}</div>;
}
