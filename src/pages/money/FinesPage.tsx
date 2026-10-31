import { useMemo, useState, type FormEvent } from "react";
import { Gavel } from "lucide-react";
import { useGroup, useMembers } from "../../api/hooks";
import { fineKindLabels, useFineBalances, useFineMembers, useFines, useVoidFine, type Fine, type FineKind } from "../../api/fines";
import { useCategories } from "../../api/money";
import { useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, cx } from "../../components/ui";
import { formatDate, formatMoney, fullName } from "../../lib/format";
import { Confirm, Pager } from "../admin/widgets";
import { AmountDateMethod, isAmount, todayISO } from "./shared";

/**
 * FinesPage lists fines: ones officials charge by hand and the late-payment
 * fines the nightly job raises. Officials fine members and void fines;
 * members see their own.
 */
export function FinesPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const [tab, setTab] = useState<"fines" | "balances">("fines");
  const [kind, setKind] = useState<FineKind | "">("");
  const [showVoided, setShowVoided] = useState(false);
  const [page, setPage] = useState(1);
  const own = group.data && !managing ? (group.data.my_membership_id ?? undefined) : undefined;
  const list = useFines(groupId, { kind: kind || undefined, include_voided: managing && showVoided, page, member_id: own });
  const balances = useFineBalances(groupId);
  const [fining, setFining] = useState(false);
  const [voiding, setVoiding] = useState<Fine | null>(null);
  const voidFine = useVoidFine(groupId);

  if (!group.data) return <Spinner />;
  const currency = group.data.currency;
  const myBalance = !managing ? balances.data?.members[0]?.balance : undefined;

  return (
    <>
      <PageHeader
        title={managing ? "Fines" : "My fines"}
        subtitle={
          managing
            ? "Fines charged to members, by officials and for late contributions."
            : myBalance !== undefined
              ? `You owe ${formatMoney(myBalance, currency)} in fines.`
              : "Fines charged to you."
        }
        actions={
          managing && (
            <button className="btn-primary" onClick={() => setFining(true)}>
              <Gavel className="size-4" aria-hidden /> Fine members
            </button>
          )
        }
      />
      {managing && (
        <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
          {(["fines", "balances"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={cx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                tab === t ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
              onClick={() => setTab(t)}
            >
              {t === "fines" ? "Fines" : "Balances by member"}
            </button>
          ))}
        </div>
      )}

      {tab === "balances" && managing ? (
        balances.isPending ? (
          <Spinner label="Loading balances" />
        ) : balances.isError ? (
          <ErrorState error={balances.error} onRetry={() => balances.refetch()} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 text-right font-medium">Fined</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {balances.data.members.map((b) => (
                  <tr key={b.member.id}>
                    <td className="px-4 py-3 font-medium">{b.member.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(b.fined, currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(b.paid, currency)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(b.balance, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold dark:border-slate-800">
                  <td className="px-4 py-3" colSpan={3}>
                    Total owed
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(balances.data.total_owed, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="label">Type</span>
              <select
                className="input"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as FineKind | "");
                  setPage(1);
                }}
              >
                <option value="">All fines</option>
                {Object.entries(fineKindLabels).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {managing && (
              <label className="flex items-center gap-2 pb-2.5 text-sm">
                <input type="checkbox" className="size-4 accent-brand-700" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
                Show voided
              </label>
            )}
          </div>
          {list.isPending ? (
            <Spinner label="Loading fines" />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <div className="card overflow-x-auto">
              {list.data.items.length === 0 ? (
                <EmptyState title="No fines" />
              ) : (
                <>
                  <table className={`w-full text-sm ${managing ? "min-w-[44rem]" : ""}`}>
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
                        <th className="px-3 py-3 sm:px-4 font-medium">Date</th>
                        {managing && <th className="px-3 py-3 sm:px-4 font-medium">Member</th>}
                        <th className="px-3 py-3 sm:px-4 font-medium">For</th>
                        <th className="px-3 py-3 sm:px-4 text-right font-medium">Amount</th>
                        {managing && <th className="px-3 py-3 sm:px-4" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {list.data.items.map((f) => (
                        <tr key={f.id} className={f.voided_at ? "text-slate-400" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}>
                          <td className="px-3 py-3 sm:px-4 whitespace-nowrap">{formatDate(f.date)}</td>
                          {managing && <td className="px-3 py-3 sm:px-4">{f.member?.name ?? "—"}</td>}
                          <td className="px-3 py-3 sm:px-4">
                            <span className="font-medium">{fineFor(f)}</span>
                            <span className="block text-xs text-slate-500">{fineDetail(f)}</span>
                          </td>
                          <td className="px-3 py-3 sm:px-4 text-right font-medium whitespace-nowrap tabular-nums">
                            {f.voided_at ? <s>{formatMoney(f.amount, currency)}</s> : formatMoney(f.amount, currency)}
                          </td>
                          {managing && (
                            <td className="px-4 py-3 text-right">
                              {f.voided_at ? (
                                <Badge tone="danger">Voided</Badge>
                              ) : (
                                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setVoiding(f)}>
                                  Void
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pager data={list.data} onPage={setPage} />
                </>
              )}
            </div>
          )}
        </>
      )}

      {fining && <FineMembersDialog groupId={groupId} currency={currency} onClose={() => setFining(false)} />}
      <Confirm
        open={!!voiding}
        title="Void this fine?"
        action="Void fine"
        danger
        pending={voidFine.isPending}
        error={voidFine.error}
        onClose={() => {
          voidFine.reset();
          setVoiding(null);
        }}
        onConfirm={async () => {
          if (voiding && (await voidFine.mutateAsync(voiding.id).then(() => true).catch(() => false))) setVoiding(null);
        }}
      >
        {voiding && (
          <p>
            {voiding.member?.name} will no longer owe this {formatMoney(voiding.amount, currency)} fine. This can't be undone.
          </p>
        )}
      </Confirm>
    </>
  );
}

export function fineFor(f: Fine): string {
  if (f.kind === "contribution_fine") return `Late payment: ${f.contribution?.name ?? "contribution"}`;
  return f.fine_category?.name ?? "Fine";
}

export function fineDetail(f: Fine): string {
  const parts: string[] = [];
  if (f.invoice_due_date) parts.push(`invoice due ${formatDate(f.invoice_due_date)}`);
  if (f.automatic) parts.push("charged automatically");
  if (f.kind === "fine" && f.description) parts.push(f.description);
  return parts.join(" · ");
}

export function FineMembersDialog({ groupId, currency, onClose }: { groupId: number; currency: string; onClose: () => void }) {
  const fine = useFineMembers(groupId);
  const members = useMembers(groupId, "active");
  const categories = useCategories(groupId, "fine");
  const [form, setForm] = useState({ category: "", amount: "", date: todayISO(), description: "" });
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const shown = useMemo(
    () => (members.data ?? []).filter((m) => fullName(m).toLowerCase().includes(filter.trim().toLowerCase())),
    [members.data, filter],
  );
  const ready = !!form.category && isAmount(form.amount) && picked.size > 0;

  function pickCategory(id: string) {
    set("category")(id);
    const c = categories.data?.find((x) => String(x.id) === id);
    if (c?.amount && Number(c.amount) > 0 && !form.amount) set("amount")(c.amount);
  }

  function toggle(id: number) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await fine
      .mutateAsync({
        member_ids: [...picked],
        fine_category_id: Number(form.category),
        amount: form.amount,
        date: form.date,
        ...(form.description.trim() && { description: form.description.trim() }),
      })
      .catch(() => null);
    if (ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title="Fine members">
      {categories.data && categories.data.length === 0 ? (
        <EmptyState title="No fine categories">Add a fine category (lateness, absence…) under Categories first.</EmptyState>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <InlineError error={fine.error} />
          <Field label="Fine for" htmlFor="fm-category">
            <select id="fm-category" className="input" value={form.category} onChange={(e) => pickCategory(e.target.value)} required>
              <option value="">Choose a fine category…</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <AmountDateMethod idPrefix="fm" currency={currency} form={form} set={(k) => set(k as "amount" | "date")} method={false} />
          <fieldset>
            <legend className="label">
              Members ({picked.size} chosen)
              <button
                type="button"
                className="ml-3 text-xs font-medium text-brand-700 hover:underline"
                onClick={() => setPicked(picked.size === shown.length ? new Set() : new Set(shown.map((m) => m.id)))}
              >
                {picked.size === shown.length && shown.length > 0 ? "Clear" : "Choose all"}
              </button>
            </legend>
            <input className="input mb-2" placeholder="Search members" aria-label="Search members" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
              {shown.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" className="size-4 accent-brand-700" checked={picked.has(m.id)} onChange={() => toggle(m.id)} />
                  {fullName(m)}
                </label>
              ))}
              {shown.length === 0 && <p className="px-2 py-1 text-sm text-slate-500">No members match.</p>}
            </div>
          </fieldset>
          <Field label="Note (optional)" htmlFor="fm-desc">
            <input id="fm-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!ready || fine.isPending}>
              {fine.isPending ? "Fining…" : picked.size > 1 ? `Fine ${picked.size} members` : "Fine member"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
