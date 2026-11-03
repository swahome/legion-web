import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { InlineError } from "../components/ui";
import { AuthLayout } from "./auth/AuthLayout";

function loginError(err: unknown): string {
  if (!(err instanceof ApiError)) return "Could not reach the server. Check your connection and try again.";
  switch (err.code) {
    case "invalid_credentials":
      return "That phone number or email and password don't match.";
    case "too_many_attempts": {
      const mins = err.retryAfter ? Math.ceil(err.retryAfter / 60) : 10;
      return `Too many failed attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`;
    }
    case "password_reset_required":
      return "You need to set a new password before logging in. Use \"Forgot password?\" to get a code by SMS.";
    case "account_inactive":
      return "This account has been deactivated.";
    default:
      return err.message;
  }
}

export interface LoginCountry {
  code: string;
  name: string;
  calling_code: string;
  is_default: boolean;
}

export interface LoginOptions {
  countries: LoginCountry[];
  links: Partial<Record<"android_app" | "ios_app" | "terms" | "support" | "demo", string>>;
}

const linkLabels: [keyof LoginOptions["links"], string][] = [
  ["android_app", "Get the Android app"],
  ["ios_app", "Get the iPhone app"],
  ["demo", "Online demo"],
  ["support", "Support"],
  ["terms", "Terms and conditions"],
];

/** looksLikePhone says whether the login box holds a phone number rather than an email. */
export function looksLikePhone(v: string): boolean {
  return v.trim() !== "" && /^[\d\s()+-]+$/.test(v.trim());
}

/**
 * withCallingCode puts the picked country's code on a local number:
 * 0712 345 678 with +254 becomes +254712345678. Numbers that already carry
 * a code, and emails, are sent as typed.
 */
export function withCallingCode(identity: string, cc: string | undefined): string {
  const v = identity.trim();
  if (!cc || !looksLikePhone(v) || v.startsWith("+")) return v;
  const digits = v.replace(/\D/g, "");
  if (digits.startsWith(cc) && digits.length > cc.length + 8) return "+" + digits;
  return "+" + cc + digits.replace(/^0+/, "");
}

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const options = useQuery({
    queryKey: ["login-options"],
    queryFn: () => api.publicGet<LoginOptions>("/v1/auth/options"),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const countries = options.data?.countries ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const country = countries.find((c) => c.code === picked) ?? countries.find((c) => c.is_default) ?? countries[0];
  const showPicker = countries.length > 0 && (identity === "" || looksLikePhone(identity));

  if (status === "signed-in") {
    const from = (location.state as { from?: string } | null)?.from;
    // Only follow app-relative paths, never "//host" style redirects.
    const to = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
    return <Navigate to={to} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(withCallingCode(identity, showPicker ? country?.calling_code : undefined), password);
    } catch (err) {
      setError(loginError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-1 text-sm text-slate-500">Use your phone number or email address.</p>
        </div>
        {error && <InlineError error={new Error(error)} />}
        <div>
          <label className="label" htmlFor="identity">
            Phone number or email
          </label>
          <div className="flex gap-2">
            {showPicker && country && (
              <select
                className="input w-auto shrink-0"
                aria-label="Country code"
                value={country.code}
                onChange={(e) => setPicked(e.target.value)}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code} title={c.name}>
                    {c.code} +{c.calling_code}
                  </option>
                ))}
              </select>
            )}
            <input
              id="identity"
              className="input min-w-0"
              autoComplete="username"
              inputMode="email"
              placeholder="0712 345 678"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              required
              autoFocus
            />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input pr-10"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={busy || !identity.trim() || !password}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
          {busy ? "Logging in" : "Log in"}
        </button>
        <p className="text-center text-sm text-slate-500">
          New to Legion?{" "}
          <Link to="/signup" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Create an account
          </Link>
        </p>
        {options.data && Object.keys(options.data.links).length > 0 && (
          <nav aria-label="More" className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
            {linkLabels
              .filter(([k]) => options.data.links[k])
              .map(([k, label]) => (
                <a key={k} href={options.data.links[k]} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-700 hover:underline dark:hover:text-slate-300">
                  {label}
                </a>
              ))}
          </nav>
        )}
      </form>
    </AuthLayout>
  );
}
