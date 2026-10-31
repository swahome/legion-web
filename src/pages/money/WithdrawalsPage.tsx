import { useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useContributions, useGroup, useMembers } from "../../api/hooks";
import {
  methodLabels,
  recordableWithdrawals,
  useAccounts,
  useCategories,
  useRecordWithdrawal,
  useVoidWithdrawal,
  useWithdrawals,
  withdrawalKindLabels,
  type PaymentMethod,
  type RecordableWithdrawal,
  type Withdrawal,
  type WithdrawalInput,
  type WithdrawalKind,
} from "../../api/money";
import { useGroupId } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner } from "../../components/ui";
import { formatDate, formatMoney, fullName } from "../../lib/format";
import { Confirm, Pager } from "../admin/widgets";
import { AmountDateMethod, OfficialsOnly, isAmount, todayISO } from "./shared";

/** WithdrawalsPage lists money paid out of the group's accounts and records new withdrawals (officials). */
export function WithdrawalsPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const [kind, setKind] = useState<WithdrawalKind | "">("");
  const [showVoided, setShowVoided] = useState(false);
  const [page, setPage] = useState(1);
  const list = useWithdrawals(groupId, { kind: kind || undefined, include_voided: showVoided, page });
  const [recording, setRecording] = useState(false);
  const [voiding, setVoiding] = useState<Withdrawal | null>(null);
  const voidWithdrawal = useVoidWithdrawal(groupId);

  if (group.data && !group.data.is_official) return <OfficialsOnly />;
  const currency = group.data?.currency ?? "KES";
  const totals = list.data?.totals_by_kind ?? {};

  return (
    <>
      <PageHeader
        title="Withdrawals"
        subtitle="Money paid out of the group's accounts."
        actions={
          <button className="btn-primary" onClick={() => setRecording(true)}>
            <Plus className="size-4" aria-hidden /> Record withdrawal
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Type</span>
          <select
            className="input"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as WithdrawalKind | "");
              setPage(1);
            }}
          >
            <option value="">All withdrawals</option>
            {Object.entries(withdrawalKindLabels).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
                {totals[k as WithdrawalKind] ? ` (${formatMoney(totals[k as WithdrawalKind], currency)})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" className="size-4 accent-brand-700" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
          Show voided
        </label>
      </div>

      {list.isPending ? (
        <Spinner label="Loading withdrawals" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {list.data.withdrawals.items.length === 0 ? (
            <EmptyState title="No withdrawals found" />
          ) : (
            <>
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">For</th>
                    <th className="px-4 py-3 font-medium">Paid to</th>
                    <th className="px-4 py-3 font-medium">From</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.data.withdrawals.items.map((w) => (
                    <tr key={w.id} className={w.voided_at ? "text-slate-400" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(w.date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{withdrawalKindLabels[w.kind]}</span>
                        <span className="block text-xs text-slate-500">
                          {[w.expense_category?.name ?? w.contribution?.name, w.method && methodLabels[w.method], w.description].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">{w.member?.name ?? "—"}</td>
                      <td className="px-4 py-3">{w.account?.name ?? <span className="text-slate-400">Not linked</span>}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {w.voided_at ? <s>{formatMoney(w.amount, currency)}</s> : formatMoney(w.amount, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {w.voided_at ? (
                          <Badge tone="danger">Voided</Badge>
                        ) : (
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setVoiding(w)}>
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager data={list.data.withdrawals} onPage={setPage} />
            </>
          )}
        </div>
      )}
      {recording && <RecordWithdrawalDialog groupId={groupId} currency={currency} onClose={() => setRecording(false)} />}
      <Confirm
        open={!!voiding}
        title="Void this withdrawal?"
        action="Void withdrawal"
        danger
        pending={voidWithdrawal.isPending}
        error={voidWithdrawal.error}
        onClose={() => {
          voidWithdrawal.reset();
          setVoiding(null);
        }}
        onConfirm={async () => {
          if (voiding && (await voidWithdrawal.mutateAsync(voiding.id).catch(() => null))) setVoiding(null);
        }}
      >
        {voiding && (
          <p>
            {formatMoney(voiding.amount, currency)} on {formatDate(voiding.date)} will go back into the account balance
            {voiding.member ? ` and back onto ${voiding.member.name}'s contributions` : ""}. This can't be undone.
          </p>
        )}
      </Confirm>
    </>
  );
}

export function RecordWithdrawalDialog({ groupId, currency, onClose }: { groupId: number; currency: string; onClose: () => void }) {
  const record = useRecordWithdrawal(groupId);
  const accounts = useAccounts(groupId);
  const members = useMembers(groupId, "active");
  const contributions = useContributions(groupId);
  const expenses = useCategories(groupId, "expense");
  const openAccounts = useMemo(() => accounts.data?.accounts.filter((a) => !a.is_closed) ?? [], [accounts.data]);
  const defaultAccount = openAccounts.find((a) => a.is_default) ?? openAccounts[0];

  const [form, setForm] = useState({
    kind: "expense" as RecordableWithdrawal,
    account_id: "",
    amount: "",
    date: todayISO(),
    method: "" as PaymentMethod | "",
    description: "",
    member_id: "",
    contribution_id: "",
    expense_category_id: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const accountId = form.account_id || (defaultAccount ? String(defaultAccount.id) : "");
  const refund = form.kind === "contribution_refund";
  const ready =
    !!accountId && isAmount(form.amount) && (refund ? !!form.member_id && !!form.contribution_id : !!form.expense_category_id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: WithdrawalInput = {
      kind: form.kind,
      account_id: Number(accountId),
      amount: form.amount,
      date: form.date,
      ...(form.method && { method: form.method }),
      ...(form.description.trim() && { description: form.description.trim() }),
    };
    if (refund) {
      body.member_id = Number(form.member_id);
      body.contribution_id = Number(form.contribution_id);
    } else body.expense_category_id = Number(form.expense_category_id);
    if (await record.mutateAsync(body).catch(() => null)) onClose();
  }

  return (
    <Dialog open onClose={onClose} title="Record withdrawal">
      {accounts.data && openAccounts.length === 0 ? (
        <EmptyState title="No open accounts">Add an account first.</EmptyState>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <InlineError error={record.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paid for" htmlFor="wd-kind">
              <select id="wd-kind" className="input" value={form.kind} onChange={(e) => set("kind")(e.target.value)}>
                {recordableWithdrawals.map((k) => (
                  <option key={k} value={k}>
                    {withdrawalKindLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From account" htmlFor="wd-account">
              <select id="wd-account" className="input" value={accountId} onChange={(e) => set("account_id")(e.target.value)} required>
                {openAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatMoney(a.balance, currency)})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {refund ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Member" htmlFor="wd-member">
                <select id="wd-member" className="input" value={form.member_id} onChange={(e) => set("member_id")(e.target.value)} required>
                  <option value="">Choose a member…</option>
                  {members.data?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {fullName(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From contribution" htmlFor="wd-contribution">
                <select id="wd-contribution" className="input" value={form.contribution_id} onChange={(e) => set("contribution_id")(e.target.value)} required>
                  <option value="">Choose…</option>
                  {contributions.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : (
            <Field label="Expense category" htmlFor="wd-expense">
              <select id="wd-expense" className="input" value={form.expense_category_id} onChange={(e) => set("expense_category_id")(e.target.value)} required>
                <option value="">Choose…</option>
                {expenses.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <AmountDateMethod idPrefix="wd" currency={currency} form={form} set={set} />
          <Field label="Description (optional)" htmlFor="wd-desc">
            <input id="wd-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!ready || record.isPending}>
              {record.isPending ? "Recording…" : "Record withdrawal"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
