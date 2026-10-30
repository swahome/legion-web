import { AlertCircle, Inbox, Loader2, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { formatMoney, isNegative, isZero } from "../lib/format";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertCircle className="size-8 text-rose-500" aria-hidden />
      <p className="text-sm text-slate-600 dark:text-slate-300">{errorMessage(error)}</p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{errorMessage(error)}</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Inbox className="size-8 text-slate-300 dark:text-slate-600" aria-hidden />
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  brand: "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={cx("badge", badgeTones[tone])}>{children}</span>;
}

/** Balance shows what a member owes: red when owing, green when ahead. */
export function Balance({ value, currency, className }: { value: string; currency: string; className?: string }) {
  const tone = isZero(value)
    ? "text-slate-600 dark:text-slate-300"
    : isNegative(value)
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-rose-700 dark:text-rose-400";
  return <span className={cx("font-semibold whitespace-nowrap tabular-nums", tone, className)}>{formatMoney(value, currency)}</span>;
}

export function balanceHint(value: string): string {
  if (isZero(value)) return "Fully paid up";
  return isNegative(value) ? "Paid ahead" : "Outstanding";
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight whitespace-nowrap tabular-nums xl:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Avatar({ text, className }: { text: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-200",
        className,
      )}
    >
      {text}
    </span>
  );
}

/** Dialog is a modal overlay. Escape or the backdrop closes it. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    (panel.current?.querySelector<HTMLElement>("input, select, textarea") ?? panel.current?.querySelector<HTMLElement>("button"))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-ghost -mr-2 p-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Toggle({ id, label, checked, onChange, hint }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 rounded border-slate-300 accent-brand-700"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
