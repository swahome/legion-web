import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Percent, Plus } from "lucide-react";
import { useGroup } from "../../api/hooks";
import { useDebtors, useSaveDebtor, type Debtor, type DebtorInput } from "../../api/lending";
import { useLoans } from "../../api/loans";
import { useGroupBase, useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Stat } from "../../components/ui";
import { formatMoney } from "../../lib/format";
import { tbody, theadRow } from "../admin/widgets";
import { OfficialsOnly } from "../money/shared";

/**
 * DebtorsPage lists the people outside the group it lends to, with what
 * they owe. Officials only.
 */
export function DebtorsPage() {
  const groupId = useGroupId();
  const base = useGroupBase();
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const [showAll, setShowAll] = useState(false);
  const debtors = useDebtors(groupId, showAll, managing);
  const loans = useLoans(groupId, { borrower: "debtors", page: 1 });
  const [adding, setAdding] = useState(false);

  if (!group.data) return <Spinner />;
  if (!managing) return <OfficialsOnly />;
  const currency = group.data.currency;
  const totals = loans.data?.totals;

  return (
    <>
      <PageHeader
        title="Debtors"
        subtitle="People and businesses outside the group that it lends money to."
        actions={
          <>
            <Link to={`${base}/debtor-loan-types`} className="btn-secondary">
              <Percent className="size-4" aria-hidden /> Debtor loan types
            </Link>
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Add a debtor
            </button>
          </>
        }
      />
      {totals && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat label="Loans running" value={totals.loans.toLocaleString()} />
          <Stat label="Lent out" value={formatMoney(totals.lent, currency)} />
          <Stat label="Repaid" value={formatMoney(totals.repaid, currency)} />
          <Stat label="Still owed" value={formatMoney(totals.balance, currency)} />
        </div>
      )}
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand-700" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Show suspended debtors
      </label>
      {debtors.isPending ? (
        <Spinner label="Loading debtors" />
      ) : debtors.isError ? (
        <ErrorState error={debtors.error} onRetry={() => debtors.refetch()} />
      ) : debtors.data.length === 0 ? (
        <div className="card">
          <EmptyState title="No debtors">Add someone the group lends to, then record their loans from their page.</EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Debtor</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 text-right font-medium">Loans</th>
                <th className="px-4 py-3 text-right font-medium">Lent</th>
                <th className="px-4 py-3 text-right font-medium">Owed</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {debtors.data.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <Link to={`${base}/debtors/${d.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                      {d.name}
                    </Link>{" "}
                    {!d.is_active && <Badge>Suspended</Badge>}
                    {d.description && <span className="block text-xs text-slate-500">{d.description}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {d.phone || "—"}
                    {d.email && <span className="block text-xs text-slate-500">{d.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.loans}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(d.lent, currency)}</td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(d.balance, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <DebtorDialog groupId={groupId} onClose={() => setAdding(false)} />}
    </>
  );
}

/** DebtorDialog adds a debtor, or edits one. */
export function DebtorDialog({ groupId, debtor, onClose }: { groupId: number; debtor?: Debtor; onClose: () => void }) {
  const save = useSaveDebtor(groupId, debtor?.id);
  const [form, setForm] = useState<DebtorInput>({
    name: debtor?.name ?? "",
    phone: debtor?.phone ?? "",
    email: debtor?.email ?? "",
    id_number: debtor?.id_number ?? "",
    description: debtor?.description ?? "",
  });
  const set = (k: keyof DebtorInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await save.mutateAsync(form).catch(() => null)) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={debtor ? `Edit ${debtor.name}` : "Add a debtor"}>
      <form onSubmit={submit} className="space-y-4">
        <InlineError error={save.error} />
        <Field label="Name" htmlFor="db-name">
          <input id="db-name" className="input" value={form.name} onChange={(e) => set("name")(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="db-phone">
            <input id="db-phone" className="input" type="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="db-email">
            <input id="db-email" className="input" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
          </Field>
          <Field label="ID or registration number" htmlFor="db-idno">
            <input id="db-idno" className="input" value={form.id_number} onChange={(e) => set("id_number")(e.target.value)} />
          </Field>
          <Field label="About (optional)" htmlFor="db-desc">
            <input id="db-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!form.name.trim() || save.isPending}>
            {save.isPending ? "Saving…" : debtor ? "Save" : "Add debtor"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
