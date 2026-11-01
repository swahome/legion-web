import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Smartphone, XCircle } from "lucide-react";
import { useGroup } from "../../api/hooks";
import {
  paymentStatusLabels,
  usePayment,
  usePayments,
  usePayOptions,
  useStartPayment,
  type Line,
  type OwedItem,
  type Payment,
} from "../../api/payments";
import { useGroupId } from "../../components/AppShell";
import { Badge, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { Pager, formatDateTime, tbody, td, theadRow } from "../admin/widgets";
import { OfficialsOnly, isAmount } from "../money/shared";

const itemKey = (o: OwedItem) => `${o.kind}-${o.contribution_id ?? ""}-${o.fine_category_id ?? ""}-${o.loan_id ?? ""}`;

/** linesFor turns the amounts typed against owed items into payment lines. */
export function linesFor(owed: OwedItem[], amounts: Record<string, string>): Line[] {
  const lines: Line[] = [];
  for (const o of owed) {
    const amount = (amounts[itemKey(o)] ?? "").trim();
    if (!isAmount(amount)) continue;
    const l: Line = { kind: o.kind, amount };
    if (o.contribution_id) l.contribution_id = o.contribution_id;
    if (o.fine_category_id) l.fine_category_id = o.fine_category_id;
    if (o.loan_id) l.loan_id = o.loan_id;
    lines.push(l);
  }
  return lines;
}

/** PayPage lets a member pay the group with MPesa: a prompt arrives on their phone. */
export function PayPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const options = usePayOptions(groupId);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const history = usePayments(groupId, { mine: true, page });
  const currency = options.data?.currency ?? group.data?.currency ?? "KES";

  if (group.data && group.data.my_membership_id == null)
    return <ErrorState error={new Error("Only members of the group can pay into it.")} />;

  return (
    <>
      <PageHeader title="Pay with MPesa" subtitle="Pay your contributions, fines and loans. A prompt comes to your phone; enter your MPesa PIN to finish." />
      {options.isPending ? (
        <Spinner label="Loading" />
      ) : options.isError ? (
        <ErrorState error={options.error} onRetry={() => options.refetch()} />
      ) : !options.data.enabled ? (
        <div className="card p-6 text-sm text-slate-600 dark:text-slate-300">MPesa payments are not switched on yet. Pay the treasurer, who will record it for you.</div>
      ) : !options.data.account ? (
        <div className="card p-6 text-sm text-slate-600 dark:text-slate-300">
          The group has no bank account to pay into yet. Ask an official to add one and mark it as the default account.
        </div>
      ) : paymentId != null ? (
        <PaymentProgress groupId={groupId} id={paymentId} currency={currency} onDone={() => setPaymentId(null)} />
      ) : (
        <PayForm groupId={groupId} currency={currency} owed={options.data.owed} phone={options.data.phone} onStarted={setPaymentId} />
      )}

      <h2 className="mt-10 mb-3 text-lg font-semibold">My payments</h2>
      {history.isPending ? (
        <Spinner label="Loading payments" />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : history.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No payments yet" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <PaymentsTable items={history.data.items} currency={currency} />
          <Pager data={history.data} onPage={setPage} />
        </div>
      )}
    </>
  );
}

function PayForm({
  groupId,
  currency,
  owed,
  phone: myPhone,
  onStarted,
}: {
  groupId: number;
  currency: string;
  owed: OwedItem[];
  phone: string;
  onStarted: (id: number) => void;
}) {
  const start = useStartPayment(groupId);
  const [mode, setMode] = useState<"items" | "amount">(owed.length ? "items" : "amount");
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(owed.map((o) => [itemKey(o), Number(o.owed) > 0 ? Number(o.owed).toFixed(2) : ""])),
  );
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(myPhone);
  const lines = useMemo(() => linesFor(owed, amounts), [owed, amounts]);
  const total = lines.reduce((s, l) => s + Number(l.amount), 0);
  const ready = phone.trim() !== "" && (mode === "items" ? lines.length > 0 : isAmount(amount));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = mode === "items" ? { phone: phone.trim(), lines } : { phone: phone.trim(), amount };
    const p = await start.mutateAsync(body).catch(() => null);
    if (p) onStarted(p.id);
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-5">
      <div className="flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "items"} className={mode === "items" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("items")} disabled={!owed.length}>
          Choose what to pay
        </button>
        <button type="button" role="tab" aria-selected={mode === "amount"} className={mode === "amount" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("amount")}>
          Pay an amount
        </button>
      </div>

      {mode === "items" ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {owed.map((o) => {
            const k = itemKey(o);
            return (
              <div key={k} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-slate-500">
                    {Number(o.owed) > 0 ? `Owed ${formatMoney(o.owed, currency)}` : "Nothing owed"}
                    {o.since ? ` since ${formatDate(o.since)}` : ""}
                  </p>
                </div>
                <input
                  className="input w-36 text-right"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Amount for ${o.name}`}
                  value={amounts[k] ?? ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, [k]: e.target.value.trim() }))}
                />
              </div>
            );
          })}
          <p className="pt-3 text-right text-sm">
            Total <span className="font-semibold tabular-nums">{formatMoney(total.toFixed(2), currency)}</span>
          </p>
        </div>
      ) : (
        <Field label={`Amount (${currency})`} htmlFor="pay-amount" hint="It is spread over what you owe, oldest fines and contributions first; anything left goes to your savings.">
          <input id="pay-amount" className="input" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.trim())} />
        </Field>
      )}

      <Field label="MPesa phone number" htmlFor="pay-phone" hint="The prompt goes to this phone.">
        <input id="pay-phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <InlineError error={start.error} />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={!ready || start.isPending}>
          <Smartphone className="size-4" aria-hidden /> {start.isPending ? "Sending…" : "Send MPesa prompt"}
        </button>
      </div>
    </form>
  );
}

function PaymentProgress({ groupId, id, currency, onDone }: { groupId: number; id: number; currency: string; onDone: () => void }) {
  const p = usePayment(groupId, id);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 90_000);
    return () => clearTimeout(t);
  }, []);
  if (p.isPending) return <Spinner label="Starting payment" />;
  if (p.isError) return <ErrorState error={p.error} onRetry={() => p.refetch()} />;
  const pay = p.data;
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center" aria-live="polite">
      {pay.status === "paid" ? (
        <>
          <CheckCircle2 className="size-10 text-emerald-600" aria-hidden />
          <p className="text-lg font-semibold">Payment received</p>
          <p className="text-sm text-slate-500">
            {formatMoney(pay.amount, currency)} from {pay.phone}
            {pay.receipt ? `, MPesa receipt ${pay.receipt}` : ""}. It is on your statement.
          </p>
        </>
      ) : pay.status === "failed" ? (
        <>
          <XCircle className="size-10 text-rose-600" aria-hidden />
          <p className="text-lg font-semibold">Payment not completed</p>
          <p className="text-sm text-slate-500">{pay.message || "MPesa did not take the payment."}</p>
        </>
      ) : (
        <>
          <Loader2 className="size-10 animate-spin text-brand-600" aria-hidden />
          <p className="text-lg font-semibold">Check your phone</p>
          <p className="text-sm text-slate-500">
            Enter your MPesa PIN on {pay.phone} to pay {formatMoney(pay.amount, currency)}.
            {slow && " It's taking a while. If no prompt came, close this and try again."}
          </p>
        </>
      )}
      <button className="btn-secondary mt-2" onClick={onDone}>
        {pay.status === "paid" || pay.status === "failed" ? "Make another payment" : "Close"}
      </button>
    </div>
  );
}

const statusTone = { paid: "brand", failed: "danger", sent: "warn", pending: "neutral" } as const;

export function PaymentsTable({ items, currency, showMember }: { items: Payment[]; currency: string; showMember?: boolean }) {
  return (
    <table className="w-full min-w-[44rem] text-sm">
      <thead>
        <tr className={theadRow}>
          <th className="px-4 py-3 font-medium">When</th>
          {showMember && <th className="px-4 py-3 font-medium">Member</th>}
          <th className="px-4 py-3 font-medium">For</th>
          <th className="px-4 py-3 font-medium">Phone</th>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody className={tbody}>
        {items.map((p) => (
          <tr key={p.id}>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(p.created_at)}</td>
            {showMember && <td className={td}>{p.member_name || "—"}</td>}
            <td className={td}>
              {p.lines.map((l) => l.name || l.kind).join(", ") || "—"}
              {p.receipt && <span className="block text-xs text-slate-500">Receipt {p.receipt}</span>}
            </td>
            <td className={td}>{p.phone}</td>
            <td className={td}>
              <Badge tone={statusTone[p.status]}>{paymentStatusLabels[p.status]}</Badge>
              {p.status === "failed" && p.message && <span className="block text-xs text-slate-500">{p.message}</span>}
            </td>
            <td className={`${td} text-right font-medium whitespace-nowrap tabular-nums`}>{formatMoney(p.amount, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** GroupPaymentsPage lists every member's MPesa payments, for officials. */
export function GroupPaymentsPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = usePayments(groupId, { status: status || undefined, page });
  if (group.data && !group.data.is_official) return <OfficialsOnly />;
  const currency = group.data?.currency ?? "KES";
  return (
    <>
      <PageHeader title="MPesa payments" subtitle="Payments members started from the web or the app." />
      <div className="mb-4">
        <label className="text-sm">
          <span className="label">Status</span>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {Object.entries(paymentStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <Spinner label="Loading payments" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No payments found" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <PaymentsTable items={list.data.items} currency={currency} showMember />
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
    </>
  );
}
