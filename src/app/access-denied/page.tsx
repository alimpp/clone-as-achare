import type { Metadata } from "next";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "دسترسی مجاز نیست", robots: { index: false, follow: false } };

export default function AccessDeniedPage() {
  return (
    <main id="main" className="grid min-h-[70vh] place-items-center px-4 py-16 text-center">
      <div className="max-w-md space-y-5">
        <p className="text-sm font-bold text-danger">دسترسی محدود</p>
        <h1 className="text-3xl font-extrabold tracking-tight">این بخش برای حساب شما فعال نیست</h1>
        <p className="leading-8 text-muted">
          این صفحه فقط برای نقش دیگری از حساب‌های آرنا در دسترس است. اگر فکر می‌کنید اشتباهی رخ داده، با پشتیبانی تماس بگیرید.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href="/">بازگشت به صفحه اصلی</Button>
          <Button href="/login" variant="outline">ورود با حساب دیگر</Button>
        </div>
      </div>
    </main>
  );
}
