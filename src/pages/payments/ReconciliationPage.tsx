import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { useContributions, useGroup, useMembers } from "../../api/hooks";
import { useLoans } from "../../api/loans";
import { useCategories, useDepositors, useDeposits, useWithdrawals } from "../../api/money";
import {
  alertStatusLabels,
  lineKindLabels,
  moneyInKinds,
  moneyOutKinds,
  sourceLabels,
  useAlert,
  useAlertAction,
  useAlerts,
  useAlertSummary,
  useReconcileSettings,
  useUpdateReconcileSettings,
  type Alert,
  type AlertDetail,
  type AlertParams,
  type AlertRecord,
  type AlertStatus,
  type Line,
  type LineKind,
} from "../../api/payments";
import { useGroupId } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Stat, Toggle } from "../../components/ui";
import { formatDate, formatMoney, fullName } from "../../lib/format";
import { Pager, formatDateTime, tbody, td, theadRow } from "../admin/widgets";
import { OfficialsOnly, isAmount } from "../money/shared";

/** ReconciliationPage: bank and MPesa transactions on the group's accounts, and what they were for. */
export function ReconciliationPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const [params, setParams] = useState<AlertParams>({ status: "unreconciled", direction: "", page: 1 });
  const list = useAlerts(groupId, params);
  const summary = useAlertSummary(groupId);
  const [open, setOpen] = useState<number | null>(null);
  const set = (p: Partial<AlertParams>) => setParams((x) => ({ ...x, ...p, page: p.page ?? 1 }));

  if (group.data && !group.data.is_official) return <OfficialsOnly />;
  const currency = group.data?.currency ?? "KES";

  return (
    <>
      <PageHeader title="Reconciliation" subtitle="Money the bank and MPesa reported on the group's accounts. Say what each transaction was for and it goes into the books." />
      {summary.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Stat label="Money in to reconcile" value={formatMoney(summary.data.in.amount, currency)} hint={`${summary.data.in.count} transactions`} />
          <Stat label="Money out to reconcile" value={formatMoney(summary.data.out.amount, currency)} hint={`${summary.data.out.count} transactions`} />
        </div>
      )}
      <SettingsCard groupId={groupId} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Status</span>
          <select className="input" value={params.status} onChange={(e) => set({ status: e.target.value as AlertStatus | "" })}>
            <option value="">All</option>
            {Object.entries(alertStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Direction</span>
          <select className="input" value={params.direction} onChange={(e) => set({ direction: e.target.value as "in" | "out" | "" })}>
            <option value="">Money in and out</option>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </select>
        </label>
      </div>

      {list.isPending ? (
        <Spinner label="Loading transactions" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title={params.status === "unreconciled" ? "Nothing to reconcile" : "No transactions found"}>
            Transactions appear here when the bank or MPesa reports them.
          </EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <AlertsTable items={list.data.items} currency={currency} onOpen={setOpen} />
          <Pager data={list.data} onPage={(page) => set({ page })} />
        </div>
      )}
      {open != null && <AlertDialog groupId={groupId} id={open} currency={currency} onClose={() => setOpen(null)} />}
    </>
  );
}

function SettingsCard({ groupId }: { groupId: number }) {
  const s = useReconcileSettings(groupId);
  const update = useUpdateReconcileSettings(groupId);
  if (!s.data) return null;
  return (
    <div className="card mb-6 space-y-3 p-5">
      <Toggle
        id="auto-payments"
        label="Record members' MPesa payments automatically"
        hint="A payment a member starts here or in the app goes straight to what they chose to pay."
        checked={s.data.auto_reconcile_payments}
        onChange={(v) => update.mutate({ auto_reconcile_payments: v })}
      />
      <Toggle
        id="auto-bank"
        label="Reconcile bank deposits automatically"
        hint="When the bank's narration names a member (by phone or name), the money goes to what they owe, oldest first."
        checked={s.data.auto_reconcile_bank_alerts}
        onChange={(v) => update.mutate({ auto_reconcile_bank_alerts: v })}
      />
      <InlineError error={update.error} />
    </div>
  );
}

const statusTone = { unreconciled: "warn", reconciled: "brand", ignored: "neutral" } as const;

export function AlertsTable({ items, currency, onOpen, showGroup }: { items: Alert[]; currency: string; onOpen?: (id: number) => void; showGroup?: boolean }) {
  return (
    <table className="w-full min-w-[48rem] text-sm">
      <thead>
        <tr className={theadRow}>
          <th className="px-4 py-3 font-medium">When</th>
          {showGroup && <th className="px-4 py-3 font-medium">Group</th>}
          <th className="px-4 py-3 font-medium">Details</th>
          <th className="px-4 py-3 font-medium">Account</th>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody className={tbody}>
        {items.map((a) => (
          <tr key={a.id} className={onOpen ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" : undefined} onClick={onOpen && (() => onOpen(a.id))}>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(a.transaction_at)}</td>
            {showGroup && <td className={td}>{a.group?.name ?? <Badge tone="warn">No group</Badge>}</td>}
            <td className={td}>
              {onOpen ? (
                <button className="text-left font-medium hover:underline" onClick={() => onOpen(a.id)}>
                  {a.particulars || a.payer_name || a.reference || a.provider_ref}
                </button>
              ) : (
                <span className="font-medium">{a.particulars || a.payer_name || a.reference || a.provider_ref}</span>
              )}
              <span className="block text-xs text-slate-500">
                {[sourceLabels[a.source] ?? a.source, a.provider_ref, a.payer_name, a.phone].filter(Boolean).join(" · ")}
              </span>
            </td>
            <td className={td}>{a.account?.name ?? a.account_number}</td>
            <td className={td}>
              <Badge tone={statusTone[a.status]}>{alertStatusLabels[a.status]}</Badge>
              {a.auto_reconciled && <span className="block text-xs text-slate-500">Automatic</span>}
            </td>
            <td className={`${td} text-right font-medium whitespace-nowrap tabular-nums`}>
              <span className={a.direction === "in" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                {a.direction === "in" ? <ArrowDownLeft className="mr-1 inline size-3.5" aria-label="In" /> : <ArrowUpRight className="mr-1 inline size-3.5" aria-label="Out" />}
                {formatMoney(a.amount, a.currency || currency)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AlertFacts({ a, currency }: { a: AlertDetail; currency: string }) {
  const rows: [string, string][] = [
    ["Amount", `${a.direction === "in" ? "Money in" : "Money out"}: ${formatMoney(a.amount, a.currency || currency)}`],
    ["When", formatDateTime(a.transaction_at)],
    ["From", sourceLabels[a.source] ?? a.source],
    ["Transaction", a.provider_ref],
    ["Account", a.account ? `${a.account.name} (${a.account_number})` : a.account_number],
  ];
  if (a.reference) rows.push(["Reference", a.reference]);
  if (a.particulars) rows.push(["Narration", a.particulars]);
  if (a.payer_name || a.phone) rows.push(["Payer", [a.payer_name, a.phone].filter(Boolean).join(", ")]);
  if (a.status !== "unreconciled")
    rows.push(["Reconciled", [a.auto_reconciled ? "Automatically" : a.reconciled_by, a.reconciled_at && formatDateTime(a.reconciled_at)].filter(Boolean).join(", ")]);
  if (a.note) rows.push(["Note", a.note]);
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordsList({ records, currency }: { records: AlertRecord[]; currency: string }) {
  if (!records.length) return null;
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
      {records.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0">
            <span className="font-medium">{[r.item_name || lineKindLabels[r.kind as LineKind] || r.kind, r.member_name].filter(Boolean).join(" · ")}</span>
            <span className="block text-xs text-slate-500">
              {formatDate(r.date)} · {r.from_alert ? "Recorded from this transaction" : "Matched"}
            </span>
          </span>
          <span className="font-medium tabular-nums">{formatMoney(r.amount, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

function AlertDialog({ groupId, id, currency, onClose }: { groupId: number; id: number; currency: string; onClose: () => void }) {
  const alert = useAlert(groupId, id);
  const [tab, setTab] = useState<"record" | "match" | "dismiss">("record");
  const undo = useAlertAction(groupId, id, "undo");
  const a = alert.data;
  return (
    <Dialog open onClose={onClose} title="Transaction">
      {alert.isPending ? (
        <Spinner />
      ) : alert.isError || !a ? (
        <ErrorState error={alert.error} />
      ) : (
        <div className="space-y-5">
          <AlertFacts a={a} currency={currency} />
          <RecordsList records={[...a.deposits, ...a.withdrawals]} currency={currency} />
          {a.status === "unreconciled" ? (
            <>
              <div className="flex flex-wrap gap-2" role="tablist">
                {(
                  [
                    ["record", "Record it"],
                    ["match", "Match existing"],
                    ["dismiss", "Set aside"],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "btn-primary" : "btn-secondary"} onClick={() => setTab(k)}>
                    {label}
                  </button>
                ))}
              </div>
              {tab === "record" && <ReconcileForm groupId={groupId} alert={a} currency={currency} />}
              {tab === "match" && <MatchForm groupId={groupId} alert={a} currency={currency} />}
              {tab === "dismiss" && <DismissForm groupId={groupId} alert={a} />}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Undo removes the deposits or withdrawals recorded from this transaction (records matched to it stay) and puts it back on the list.
              </p>
              <InlineError error={undo.error} />
              <button className="btn-secondary" disabled={undo.isPending} onClick={() => undo.mutate({})}>
                Undo reconciliation
              </button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

interface DraftLine {
  kind: LineKind;
  amount: string;
  member_id: string;
  item: string; // contribution, fine category ("f-ID" or "c-ID" for a late fine), loan, income or expense category id
  depositor_id: string;
  description: string;
}

const blank = (kind: LineKind, amount = ""): DraftLine => ({ kind, amount, member_id: "", item: "", depositor_id: "", description: "" });

function fromLine(l: Line): DraftLine {
  const d = blank(l.kind, l.amount);
  d.member_id = l.member_id ? String(l.member_id) : "";
  if (l.kind === "fine") d.item = l.fine_category_id ? `f-${l.fine_category_id}` : l.contribution_id ? `c-${l.contribution_id}` : "";
  else d.item = String(l.contribution_id ?? l.loan_id ?? l.income_category_id ?? l.expense_category_id ?? "");
  d.description = l.description ?? "";
  return d;
}

/** toLine turns a form row into an API line, or null when it is incomplete. */
export function toLine(d: DraftLine): Line | null {
  if (!isAmount(d.amount)) return null;
  const n = (v: string) => (v ? Number(v) : undefined);
  const l: Line = { kind: d.kind, amount: d.amount };
  if (d.description.trim()) l.description = d.description.trim();
  const needsMember = ["contribution", "fine", "misc", "contribution_refund"].includes(d.kind);
  if (needsMember) {
    if (!d.member_id) return null;
    l.member_id = Number(d.member_id);
  }
  switch (d.kind) {
    case "contribution":
    case "contribution_refund":
      if (!d.item) return null;
      l.contribution_id = Number(d.item);
      break;
    case "fine": {
      const [t, id] = d.item.split("-");
      if (!id) return null;
      if (t === "c") l.contribution_id = Number(id);
      else l.fine_category_id = Number(id);
      break;
    }
    case "loan":
      if (!d.item) return null;
      l.loan_id = Number(d.item);
      if (d.member_id) l.member_id = Number(d.member_id);
      break;
    case "income":
      if (!d.item) return null;
      l.income_category_id = Number(d.item);
      l.depositor_id = n(d.depositor_id);
      break;
    case "expense":
      if (!d.item) return null;
      l.expense_category_id = Number(d.item);
      break;
  }
  return l;
}

function ReconcileForm({ groupId, alert, currency }: { groupId: number; alert: AlertDetail; currency: string }) {
  const kinds = alert.direction === "in" ? moneyInKinds : moneyOutKinds;
  const [rows, setRows] = useState<DraftLine[]>(() =>
    alert.suggestion?.lines.length ? alert.suggestion.lines.map(fromLine) : [blank(kinds[0]!, Number(alert.amount).toFixed(2))],
  );
  const [note, setNote] = useState("");
  const reconcile = useAlertAction(groupId, alert.id, "reconcile");
  const lines = rows.map(toLine);
  const total = rows.reduce((s, r) => s + (isAmount(r.amount) ? Number(r.amount) : 0), 0);
  const left = Math.round((Number(alert.amount) - total) * 100) / 100;
  const ready = lines.every(Boolean) && left === 0;
  const setRow = (i: number, p: Partial<DraftLine>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    await reconcile.mutateAsync({ lines: lines as Line[], ...(note.trim() && { note: note.trim() }) }).catch(() => null);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {alert.suggestion && <p className="text-sm text-slate-500">Filled in from what the payer owes. Check it before saving.</p>}
      {rows.map((r, i) => (
        <LineRow
          key={i}
          groupId={groupId}
          index={i}
          row={r}
          kinds={kinds}
          currency={currency}
          onChange={(p) => setRow(i, p)}
          onRemove={rows.length > 1 ? () => setRows((rs) => rs.filter((_, j) => j !== i)) : undefined}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" className="btn-ghost" onClick={() => setRows((rs) => [...rs, blank(kinds[0]!, left > 0 ? left.toFixed(2) : "")])}>
          <Plus className="size-4" aria-hidden /> Add a line
        </button>
        <span className={left === 0 ? "text-slate-500" : "font-medium text-amber-700 dark:text-amber-300"}>
          {left === 0 ? "Adds up" : left > 0 ? `${formatMoney(left.toFixed(2), currency)} left to allocate` : `${formatMoney((-left).toFixed(2), currency)} too much`}
        </span>
      </div>
      <Field label="Note (optional)" htmlFor="rec-note">
        <input id="rec-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <InlineError error={reconcile.error} />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={!ready || reconcile.isPending}>
          Save to the books
        </button>
      </div>
    </form>
  );
}

function LineRow({
  groupId,
  index,
  row,
  kinds,
  currency,
  onChange,
  onRemove,
}: {
  groupId: number;
  index: number;
  row: DraftLine;
  kinds: LineKind[];
  currency: string;
  onChange: (p: Partial<DraftLine>) => void;
  onRemove?: () => void;
}) {
  const members = useMembers(groupId, "active");
  const contributions = useContributions(groupId);
  const fines = useCategories(groupId, "fine");
  const income = useCategories(groupId, "income");
  const expense = useCategories(groupId, "expense");
  const depositors = useDepositors(groupId);
  const loans = useLoans(groupId, { status: "open", member_id: row.member_id ? Number(row.member_id) : undefined });
  const id = (s: string) => `line-${index}-${s}`;
  const needsMember = row.kind !== "income" && row.kind !== "expense";

  let items: { value: string; label: string }[] = [];
  let itemLabel = "";
  switch (row.kind) {
    case "contribution":
    case "contribution_refund":
      itemLabel = "Contribution";
      items = (contributions.data ?? []).map((c) => ({ value: String(c.id), label: c.name }));
      break;
    case "fine":
      itemLabel = "Fine";
      items = [
        ...(fines.data ?? []).map((f) => ({ value: `f-${f.id}`, label: f.name })),
        ...(contributions.data ?? []).map((c) => ({ value: `c-${c.id}`, label: `Late payment: ${c.name}` })),
      ];
      break;
    case "loan":
      itemLabel = "Loan";
      items = (loans.data?.loans.items ?? []).map((l) => ({
        value: String(l.id),
        label: `${l.member?.name ?? "Loan"} · ${formatMoney(l.amount, currency)} from ${formatDate(l.disbursed_on)}`,
      }));
      break;
    case "income":
      itemLabel = "Income category";
      items = (income.data ?? []).map((c) => ({ value: String(c.id), label: c.name }));
      break;
    case "expense":
      itemLabel = "Expense category";
      items = (expense.data ?? []).map((c) => ({ value: String(c.id), label: c.name }));
      break;
  }

  return (
    <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-800">
      <legend className="sr-only">Line {index + 1}</legend>
      <Field label="For" htmlFor={id("kind")}>
        <select id={id("kind")} className="input" value={row.kind} onChange={(e) => onChange({ kind: e.target.value as LineKind, item: "" })}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {lineKindLabels[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Amount (${currency})`} htmlFor={id("amount")}>
        <div className="flex gap-2">
          <input id={id("amount")} className="input" inputMode="decimal" value={row.amount} onChange={(e) => onChange({ amount: e.target.value.trim() })} />
          {onRemove && (
            <button type="button" className="btn-ghost p-2" onClick={onRemove} aria-label={`Remove line ${index + 1}`}>
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </Field>
      {needsMember && (
        <Field label={row.kind === "loan" ? "Borrower (to find the loan)" : "Member"} htmlFor={id("member")}>
          <select id={id("member")} className="input" value={row.member_id} onChange={(e) => onChange({ member_id: e.target.value, ...(row.kind === "loan" && { item: "" }) })}>
            <option value="">{row.kind === "loan" ? "Any member" : "Choose a member"}</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {fullName(m)}
              </option>
            ))}
          </select>
        </Field>
      )}
      {itemLabel && (
        <Field label={itemLabel} htmlFor={id("item")}>
          <select id={id("item")} className="input" value={row.item} onChange={(e) => onChange({ item: e.target.value })}>
            <option value="">Choose</option>
            {items.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {row.kind === "income" && (
        <Field label="Depositor (optional)" htmlFor={id("depositor")}>
          <select id={id("depositor")} className="input" value={row.depositor_id} onChange={(e) => onChange({ depositor_id: e.target.value })}>
            <option value="">None</option>
            {(depositors.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </fieldset>
  );
}

function MatchForm({ groupId, alert, currency }: { groupId: number; alert: AlertDetail; currency: string }) {
  const day = alert.transaction_at.slice(0, 10);
  const shift = (n: number) => {
    const d = new Date(day + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const params = { account_id: alert.account?.id, from: shift(-14), to: shift(14) };
  const deposits = useDeposits(groupId, params);
  const withdrawals = useWithdrawals(groupId, params);
  const match = useAlertAction(groupId, alert.id, "match");
  const [picked, setPicked] = useState<number[]>([]);
  const options = useMemo(() => {
    if (alert.direction === "in")
      return (deposits.data?.deposits.items ?? [])
        .filter((d) => !d.voided_at)
        .map((d) => ({ id: d.id, amount: d.amount, date: d.date, text: [d.contribution?.name ?? d.fine_category?.name ?? d.income_category?.name ?? d.kind, d.member?.name].filter(Boolean).join(" · ") }));
    return (withdrawals.data?.withdrawals.items ?? [])
      .filter((w) => !w.voided_at)
      .map((w) => ({ id: w.id, amount: w.amount, date: w.date, text: [w.expense_category?.name ?? w.contribution?.name ?? w.kind, w.member?.name].filter(Boolean).join(" · ") }));
  }, [alert.direction, deposits.data, withdrawals.data]);
  const total = options.filter((o) => picked.includes(o.id)).reduce((s, o) => s + Number(o.amount), 0);
  const adds = Math.round(total * 100) === Math.round(Number(alert.amount) * 100);

  if (!alert.account) return <p className="text-sm text-slate-500">This transaction has no account, so there is nothing to match.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Already recorded this by hand? Pick the {alert.direction === "in" ? "deposits" : "withdrawals"} on {alert.account.name} that make up this transaction.
      </p>
      {deposits.isPending || withdrawals.isPending ? (
        <Spinner />
      ) : options.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing recorded on this account within two weeks of the transaction.</p>
      ) : (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {options.map((o) => (
            <li key={o.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-700"
                  checked={picked.includes(o.id)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, o.id] : p.filter((x) => x !== o.id)))}
                />
                <span className="min-w-0 flex-1">
                  {o.text}
                  <span className="block text-xs text-slate-500">{formatDate(o.date)}</span>
                </span>
                <span className="tabular-nums">{formatMoney(o.amount, currency)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <InlineError error={match.error} />
      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-slate-500">{formatMoney(total.toFixed(2), currency)} picked</span>
        <button
          className="btn-primary"
          disabled={!adds || match.isPending}
          onClick={() => match.mutate(alert.direction === "in" ? { deposit_ids: picked } : { withdrawal_ids: picked })}
        >
          Match
        </button>
      </div>
    </div>
  );
}

function DismissForm({ groupId, alert }: { groupId: number; alert: AlertDetail }) {
  const dismiss = useAlertAction(groupId, alert.id, "dismiss");
  const [status, setStatus] = useState<"ignored" | "reconciled">("ignored");
  const [note, setNote] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        dismiss.mutate({ status, note: note.trim() });
      }}
    >
      <p className="text-sm text-slate-500">Take it off the list without recording anything, for example a bank reversal or a charge already in the books.</p>
      <Field label="Mark as" htmlFor="dismiss-status">
        <select id="dismiss-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as "ignored" | "reconciled")}>
          <option value="ignored">Ignored: not group money</option>
          <option value="reconciled">Reconciled: already in the books</option>
        </select>
      </Field>
      <Field label="Why" htmlFor="dismiss-note">
        <input id="dismiss-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} required />
      </Field>
      <InlineError error={dismiss.error} />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={!note.trim() || dismiss.isPending}>
          Save
        </button>
      </div>
    </form>
  );
}
