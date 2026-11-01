import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { KeyRound, Loader2, Send } from "lucide-react";
import { forgotPassword, resetPassword } from "../../api/account";
import { Field, InlineError } from "../../components/ui";
import { AuthLayout, codeError, minPassword } from "./AuthLayout";

/** ForgotPasswordPage texts a code to the account's phone, then sets a new password with it. */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(identity.trim());
      setSent(true);
    } catch (err) {
      setError(codeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < minPassword) return setError(`Use a password of at least ${minPassword} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await resetPassword(identity.trim(), code.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(codeError(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      {!sent ? (
        <form onSubmit={send} className="space-y-5" noValidate>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-1 text-sm text-slate-500">Enter your phone number or email. We'll text a code to the phone on your account.</p>
          </div>
          {error && <InlineError error={new Error(error)} />}
          <Field label="Phone number or email" htmlFor="fp-identity">
            <input id="fp-identity" className="input" autoComplete="username" placeholder="0712 345 678" value={identity} onChange={(e) => setIdentity(e.target.value)} autoFocus />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={busy || !identity.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            Send code
          </button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
              Back to log in
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4" noValidate>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
            <p className="mt-1 text-sm text-slate-500">If {identity.trim()} has an account, a 6-digit code is on its way by SMS. It lasts 15 minutes.</p>
          </div>
          {error && <InlineError error={new Error(error)} />}
          <Field label="Code" htmlFor="fp-code">
            <input
              id="fp-code"
              className="input text-center text-lg tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </Field>
          <Field label="New password" htmlFor="fp-password" hint={`At least ${minPassword} characters.`}>
            <input id="fp-password" type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="fp-confirm">
            <input id="fp-confirm" type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6 || !password || !confirm}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
            Set password and log in
          </button>
          <p className="text-center text-sm text-slate-500">
            No SMS?{" "}
            <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300" disabled={busy} onClick={() => send()}>
              Send a new code
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
