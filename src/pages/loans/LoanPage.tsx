import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, HandCoins } from "lucide-react";
import { useGroup } from "../../api/hooks";
import {
  borrowerName,
  feeText,
  fineText,
  interestText,
  loanStatusLabels,
  loanStatusTones,
  periodWords,
  useLoan,
  useLoanAction,
  type LoanCharge,
  type LoanDetail,
  type LoanRepayment,
} from "../../api/loans";
import { useAccounts, type PaymentMethod } from "../../api/money";
import { useGroupBase, useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, ErrorState, Field, InlineError, PageHeader, Spinner, Stat, cx } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { Confirm, tbody, theadRow } from "../admin/widgets";
import { AmountDateMethod, isAmount, todayISO } from "../money/shared";

const chargeLabels: Record<string, string> = {
  installment: "Installment",
  late_fine: "Late payment fine",
  balance_fine: "Outstanding balance fine",
  transfer_out: "Moved out",
};

const chargeStatus: Record<string, string> = { paid: "Paid", partly_paid: "Part paid", overdue: "Overdue", due: "Not yet due" };

/** LoanPage is one loan: its terms, schedule, repayments and statement. */
export function LoanPage() {
  const groupId = useGroupId();
  const base = useGroupBase();
  const loanId = Number(useParams().loanId);
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const loan = useLoan(groupId, loanId);
  const act = useLoanAction(groupId, loanId);
  const navigate = useNavigate();
  const [tab, setTab] = useState<"schedule" | "repayments" | "statement">("schedule");
  const [repaying, setRepaying] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: "void" } | { kind: "repayment"; r: LoanRepayment } | { kind: "fine"; c: LoanCharge }>(null);

  if (!group.data || loan.isPending) return <Spinner />;
  if (loan.isError) return <ErrorState error={loan.error} onRetry={() => loan.refetch()} />;
  const l = loan.data;
  const currency = group.data.currency;
  const live = !l.voided_at;

  return (
    <>
      <Link
        to={l.debtor ? `${base}/debtors/${l.debtor.id}` : `${base}/loans`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" aria-hidden /> {l.debtor ? l.debtor.name : "Loans"}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {l.loan_type?.name ?? "Custom loan"} for {borrowerName(l)}
            <Badge tone={loanStatusTones[l.status]}>{loanStatusLabels[l.status]}</Badge>
          </span>
        }
        subtitle={`${formatMoney(l.amount, currency)} paid out ${formatDate(l.disbursed_on)}${l.account ? ` from ${l.account.name}` : ""}. ${interestText(l)}, ${l.installments} ${periodWords[l.frequency]}, ends ${formatDate(l.ends_on)}.`}
        actions={
          managing &&
          live && (
            <button className="btn-primary" onClick={() => setRepaying(true)}>
              <HandCoins className="size-4" aria-hidden /> Record a repayment
            </button>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Stat label="To repay" value={formatMoney(l.totals.payable, currency)} hint={`${formatMoney(l.totals.interest, currency)} interest, ${formatMoney(l.totals.fines, currency)} fines`} />
        <Stat label="Repaid" value={formatMoney(l.totals.paid, currency)} />
        <Stat
          label="Still owed"
          value={formatMoney(l.totals.balance, currency)}
          hint={Number(l.totals.overdue) > 0 ? `${formatMoney(l.totals.overdue, currency)} overdue` : Number(l.totals.overpaid) > 0 ? `${formatMoney(l.totals.overpaid, currency)} overpaid` : undefined}
        />
        <Stat label="Next payment" value={l.next_due ? formatMoney(l.next_due.amount, currency) : "—"} hint={l.next_due ? `due ${formatDate(l.next_due.due_on)}` : undefined} />
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {(["schedule", "repayments", "statement"] as const).map((t) => (
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
            {t === "schedule" ? "Schedule" : t === "repayments" ? `Repayments (${l.repayments.length})` : "Statement"}
          </button>
        ))}
      </div>

      {tab === "schedule" && <Charges l={l} currency={currency} managing={managing && live} onWaive={(c) => setConfirm({ kind: "fine", c })} />}
      {tab === "repayments" && <Repayments l={l} currency={currency} managing={managing && live} onVoid={(r) => setConfirm({ kind: "repayment", r })} />}
      {tab === "statement" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">What</th>
                <th className="px-4 py-3 text-right font-medium">Charged</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {l.statement.map((s, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(s.date)}</td>
                  <td className="px-4 py-2.5">
                    {s.kind === "repayment" ? "Repayment" : (chargeLabels[s.kind] ?? s.kind)}
                    {s.note && <span className="block text-xs text-slate-500">{s.note}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{Number(s.debit) ? formatMoney(s.debit, currency) : ""}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{Number(s.credit) ? formatMoney(s.credit, currency) : ""}</td>
                  <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(s.balance, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="card mt-6 p-5 text-sm">
        <h2 className="mb-3 font-semibold">Terms</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="text-slate-500">Interest</dt>
          <dd>{interestText(l)}</dd>
          <dt className="text-slate-500">Late payment fine</dt>
          <dd>{fineText(l.late_fine, currency)}</dd>
          <dt className="text-slate-500">Outstanding balance fine</dt>
          <dd>{fineText(l.balance_fine, currency)}</dd>
          <dt className="text-slate-500">Processing fee</dt>
          <dd>{feeText(l.processing_fee, currency)}</dd>
          {l.guarantors.length > 0 && (
            <>
              <dt className="text-slate-500">Guarantors</dt>
              <dd>{l.guarantors.map((g) => `${g.member.name}${g.amount ? ` (${formatMoney(g.amount, currency)})` : ""}`).join(", ")}</dd>
            </>
          )}
          {l.description && (
            <>
              <dt className="text-slate-500">Note</dt>
              <dd>{l.description}</dd>
            </>
          )}
        </dl>
        {managing && live && (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <InlineError error={confirm ? null : act.error} />
            <button className="btn-secondary" disabled={act.isPending} onClick={() => act.mutate({ action: "update", is_bad_debt: !l.is_bad_debt })}>
              {l.is_bad_debt ? "No longer a bad debt" : "Mark as bad debt"}
            </button>
            <button className="btn-ghost text-rose-700 dark:text-rose-400" onClick={() => setConfirm({ kind: "void" })}>
              Void loan
            </button>
          </div>
        )}
      </section>

      {repaying && <RepaymentDialog groupId={groupId} l={l} currency={currency} onClose={() => setRepaying(false)} />}
      <Confirm
        open={!!confirm}
        title={confirm?.kind === "void" ? "Void this loan?" : confirm?.kind === "repayment" ? "Void this repayment?" : "Waive this fine?"}
        action={confirm?.kind === "fine" ? "Waive fine" : "Void"}
        danger
        pending={act.isPending}
        error={act.error}
        onClose={() => {
          act.reset();
          setConfirm(null);
        }}
        onConfirm={async () => {
          if (!confirm) return;
          const body =
            confirm.kind === "void"
              ? ({ action: "void" } as const)
              : confirm.kind === "repayment"
                ? ({ action: "void_repayment", id: confirm.r.id } as const)
                : ({ action: "waive_fine", id: confirm.c.id } as const);
          if (await act.mutateAsync(body).then(() => true).catch(() => false)) {
            setConfirm(null);
            if (confirm.kind === "void") navigate(l.debtor ? `${base}/debtors/${l.debtor.id}` : `${base}/loans`);
          }
        }}
      >
        {confirm?.kind === "void" && <p>The loan, its payout from the account, its fee and all its repayments are voided. This can't be undone.</p>}
        {confirm?.kind === "repayment" && (
          <p>
            The {formatMoney(confirm.r.amount, currency)} repayment of {formatDate(confirm.r.paid_on)} and its deposit are voided, and the loan owes it again.
          </p>
        )}
        {confirm?.kind === "fine" && <p>{borrowerName(l)} will no longer owe this {formatMoney(confirm.c.amount, currency)} fine.</p>}
      </Confirm>
    </>
  );
}

function Charges({ l, currency, managing, onWaive }: { l: LoanDetail; currency: string; managing: boolean; onWaive: (c: LoanCharge) => void }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className={theadRow}>
            <th className="px-4 py-3 font-medium">Due</th>
            <th className="px-4 py-3 font-medium">For</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 text-right font-medium">Paid</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {managing && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className={tbody}>
          {l.charges.map((c) => (
            <tr key={c.id} className={c.voided_at ? "text-slate-400" : ""}>
              <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(c.due_on)}</td>
              <td className="px-4 py-2.5">
                {chargeLabels[c.kind] ?? c.kind}
                {c.number != null && ` ${c.number}`}
                {c.kind === "installment" && (
                  <span className="block text-xs text-slate-500">
                    {formatMoney(c.principal, currency)} principal, {formatMoney(c.interest, currency)} interest
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{formatMoney(c.amount, currency)}</td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{formatMoney(c.paid, currency)}</td>
              <td className="px-4 py-2.5">
                <Badge tone={c.status === "overdue" ? "warn" : c.status === "paid" ? "brand" : "neutral"}>{chargeStatus[c.status] ?? c.status}</Badge>
              </td>
              {managing && (
                <td className="px-4 py-2.5 text-right">
                  {(c.kind === "late_fine" || c.kind === "balance_fine") && !c.voided_at && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onWaive(c)}>
                      Waive
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Repayments({ l, currency, managing, onVoid }: { l: LoanDetail; currency: string; managing: boolean; onVoid: (r: LoanRepayment) => void }) {
  if (l.repayments.length === 0) return <div className="card p-6 text-center text-sm text-slate-500">Nothing repaid yet.</div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className={theadRow}>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Into</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            {managing && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className={tbody}>
          {l.repayments.map((r) => (
            <tr key={r.id} className={r.voided_at ? "text-slate-400" : ""}>
              <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.paid_on)}</td>
              <td className="px-4 py-2.5">
                {r.account?.name ?? (r.source === "transfer" ? "Moved from a contribution" : "—")}
                {r.description && <span className="block text-xs text-slate-500">{r.description}</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(r.amount, currency)}</td>
              {managing && (
                <td className="px-4 py-2.5 text-right">
                  {!r.voided_at && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onVoid(r)}>
                      Void
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepaymentDialog({ groupId, l, currency, onClose }: { groupId: number; l: LoanDetail; currency: string; onClose: () => void }) {
  const accounts = useAccounts(groupId);
  const act = useLoanAction(groupId, l.id);
  const [form, setForm] = useState({ amount: l.next_due?.amount ?? "", date: todayISO(), method: "", account: "", description: "" });
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
    <Dialog open onClose={onClose} title={`Repayment from ${borrowerName(l)}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">
          {formatMoney(l.totals.balance, currency)} is owed. A repayment settles the oldest installment or fine first.
        </p>
        <InlineError error={act.error} />
        <AmountDateMethod idPrefix="rp" currency={currency} form={form} set={(k) => set(k)} />
        <Field label="Paid into" htmlFor="rp-account">
          <select id="rp-account" className="input" value={form.account} onChange={(e) => set("account")(e.target.value)} required>
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
        <Field label="Note (optional)" htmlFor="rp-desc">
          <input id="rp-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
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
