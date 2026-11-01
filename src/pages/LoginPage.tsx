import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Loader2, LogIn } from "lucide-react";
import { ApiError } from "../api/client";
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

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      await login(identity.trim(), password);
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
          <input
            id="identity"
            className="input"
            autoComplete="username"
            inputMode="email"
            placeholder="0712 345 678"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            required
            autoFocus
          />
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
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
      </form>
    </AuthLayout>
  );
}
