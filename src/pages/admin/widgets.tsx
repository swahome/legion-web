import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Paged } from "../../api/admin";
import { Badge, Dialog, InlineError } from "../../components/ui";

/** useDebounced returns value once it has stopped changing for ms. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input type="search" className="input pl-9" placeholder={label} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Pager<T>({ data, onPage }: { data: Paged<T>; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  const first = data.total === 0 ? 0 : (data.page - 1) * data.page_size + 1;
  const last = Math.min(data.total, data.page * data.page_size);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800">
      <span>
        {first}–{last} of {data.total.toLocaleString()}
      </span>
      <div className="flex gap-1">
        <button className="btn-ghost p-2" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <button className="btn-ghost p-2" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return <th className={`px-4 py-3 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}

export const theadRow = "border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800";
export const tbody = "divide-y divide-slate-100 dark:divide-slate-800";
export const td = "px-4 py-3";

const statusTones = { active: "brand", setup: "neutral", suspended: "warn", closed: "danger" } as const;

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTones[status as keyof typeof statusTones] ?? "neutral"}>{status}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge tone="brand">Active</Badge> : <Badge>Inactive</Badge>;
}

/** Confirm asks before a change that affects other people. */
export function Confirm({
  open,
  title,
  children,
  action,
  danger,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  action: string;
  danger?: boolean;
  pending?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
        {children}
        <InlineError error={error} />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className={danger ? "btn bg-rose-600 text-white hover:bg-rose-700" : "btn-primary"} disabled={pending} onClick={onConfirm}>
            {action}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function formatDateTime(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}
