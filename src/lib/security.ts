import { ApiError } from "./auth";
import { faNum } from "./domain";

/*
 * Authentication hardening helpers.
 *
 * Rate limiting uses an in-process sliding window. It protects a single server instance.
 * A multi-instance deployment should move this store to a shared cache (for example Redis).
 */

const WINDOWS = new Map<string, number[]>();

function prune(key: string, windowMs: number, now: number): number[] {
  const list = (WINDOWS.get(key) ?? []).filter((t) => now - t < windowMs);
  WINDOWS.set(key, list);
  return list;
}

function tooMany(retryMs: number): ApiError {
  const minutes = Math.max(1, Math.ceil(retryMs / 60_000));
  return new ApiError(429, `تعداد تلاش‌ها بیش از حد مجاز است. ${faNum(minutes)} دقیقه دیگر دوباره تلاش کنید.`, "rate_limited");
}

/** Counts one attempt. Throws 429 once `max` attempts were made within `windowMs`. */
export function consumeRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const list = prune(key, windowMs, now);
  if (list.length >= max) throw tooMany(list[0]! + windowMs - now);
  list.push(now);
}

/** Throws 429 when `max` failures are already recorded for the key. Does not count anything. */
export function assertNotLimited(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const list = prune(key, windowMs, now);
  if (list.length >= max) throw tooMany(list[0]! + windowMs - now);
}

/** Records a failed attempt (wrong password, wrong code). */
export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();
  prune(key, windowMs, now).push(now);
}

/** Clears failures after a successful sign-in or verification. */
export function clearFailures(key: string): void {
  WINDOWS.delete(key);
}

/**
 * Development OTP echo. When AUTH_DEV_OTP_ECHO=true the verification code is returned
 * in API responses so the sandbox can be tested without an SMS provider.
 * Must be false (or unset) in any real deployment.
 */
export function isDevOtpEcho(): boolean {
  return process.env.AUTH_DEV_OTP_ECHO === "true";
}

export interface OtpDelivery {
  channel: "sms";
  delivered: boolean;
  provider: string;
  devCode: string | null;
}

/**
 * OTP delivery abstraction. No SMS gateway is bundled. When SMS_PROVIDER is set, a real
 * adapter must be implemented here; until then the call fails loudly instead of pretending
 * a message was sent. Without a provider, the code is only echoed in the explicit sandbox mode.
 */
export async function deliverOtp(phone: string, code: string): Promise<OtpDelivery> {
  const provider = process.env.SMS_PROVIDER ?? "";
  if (provider) {
    throw new ApiError(503, "سرویس پیامک پیکربندی شده، اما آداپتور آن در این نسخه فعال نیست.", "sms_unavailable");
  }
  if (!isDevOtpEcho()) {
    throw new ApiError(503, "ارسال پیامک فعال نیست. برای ادامه با پشتیبانی تماس بگیرید.", "sms_unavailable");
  }
  void phone;
  return { channel: "sms", delivered: false, provider: "sandbox", devCode: code };
}
