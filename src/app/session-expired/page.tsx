import type { Metadata } from "next";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "نشست شما پایان یافته است", robots: { index: false, follow: false } };

export default function SessionExpiredPage() {
  return (
    <main id="main" className="grid min-h-[70vh] place-items-center px-4 py-16 text-center">
      <div className="max-w-md space-y-5">
        <p className="text-sm font-bold text-amber-700">نشست منقضی شده</p>
        <h1 className="text-3xl font-extrabold tracking-tight">برای ادامه دوباره وارد شوید</h1>
        <p className="leading-8 text-muted">
          به دلیل امنیت، نشست شما پس از مدتی بی‌فعالیتی یا تغییر رمز عبور پایان یافته است. پس از ورود دوباره، همان صفحه را ادامه می‌دهید.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href="/login">ورود دوباره</Button>
          <Button href="/" variant="outline">صفحه اصلی</Button>
        </div>
      </div>
    </main>
  );
}
