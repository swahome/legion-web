import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { useGroup } from "../../api/hooks";
import { useAccounts, useRecordTransfer, useTransfers, useVoidTransfer, type Transfer } from "../../api/money";
import { useGroupId } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { Confirm, Pager } from "../admin/widgets";
import { AmountDateMethod, OfficialsOnly, isAmount, todayISO } from "./shared";

/** TransfersPage lists and records moves of money between the group's own accounts (officials). */
export function TransfersPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const [showVoided, setShowVoided] = useState(false);
  const [page, setPage] = useState(1);
  const list = useTransfers(groupId, { include_voided: showVoided, page });
  const [recording, setRecording] = useState(false);
  const [voiding, setVoiding] = useState<Transfer | null>(null);
  const voidTransfer = useVoidTransfer(groupId);

  if (group.data && !group.data.is_official) return <OfficialsOnly />;
  const currency = group.data?.currency ?? "KES";

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle="Money moved between the group's own accounts."
        actions={
          <button className="btn-primary" onClick={() => setRecording(true)}>
            <Plus className="size-4" aria-hidden /> Record transfer
          </button>
        }
      />
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand-700" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
        Show voided
      </label>
      {list.isPending ? (
        <Spinner label="Loading transfers" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {list.data.items.length === 0 ? (
            <EmptyState title="No transfers yet" />
          ) : (
            <>
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">From → to</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.data.items.map((t) => (
                    <tr key={t.id} className={t.voided_at ? "text-slate-400" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex flex-wrap items-center gap-1.5 font-medium">
                          {t.from_account?.name ?? "Unknown"} <ArrowRight className="size-3.5 text-slate-400" aria-label="to" /> {t.to_account?.name ?? "Unknown"}
                        </span>
                        {t.description && <span className="block text-xs text-slate-500">{t.description}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {t.voided_at ? <s>{formatMoney(t.amount, currency)}</s> : formatMoney(t.amount, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.voided_at ? (
                          <Badge tone="danger">Voided</Badge>
                        ) : (
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setVoiding(t)}>
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager data={list.data} onPage={setPage} />
            </>
          )}
        </div>
      )}
      {recording && <RecordTransferDialog groupId={groupId} currency={currency} onClose={() => setRecording(false)} />}
      <Confirm
        open={!!voiding}
        title="Void this transfer?"
        action="Void transfer"
        danger
        pending={voidTransfer.isPending}
        error={voidTransfer.error}
        onClose={() => {
          voidTransfer.reset();
          setVoiding(null);
        }}
        onConfirm={async () => {
          if (voiding && (await voidTransfer.mutateAsync(voiding.id).catch(() => null))) setVoiding(null);
        }}
      >
        {voiding && (
          <p>
            {formatMoney(voiding.amount, currency)} goes back from {voiding.to_account?.name} to {voiding.from_account?.name}. This can't be undone.
          </p>
        )}
      </Confirm>
    </>
  );
}

function RecordTransferDialog({ groupId, currency, onClose }: { groupId: number; currency: string; onClose: () => void }) {
  const record = useRecordTransfer(groupId);
  const accounts = useAccounts(groupId);
  const open = useMemo(() => accounts.data?.accounts.filter((a) => !a.is_closed) ?? [], [accounts.data]);
  const [form, setForm] = useState({ from: "", to: "", amount: "", date: todayISO(), description: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ready = !!form.from && !!form.to && form.from !== form.to && isAmount(form.amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      from_account_id: Number(form.from),
      to_account_id: Number(form.to),
      amount: form.amount,
      date: form.date,
      ...(form.description.trim() && { description: form.description.trim() }),
    };
    if (await record.mutateAsync(body).catch(() => null)) onClose();
  }

  const options = (exclude: string) =>
    open
      .filter((a) => String(a.id) !== exclude)
      .map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({formatMoney(a.balance, currency)})
        </option>
      ));

  return (
    <Dialog open onClose={onClose} title="Record transfer">
      {accounts.data && open.length < 2 ? (
        <EmptyState title="Two accounts needed">A transfer moves money between two of the group's open accounts.</EmptyState>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <InlineError error={record.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From account" htmlFor="tr-from">
              <select id="tr-from" className="input" value={form.from} onChange={(e) => set("from")(e.target.value)} required>
                <option value="">Choose…</option>
                {options(form.to)}
              </select>
            </Field>
            <Field label="To account" htmlFor="tr-to">
              <select id="tr-to" className="input" value={form.to} onChange={(e) => set("to")(e.target.value)} required>
                <option value="">Choose…</option>
                {options(form.from)}
              </select>
            </Field>
          </div>
          <AmountDateMethod idPrefix="tr" currency={currency} form={form} set={(k) => set(k as "amount" | "date")} method={false} />
          <Field label="Description (optional)" htmlFor="tr-desc">
            <input id="tr-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!ready || record.isPending}>
              {record.isPending ? "Recording…" : "Record transfer"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
