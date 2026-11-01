import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { acceptInvite, useInvite } from "../../api/account";
import { ApiError } from "../../api/client";
import { Field, InlineError, Spinner } from "../../components/ui";
import { AuthLayout, codeError, minPassword } from "./AuthLayout";

/** JoinPage is the link in an SMS invite: the member sets a password and lands in the group. */
export function JoinPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const invite = useInvite(token);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (invite.isPending) return <Spinner label="Opening your invite" />;

  if (invite.isError || !invite.data.needs_password) {
    const expired = invite.error instanceof ApiError && (invite.error.code === "invite_expired" || invite.error.status === 404 || invite.error.status === 410);
    return (
      <AuthLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">{invite.isError ? (expired ? "This invite has expired" : "Couldn't open this invite") : "You already have a password"}</h1>
          <p className="text-sm text-slate-500">
            {invite.isError
              ? expired
                ? "Invites last 30 days and work once. Ask your group official to send a new one, or reset your password if you already have an account."
                : "Check your connection and try the link again."
              : "Log in with your phone number and password to see your group."}
          </p>
          <div className="flex gap-2">
            <Link to="/login" className="btn-primary">
              Log in
            </Link>
            <Link to="/forgot-password" className="btn-secondary">
              Reset password
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const inv = invite.data;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < minPassword) return setError(`Use a password of at least ${minPassword} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await acceptInvite(token, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.code === "password_already_set" ? "You've already set a password. Log in instead." : codeError(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {inv.first_name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {inv.invited_by} added you to <span className="font-medium text-slate-700 dark:text-slate-200">{inv.group_name}</span>. Choose a password to log in with your phone number.
          </p>
        </div>
        {error && <InlineError error={new Error(error)} />}
        <Field label="Password" htmlFor="jn-password" hint={`At least ${minPassword} characters.`}>
          <input id="jn-password" type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <Field label="Confirm password" htmlFor="jn-confirm">
          <input id="jn-confirm" type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={busy || !password || !confirm}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
          Set password and open my group
        </button>
      </form>
    </AuthLayout>
  );
}
