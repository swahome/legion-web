import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { Loader2, LogIn } from "lucide-react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { InlineError } from "../components/ui";

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
      return "You need to set a new password before logging in. Ask your group official for help.";
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
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
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
            <label className="label" htmlFor="password">
              Password
            </label>
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
        </form>
      </main>
    </div>
  );
}
