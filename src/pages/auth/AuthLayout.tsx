import type { ReactNode } from "react";
import { ApiError } from "../../api/client";

/** AuthLayout is the two-column frame of the signed-out pages. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-800 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(94,234,212,0.35),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(20,184,166,0.4),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <span className="text-lg font-semibold tracking-tight">Legion</span>
          <div>
            <p className="max-w-md text-3xl leading-tight font-semibold">Your group's savings, contributions and members, in one place.</p>
            <p className="mt-4 max-w-md text-brand-100">See what you've paid, what's due, and how your group is doing.</p>
          </div>
          <span className="text-sm text-brand-200">Chamas · SACCOs · Investment groups</span>
        </div>
      </div>
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

/** codeError explains the API's answers to an SMS code. */
export function codeError(err: unknown): string | null {
  if (!err) return null;
  if (!(err instanceof ApiError)) return "Could not reach the server. Check your connection and try again.";
  switch (err.code) {
    case "invalid_code":
      return "That code isn't right. Check the SMS and try again.";
    case "code_expired":
      return "That code has expired or was tried too many times. Ask for a new one.";
    case "too_many_codes":
      return "Too many codes were sent to this number. Wait an hour and try again.";
    case "weak_password":
      return "Use a password of at least 8 characters.";
    default:
      return err.message;
  }
}

export const minPassword = 8;
