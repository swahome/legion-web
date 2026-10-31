import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { useGroup } from "../../api/hooks";
import { bankLoanStatusLabels, bankLoanStatusTones, useBankLoans, useRecordBankLoan, type BankLoanInput } from "../../api/lending";
import { methodLabels, useAccounts, type PaymentMethod } from "../../api/money";
import { useGroupBase, useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Stat } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { tbody, theadRow } from "../admin/widgets";
import { isAmount, todayISO } from "../money/shared";

/**
 * BankLoansPage lists money the group borrowed, with what is repaid and
 * still owed. Every member can see it; officials record loans and repayments.
 */
export function BankLoansPage() {
  const groupId = useGroupId();
  const base = useGroupBase();
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const [status, setStatus] = useState<"" | "open" | "paid" | "voided">("");
  const list = useBankLoans(groupId, status);
  const [recording, setRecording] = useState(false);

  if (!group.data) return <Spinner />;
  const currency = group.data.currency;
  const totals = list.data?.totals;

  return (
    <>
      <PageHeader
        title="Bank loans"
        subtitle="Money the group has borrowed from banks and other lenders, and what it still owes."
        actions={
          managing && (
            <button className="btn-primary" onClick={() => setRecording(true)}>
              <Plus className="size-4" aria-hidden /> Record a bank loan
            </button>
          )
        }
      />
      {totals && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat label="Loans" value={totals.loans.toLocaleString()} />
          <Stat label="Received" value={formatMoney(totals.received, currency)} />
          <Stat label="Repaid" value={formatMoney(totals.repaid, currency)} />
          <Stat label="Still owed" value={formatMoney(totals.balance, currency)} />
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Show</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">All loans</option>
            <option value="open">Still owing</option>
            <option value="paid">Paid off</option>
            {managing && <option value="voided">Voided</option>}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <Spinner label="Loading bank loans" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.bank_loans.length === 0 ? (
        <div className="card">
          <EmptyState title="No bank loans">{managing ? "Record a loan the group has taken to track its repayments." : "The group hasn't borrowed any money."}</EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Loan</th>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 text-right font-medium">Received</th>
                <th className="px-4 py-3 text-right font-medium">Payable</th>
                <th className="px-4 py-3 text-right font-medium">Repaid</th>
                <th className="px-4 py-3 text-right font-medium">Owed</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {list.data.bank_loans.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <Link to={`${base}/bank-loans/${b.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                      {b.description}
                    </Link>
                    {b.account && <span className="block text-xs text-slate-500">Into {b.account.name}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(b.starts_on)} to {formatDate(b.ends_on)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(b.amount, currency)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(b.total_payable, currency)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(b.repaid, currency)}</td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(b.balance, currency)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={bankLoanStatusTones[b.status]}>{bankLoanStatusLabels[b.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {recording && <RecordBankLoanDialog groupId={groupId} currency={currency} onClose={() => setRecording(false)} />}
    </>
  );
}

function RecordBankLoanDialog({ groupId, currency, onClose }: { groupId: number; currency: string; onClose: () => void }) {
  const accounts = useAccounts(groupId);
  const record = useRecordBankLoan(groupId);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    total: "",
    older: false,
    balance: "",
    starts: todayISO(),
    ends: "",
    account: "",
    method: "" as PaymentMethod | "",
  });
  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const ready =
    !!form.description.trim() && isAmount(form.amount) && isAmount(form.total) && !!form.ends && !!form.account && (!form.older || isAmount(form.balance));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input: BankLoanInput = {
      description: form.description.trim(),
      amount: form.amount,
      total_payable: form.total,
      starts_on: form.starts,
      ends_on: form.ends,
      account_id: Number(form.account),
      ...(form.older && { balance: form.balance }),
      ...(form.method && { method: form.method }),
    };
    if (await record.mutateAsync(input).catch(() => null)) onClose();
  }

  return (
    <Dialog open onClose={onClose} title="Record a bank loan">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">The money the group received goes into the account you pick. Record repayments on the loan as the group makes them.</p>
        <InlineError error={record.error} />
        <Field label="Lender and purpose" htmlFor="bl-desc">
          <input
            id="bl-desc"
            className="input"
            placeholder="KCB business loan for the plot"
            value={form.description}
            onChange={(e) => set("description")(e.target.value)}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount received (${currency})`} htmlFor="bl-amount">
            <input id="bl-amount" className="input" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => set("amount")(e.target.value.trim())} required />
          </Field>
          <Field label={`Total to repay (${currency})`} htmlFor="bl-total" hint="With the lender's interest and charges.">
            <input id="bl-total" className="input" inputMode="decimal" placeholder="0.00" value={form.total} onChange={(e) => set("total")(e.target.value.trim())} required />
          </Field>
          <Field label="Received on" htmlFor="bl-starts">
            <input id="bl-starts" type="date" className="input" max={todayISO()} value={form.starts} onChange={(e) => set("starts")(e.target.value)} required />
          </Field>
          <Field label="Repaid by" htmlFor="bl-ends">
            <input id="bl-ends" type="date" className="input" min={form.starts} value={form.ends} onChange={(e) => set("ends")(e.target.value)} required />
          </Field>
          <Field label="Paid into" htmlFor="bl-account">
            <select id="bl-account" className="input" value={form.account} onChange={(e) => set("account")(e.target.value)} required>
              <option value="">Choose an account…</option>
              {(accounts.data?.accounts ?? [])
                .filter((a) => !a.is_closed)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Method" htmlFor="bl-method">
            <select id="bl-method" className="input" value={form.method} onChange={(e) => set("method")(e.target.value as PaymentMethod | "")}>
              <option value="">—</option>
              {Object.entries(methodLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-700" checked={form.older} onChange={(e) => set("older")(e.target.checked)} />
          Part of this loan was repaid before it was entered here
        </label>
        {form.older && (
          <Field label={`Still owed today (${currency})`} htmlFor="bl-balance">
            <input id="bl-balance" className="input" inputMode="decimal" placeholder="0.00" value={form.balance} onChange={(e) => set("balance")(e.target.value.trim())} required />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!ready || record.isPending}>
            {record.isPending ? "Recording…" : "Record bank loan"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
