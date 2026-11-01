import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useResendPhoneCode, useVerifyPhone } from "../../api/account";
import { ApiError } from "../../api/client";
import { useMe } from "../../api/hooks";
import { Field, InlineError, Spinner } from "../../components/ui";
import { AuthLayout, codeError } from "./AuthLayout";

/** safeNext only follows app-relative paths. */
export function safeNext(state: unknown, fallback = "/"): string {
  const next = (state as { next?: string } | null)?.next;
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** VerifyPhonePage takes the code texted at sign-up. */
export function VerifyPhonePage() {
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const verify = useVerifyPhone();
  const resend = useResendPhoneCode();
  const [code, setCode] = useState("");
  const next = safeNext(location.state);

  if (me.isPending) return <Spinner label="Loading" />;
  if (me.data?.user.phone_verified && !verify.isSuccess) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await verify.mutateAsync(code.trim()).then(() => true, () => false);
    if (ok) navigate(next, { replace: true });
  }

  const resent = resend.isSuccess || (resend.error instanceof ApiError && resend.error.code === "already_verified");
  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Confirm your phone</h1>
          <p className="mt-1 text-sm text-slate-500">
            We texted a 6-digit code to <span className="font-medium text-slate-700 dark:text-slate-200">{me.data?.user.phone ?? "your phone"}</span>. It lasts 15 minutes.
          </p>
        </div>
        {verify.error && <InlineError error={new Error(codeError(verify.error) ?? "")} />}
        {resend.error && !resent && <InlineError error={new Error(codeError(resend.error) ?? "")} />}
        <Field label="Code" htmlFor="vp-code">
          <input
            id="vp-code"
            className="input text-center text-lg tracking-[0.5em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={verify.isPending || code.length !== 6}>
          {verify.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
          Confirm
        </button>
        <p className="text-center text-sm text-slate-500">
          {resent ? (
            "A new code is on its way."
          ) : (
            <>
              No SMS?{" "}
              <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300" disabled={resend.isPending} onClick={() => resend.mutate()}>
                Send a new code
              </button>
            </>
          )}
        </p>
      </form>
    </AuthLayout>
  );
}
