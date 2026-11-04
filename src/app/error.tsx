"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[70vh] place-items-center px-4 py-16 text-center">
      <div className="max-w-md space-y-5">
        <p className="text-sm font-semibold text-danger">خطای غیرمنتظره</p>
        <h1 className="text-3xl font-extrabold">مشکلی پیش آمد</h1>
        <p className="leading-8 text-muted">این صفحه با خطا روبه‌رو شد. می‌توانید دوباره تلاش کنید یا به صفحه اصلی بازگردید.</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => reset()}>تلاش مجدد</Button>
          <Button href="/" variant="outline">صفحه اصلی</Button>
        </div>
      </div>
    </main>
  );
}
