import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import { useGroup, useMembers } from "../../api/hooks";
import {
  borrowerName,
  interestText,
  interestTypeLabels,
  loanStatusLabels,
  loanStatusTones,
  periodWords,
  ratePerLabels,
  useLoanTypes,
  useLoans,
  usePreviewLoan,
  useRecordLoan,
  type Frequency,
  type GuarantorInput,
  type InterestType,
  type LoanParams,
  type NewLoanInput,
  type PreviewInput,
  type RatePer,
} from "../../api/loans";
import { methodLabels, useAccounts, type PaymentMethod } from "../../api/money";
import type { NamedRef } from "../../api/money";
import type { Member } from "../../api/types";
import { useGroupBase, useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Stat } from "../../components/ui";
import { formatDate, formatMoney, fullName } from "../../lib/format";
import { Pager, tbody, theadRow } from "../admin/widgets";
import { isAmount, todayISO } from "../money/shared";
import { ScheduleTable } from "./ScheduleTable";

/**
 * LoansPage lists loans with what is paid and owed. Officials see the
 * group's and record loans already paid out; members see their own.
 */
export function LoansPage() {
  const groupId = useGroupId();
  const base = useGroupBase();
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const [status, setStatus] = useState<LoanParams["status"]>("");
  const [page, setPage] = useState(1);
  const own = group.data && !managing ? (group.data.my_membership_id ?? undefined) : undefined;
  const list = useLoans(groupId, { status, page, member_id: own });
  const [recording, setRecording] = useState(false);

  if (!group.data) return <Spinner />;
  const currency = group.data.currency;
  const totals = list.data?.totals;

  return (
    <>
      <PageHeader
        title={managing ? "Loans" : "My loans"}
        subtitle={managing ? "Loans paid out to members, with what is repaid and still owed." : "Your loans, what you've repaid and what you still owe."}
        actions={
          managing && (
            <button className="btn-primary" onClick={() => setRecording(true)}>
              <Plus className="size-4" aria-hidden /> Record a loan
            </button>
          )
        }
      />
      {totals && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat label="Loans running" value={totals.loans.toLocaleString()} />
          <Stat label="Lent out" value={formatMoney(totals.lent, currency)} />
          <Stat label="Repaid" value={formatMoney(totals.repaid, currency)} />
          <Stat label="Still owed" value={formatMoney(totals.balance, currency)} hint="Installments and fines, less repayments" />
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Show</span>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as LoanParams["status"]);
              setPage(1);
            }}
          >
            <option value="">All loans</option>
            <option value="open">Still owing</option>
            <option value="paid">Paid off</option>
            {managing && <option value="voided">Voided</option>}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <Spinner label="Loading loans" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.loans.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No loans">{managing ? "Loans you record, or applications you pay out, show here." : "You have no loans with the group."}</EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Paid out</th>
                {managing && <th className="px-4 py-3 font-medium">Member</th>}
                <th className="px-4 py-3 font-medium">Loan</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Repaid</th>
                <th className="px-4 py-3 text-right font-medium">Owed</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {list.data.loans.items.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`${base}/loans/${l.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                      {formatDate(l.disbursed_on)}
                    </Link>
                  </td>
                  {managing && <td className="px-4 py-3">{borrowerName(l)}</td>}
                  <td className="px-4 py-3">
                    <span className="font-medium">{l.loan_type?.name ?? "Custom loan"}</span>
                    <span className="block text-xs text-slate-500">
                      {interestText({ interest_type: l.interest_type, interest_rate: l.interest_rate, rate_per: l.rate_per })} · {l.installments}{" "}
                      {periodWords[l.frequency]} · ends {formatDate(l.ends_on)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(l.amount, currency)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(l.paid, currency)}</td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(l.balance, currency)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={loanStatusTones[l.status]}>{loanStatusLabels[l.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={list.data.loans} onPage={setPage} />
        </div>
      )}
      {recording && <RecordLoanDialog groupId={groupId} currency={currency} onClose={() => setRecording(false)} />}
    </>
  );
}

/** RecordLoanDialog records a loan paid out to a member, or to a debtor when one is given. */
export function RecordLoanDialog({ groupId, currency, debtor, onClose }: { groupId: number; currency: string; debtor?: NamedRef; onClose: () => void }) {
  const types = useLoanTypes(groupId, true, !!debtor);
  const members = useMembers(groupId, "active");
  const accounts = useAccounts(groupId);
  const record = useRecordLoan(groupId);
  const [form, setForm] = useState({
    member: "",
    type: "",
    amount: "",
    date: todayISO(),
    installments: "",
    account: "",
    method: "" as PaymentMethod | "",
    description: "",
    interest_type: "fixed_balance" as InterestType,
    interest_rate: "",
    rate_per: "month" as RatePer,
    frequency: "monthly" as Frequency,
    skipFee: false,
  });
  const [guarantors, setGuarantors] = useState<GuarantorInput[]>([]);
  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const type = types.data?.find((t) => String(t.id) === form.type);
  const custom = form.type === "custom";
  const installments = Number(form.installments) || type?.fixed_term || 0;
  const terms: Partial<PreviewInput> = custom
    ? { interest_type: form.interest_type, interest_rate: Number(form.interest_rate) || 0, rate_per: form.rate_per, frequency: form.frequency }
    : { loan_type_id: type?.id };
  const borrower = debtor ? { debtor_id: debtor.id } : { member_id: Number(form.member) };
  const ready = (!!debtor || !!form.member) && (custom || !!type) && isAmount(form.amount) && installments > 0;
  const preview = usePreviewLoan(groupId, ready ? { ...terms, ...borrower, amount: form.amount, installments, disbursed_on: form.date } : null);
  const openAccounts = (accounts.data?.accounts ?? []).filter((a) => !a.is_closed);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input: NewLoanInput = {
      ...borrower,
      account_id: Number(form.account),
      amount: form.amount,
      disbursed_on: form.date,
      installments,
      ...(form.method && { method: form.method }),
      ...(form.description.trim() && { description: form.description.trim() }),
      ...(guarantors.length > 0 && { guarantors: guarantors.filter((g) => g.member_id) }),
      ...(form.skipFee && { skip_processing_fee: true }),
      ...(custom
        ? { interest_type: form.interest_type, interest_rate: Number(form.interest_rate) || 0, rate_per: form.rate_per, frequency: form.frequency, grace_periods: 1 }
        : { loan_type_id: Number(form.type) }),
    };
    if (await record.mutateAsync(input).catch(() => null)) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={debtor ? `Lend to ${debtor.name}` : "Record a loan"}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">
          For a loan already paid out. It records the money leaving the account, the repayment schedule and any processing fee.
          {!debtor && " Members can also apply under Loan applications."}
        </p>
        <InlineError error={record.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          {!debtor && (
            <Field label="Member" htmlFor="ln-member">
              <select id="ln-member" className="input" value={form.member} onChange={(e) => set("member")(e.target.value)} required>
                <option value="">Choose a member…</option>
                {members.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {fullName(m)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Loan type" htmlFor="ln-type">
            <select id="ln-type" className="input" value={form.type} onChange={(e) => set("type")(e.target.value)} required>
              <option value="">Choose a loan type…</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_hidden ? " (hidden)" : ""}
                </option>
              ))}
              <option value="custom">Custom terms</option>
            </select>
          </Field>
        </div>
        {custom && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Interest" htmlFor="ln-itype">
              <select id="ln-itype" className="input" value={form.interest_type} onChange={(e) => set("interest_type")(e.target.value as InterestType)}>
                {(["fixed_balance", "reducing_balance"] as const).map((k) => (
                  <option key={k} value={k}>
                    {interestTypeLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Rate (%)" htmlFor="ln-rate">
                <input id="ln-rate" className="input" inputMode="decimal" value={form.interest_rate} onChange={(e) => set("interest_rate")(e.target.value)} required />
              </Field>
              <Field label="Per" htmlFor="ln-per">
                <select id="ln-per" className="input" value={form.rate_per} onChange={(e) => set("rate_per")(e.target.value as RatePer)}>
                  {Object.entries(ratePerLabels).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Repaid" htmlFor="ln-freq">
              <select id="ln-freq" className="input" value={form.frequency} onChange={(e) => set("frequency")(e.target.value as Frequency)}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Amount (${currency})`} htmlFor="ln-amount">
            <input id="ln-amount" className="input" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => set("amount")(e.target.value.trim())} required />
          </Field>
          <Field label="Paid out on" htmlFor="ln-date">
            <input id="ln-date" type="date" className="input" max={todayISO()} value={form.date} onChange={(e) => set("date")(e.target.value)} required />
          </Field>
          <Field label={`Installments${type?.fixed_term ? " (fixed)" : ""}`} htmlFor="ln-inst">
            <input
              id="ln-inst"
              className="input"
              inputMode="numeric"
              value={type?.fixed_term ? String(type.fixed_term) : form.installments}
              disabled={!!type?.fixed_term}
              onChange={(e) => set("installments")(e.target.value.replace(/\D/g, ""))}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid from" htmlFor="ln-account">
            <select id="ln-account" className="input" value={form.account} onChange={(e) => set("account")(e.target.value)} required>
              <option value="">Choose an account…</option>
              {openAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Method" htmlFor="ln-method">
            <select id="ln-method" className="input" value={form.method} onChange={(e) => set("method")(e.target.value as PaymentMethod | "")}>
              <option value="">—</option>
              {Object.entries(methodLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <GuarantorRows members={members.data ?? []} exclude={debtor ? 0 : Number(form.member)} rows={guarantors} onChange={setGuarantors} currency={currency} />
        <Field label="Note (optional)" htmlFor="ln-desc">
          <input id="ln-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
        </Field>
        {type?.processing_fee && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand-700" checked={form.skipFee} onChange={(e) => set("skipFee")(e.target.checked)} />
            Don't charge the processing fee
          </label>
        )}
        {ready && (preview.isError ? <InlineError error={preview.error} /> : preview.data && <ScheduleTable schedule={preview.data} currency={currency} compact />)}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!ready || !form.account || record.isPending}>
            {record.isPending ? "Recording…" : "Record loan"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** GuarantorRows edits a list of guarantors with optional amounts. */
export function GuarantorRows({
  members,
  exclude,
  rows,
  onChange,
  currency,
}: {
  members: Member[];
  exclude: number;
  rows: GuarantorInput[];
  onChange: (rows: GuarantorInput[]) => void;
  currency: string;
}) {
  const update = (i: number, patch: Partial<GuarantorInput>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <fieldset className="space-y-2">
      <legend className="label">Guarantors</legend>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_8rem_auto] gap-2">
          <select
            className="input"
            aria-label={`Guarantor ${i + 1}`}
            value={r.member_id || ""}
            onChange={(e) => update(i, { member_id: Number(e.target.value) })}
            required
          >
            <option value="">Choose a member…</option>
            {members
              .filter((m) => m.id !== exclude)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {fullName(m)}
                </option>
              ))}
          </select>
          <input
            className="input"
            aria-label={`Amount guaranteed by guarantor ${i + 1} (${currency})`}
            placeholder="Amount"
            inputMode="decimal"
            value={r.amount ?? ""}
            onChange={(e) => update(i, { amount: e.target.value.trim() || undefined })}
          />
          <button type="button" className="btn-ghost p-2" aria-label={`Remove guarantor ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <button type="button" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => onChange([...rows, { member_id: 0 }])}>
        + Add a guarantor
      </button>
    </fieldset>
  );
}
