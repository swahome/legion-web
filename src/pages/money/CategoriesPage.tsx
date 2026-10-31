import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useGroup } from "../../api/hooks";
import { useCategories, useDepositors, useSaveCategory, useSaveDepositor, type CategoryType } from "../../api/money";
import { useGroupId } from "../../components/AppShell";
import { Badge, EmptyState, ErrorState, InlineError, PageHeader, Spinner, cx } from "../../components/ui";
import { formatMoney } from "../../lib/format";
import { OfficialsOnly } from "./shared";

type Tab = CategoryType | "depositors";

const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: "fine", label: "Fines", hint: "Fines members can be charged, with a default amount." },
  { id: "income", label: "Income", hint: "Kinds of money the group earns, like interest or rent." },
  { id: "expense", label: "Expenses", hint: "What the group spends money on." },
  { id: "depositors", label: "Depositors", hint: "People and organisations outside the group who pay in." },
];

/** CategoriesPage manages fine, income and expense categories and depositors (officials). */
export function CategoriesPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const [tab, setTab] = useState<Tab>("fine");
  if (group.data && !group.data.is_official) return <OfficialsOnly />;
  const current = tabs.find((t) => t.id === tab)!;

  return (
    <>
      <PageHeader title="Categories" subtitle="The lists used when recording money." />
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.id ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-700",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-slate-500">{current.hint}</p>
      {tab === "depositors" ? (
        <DepositorList groupId={groupId} />
      ) : (
        <CategoryList key={tab} groupId={groupId} type={tab} currency={group.data?.currency ?? "KES"} />
      )}
    </>
  );
}

function CategoryList({ groupId, type, currency }: { groupId: number; type: CategoryType; currency: string }) {
  const list = useCategories(groupId, type, true);
  const save = useSaveCategory(groupId, type);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    const ok = await save
      .mutateAsync({ name: name.trim(), ...(type === "fine" && amount && { amount }) })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      setName("");
      setAmount("");
    }
  }

  return (
    <div className="card">
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <label className="min-w-48 flex-1 text-sm">
          <span className="label">New category</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        </label>
        {type === "fine" && (
          <label className="w-36 text-sm">
            <span className="label">Amount</span>
            <input className="input" inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </label>
        )}
        <button className="btn-primary" disabled={!name.trim() || save.isPending}>
          <Plus className="size-4" aria-hidden /> Add
        </button>
        <div className="basis-full empty:hidden">
          <InlineError error={save.error} />
        </div>
      </form>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className={c.is_hidden || !c.is_active ? "text-slate-400" : ""}>
                <span className="font-medium">{c.name}</span>
                {c.amount !== undefined && <span className="ml-2 text-slate-500 tabular-nums">{formatMoney(c.amount, currency)}</span>}
                {c.is_hidden && (
                  <span className="ml-2">
                    <Badge>Hidden</Badge>
                  </span>
                )}
              </span>
              <button className="btn-ghost px-2 py-1 text-xs" disabled={save.isPending} onClick={() => save.mutate({ id: c.id, is_hidden: !c.is_hidden })}>
                {c.is_hidden ? "Show" : "Hide"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DepositorList({ groupId }: { groupId: number }) {
  const list = useDepositors(groupId);
  const save = useSaveDepositor(groupId);
  const [form, setForm] = useState({ name: "", phone: "" });

  async function add(e: FormEvent) {
    e.preventDefault();
    const ok = await save
      .mutateAsync({ name: form.name.trim(), ...(form.phone.trim() && { phone: form.phone.trim() }) })
      .then(() => true)
      .catch(() => false);
    if (ok) setForm({ name: "", phone: "" });
  }

  return (
    <div className="card">
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <label className="min-w-48 flex-1 text-sm">
          <span className="label">New depositor</span>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" />
        </label>
        <label className="w-44 text-sm">
          <span className="label">Phone (optional)</span>
          <input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </label>
        <button className="btn-primary" disabled={!form.name.trim() || save.isPending}>
          <Plus className="size-4" aria-hidden /> Add
        </button>
        <div className="basis-full empty:hidden">
          <InlineError error={save.error} />
        </div>
      </form>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="No depositors yet" />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.data.map((d) => (
            <li key={d.id} className="px-4 py-3 text-sm">
              <span className="font-medium">{d.name}</span>
              {d.phone && <span className="ml-2 text-slate-500">{d.phone}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
