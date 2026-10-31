import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, HandCoins, Pencil } from "lucide-react";
import { useGroup } from "../../api/hooks";
import { bankLoanStatusLabels, bankLoanStatusTones, useBankLoan, useBankLoanAction, type BankLoan, type BankLoanRepayment } from "../../api/lending";
import { methodLabels, useAccounts, type PaymentMethod } from "../../api/money";
import { useGroupBase, useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Stat } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { Confirm, tbody, theadRow } from "../admin/widgets";
import { AmountDateMethod, isAmount, todayISO } from "../money/shared";

/** BankLoanPage is one loan the group took, with its repayments. */
export function BankLoanPage() {
  const groupId = useGroupId();
  const base = useGroupBase();
  const id = Number(useParams().bankLoanId);
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const loan = useBankLoan(groupId, id);
  const act = useBankLoanAction(groupId, id);
  const [dialog, setDialog] = useState<"repay" | "edit" | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "void" } | { kind: "repayment"; r: BankLoanRepayment }>(null);

  if (!group.data || loan.isPending) return <Spinner />;
  if (loan.isError) return <ErrorState error={loan.error} onRetry={() => loan.refetch()} />;
  const { bank_loan: b, repayments } = loan.data;
  const currency = group.data.currency;
  const live = !b.voided_at;

  return (
    <>
      <Link to={`${base}/bank-loans`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Bank loans
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {b.description}
            <Badge tone={bankLoanStatusTones[b.status]}>{bankLoanStatusLabels[b.status]}</Badge>
          </span>
        }
        subtitle={`${formatMoney(b.amount, currency)} received ${formatDate(b.starts_on)}${b.account ? ` into ${b.account.name}` : ""}, to be repaid by ${formatDate(b.ends_on)}.`}
        actions={
          managing &&
          live && (
            <>
              <button className="btn-secondary" onClick={() => setDialog("edit")}>
                <Pencil className="size-4" aria-hidden /> Edit
              </button>
              <button className="btn-ghost text-rose-700 dark:text-rose-400" onClick={() => setConfirm({ kind: "void" })}>
                Void
              </button>
              {b.status === "active" && (
                <button className="btn-primary" onClick={() => setDialog("repay")}>
                  <HandCoins className="size-4" aria-hidden /> Record a repayment
                </button>
              )}
            </>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Stat label="Total to repay" value={formatMoney(b.total_payable, currency)} />
        <Stat
          label="Owed when entered"
          value={formatMoney(b.opening_balance, currency)}
          hint={b.opening_balance !== b.total_payable ? "Part was repaid before this loan was entered" : undefined}
        />
        <Stat label="Repaid here" value={formatMoney(b.repaid, currency)} />
        <Stat label="Still owed" value={formatMoney(b.balance, currency)} />
      </div>
      <section className="card overflow-x-auto">
        <h2 className="px-4 pt-4 text-base font-semibold">Repayments</h2>
        {repayments.length === 0 ? (
          <EmptyState title="No repayments yet">Repayments come out of the account you pick and reduce what is owed.</EmptyState>
        ) : (
          <table className="mt-2 w-full min-w-[36rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Paid on</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                {managing && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className={tbody}>
              {repayments.map((r) => (
                <tr key={r.id} className={r.voided_at ? "text-slate-400 line-through" : ""}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.paid_on)}</td>
                  <td className="px-4 py-3">
                    {r.account?.name ?? "—"}
                    {r.method && <span className="block text-xs text-slate-500">{methodLabels[r.method]}</span>}
                  </td>
                  <td className="px-4 py-3">{r.description}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(r.amount, currency)}</td>
                  {managing && (
                    <td className="px-4 py-3 text-right">
                      {live && !r.voided_at && (
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setConfirm({ kind: "repayment", r })}>
                          Void
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {dialog === "repay" && <RepaymentDialog groupId={groupId} b={b} currency={currency} onClose={() => setDialog(null)} />}
      {dialog === "edit" && <EditDialog groupId={groupId} b={b} currency={currency} onClose={() => setDialog(null)} />}
      <Confirm
        open={!!confirm}
        title={confirm?.kind === "void" ? "Void this bank loan?" : "Void this repayment?"}
        action="Void"
        danger
        pending={act.isPending}
        error={act.error}
        onClose={() => {
          act.reset();
          setConfirm(null);
        }}
        onConfirm={async () => {
          if (!confirm) return;
          const body = confirm.kind === "void" ? ({ action: "void" } as const) : ({ action: "void_repayment", id: confirm.r.id } as const);
          if (await act.mutateAsync(body).then(() => true).catch(() => false)) setConfirm(null);
        }}
      >
        {confirm?.kind === "void" && <p>The loan, the money it brought into the account and all its repayments are voided. This can't be undone.</p>}
        {confirm?.kind === "repayment" && (
          <p>
            The {formatMoney(confirm.r.amount, currency)} repayment of {formatDate(confirm.r.paid_on)} is voided: the money is back in the account and owed again.
          </p>
        )}
      </Confirm>
    </>
  );
}

function RepaymentDialog({ groupId, b, currency, onClose }: { groupId: number; b: BankLoan; currency: string; onClose: () => void }) {
  const accounts = useAccounts(groupId);
  const act = useBankLoanAction(groupId, b.id);
  const [form, setForm] = useState({ amount: "", date: todayISO(), method: "", account: b.account ? String(b.account.id) : "", description: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await act
      .mutateAsync({
        action: "repay",
        account_id: Number(form.account),
        amount: form.amount,
        paid_on: form.date,
        ...(form.method && { method: form.method as PaymentMethod }),
        ...(form.description.trim() && { description: form.description.trim() }),
      })
      .catch(() => null);
    if (ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title="Repayment to the lender">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">{formatMoney(b.balance, currency)} is still owed on this loan.</p>
        <InlineError error={act.error} />
        <AmountDateMethod idPrefix="br" currency={currency} form={form} set={(k) => set(k)} />
        <Field label="Paid from" htmlFor="br-account">
          <select id="br-account" className="input" value={form.account} onChange={(e) => set("account")(e.target.value)} required>
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
        <Field label="Note (optional)" htmlFor="br-desc">
          <input id="br-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!isAmount(form.amount) || !form.account || act.isPending}>
            {act.isPending ? "Recording…" : "Record repayment"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function EditDialog({ groupId, b, currency, onClose }: { groupId: number; b: BankLoan; currency: string; onClose: () => void }) {
  const act = useBankLoanAction(groupId, b.id);
  const [form, setForm] = useState({ description: b.description, total: b.total_payable, balance: b.opening_balance, ends: b.ends_on });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await act
      .mutateAsync({ action: "update", description: form.description.trim(), total_payable: form.total, balance: form.balance, ends_on: form.ends })
      .catch(() => null);
    if (ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title="Edit bank loan">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">To change the amount received, its date or account, void the loan and record it again.</p>
        <InlineError error={act.error} />
        <Field label="Lender and purpose" htmlFor="be-desc">
          <input id="be-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Total to repay (${currency})`} htmlFor="be-total">
            <input id="be-total" className="input" inputMode="decimal" value={form.total} onChange={(e) => set("total")(e.target.value.trim())} required />
          </Field>
          <Field label={`Owed when entered (${currency})`} htmlFor="be-balance">
            <input id="be-balance" className="input" inputMode="decimal" value={form.balance} onChange={(e) => set("balance")(e.target.value.trim())} required />
          </Field>
          <Field label="Repaid by" htmlFor="be-ends">
            <input id="be-ends" type="date" className="input" min={b.starts_on} value={form.ends} onChange={(e) => set("ends")(e.target.value)} required />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!form.description.trim() || !isAmount(form.total) || !isAmount(form.balance) || !form.ends || act.isPending}
          >
            {act.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
