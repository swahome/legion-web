import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Loader2, UserPlus } from "lucide-react";
import { signup } from "../../api/account";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { Field, InlineError } from "../../components/ui";
import { AuthLayout, minPassword } from "./AuthLayout";

function signupError(err: unknown): string {
  if (!(err instanceof ApiError)) return "Could not reach the server. Check your connection and try again.";
  switch (err.code) {
    case "phone_taken":
      return "There's already an account with this phone number. Log in, or reset your password.";
    case "email_taken":
      return "There's already an account with this email address.";
    case "invalid_phone":
      return "Enter a valid phone number, like 0712 345 678.";
    case "invalid_email":
      return "Enter a valid email address, or leave it blank.";
    case "weak_password":
      return "Use a password of at least 8 characters.";
    default:
      return err.message;
  }
}

/** SignupPage creates an account; the phone is confirmed next with an SMS code. */
export function SignupPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (status === "signed-in" && !busy) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < minPassword) {
      setError(`Use a password of at least ${minPassword} characters.`);
      return;
    }
    setBusy(true);
    try {
      await signup({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
      });
      navigate("/verify-phone", { replace: true, state: { next: "/groups/new" } });
    } catch (err) {
      setError(signupError(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="mt-1 text-sm text-slate-500">We'll text a code to your phone to confirm it's yours.</p>
        </div>
        {error && <InlineError error={new Error(error)} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="su-first">
            <input id="su-first" className="input" autoComplete="given-name" value={form.first_name} onChange={set("first_name")} required autoFocus />
          </Field>
          <Field label="Last name" htmlFor="su-last">
            <input id="su-last" className="input" autoComplete="family-name" value={form.last_name} onChange={set("last_name")} />
          </Field>
        </div>
        <Field label="Phone number" htmlFor="su-phone">
          <input id="su-phone" className="input" type="tel" autoComplete="tel" placeholder="0712 345 678" value={form.phone} onChange={set("phone")} required />
        </Field>
        <Field label="Email (optional)" htmlFor="su-email">
          <input id="su-email" className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Password" htmlFor="su-password" hint={`At least ${minPassword} characters.`}>
          <input id="su-password" className="input" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={busy || !form.first_name.trim() || !form.phone.trim() || !form.password}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
          {busy ? "Creating your account" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
