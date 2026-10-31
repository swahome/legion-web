import { useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useContributions, useGroup, useMembers } from "../../api/hooks";
import {
  depositKindLabels,
  methodLabels,
  recordableKinds,
  useAccounts,
  useCategories,
  useDepositors,
  useDeposits,
  useRecordDeposit,
  useVoidDeposit,
  type Deposit,
  type DepositInput,
  type DepositKind,
  type PaymentMethod,
  type RecordableKind,
} from "../../api/money";
import { useGroupId } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner } from "../../components/ui";
import { formatDate, formatMoney, fullName } from "../../lib/format";
import { Confirm, Pager } from "../admin/widgets";
import { OfficialsOnly, todayISO } from "./shared";

/** DepositsPage lists money paid into the group and records new deposits (officials). */
export function DepositsPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const [kind, setKind] = useState<DepositKind | "">("");
  const [showVoided, setShowVoided] = useState(false);
  const [page, setPage] = useState(1);
  const list = useDeposits(groupId, { kind: kind || undefined, include_voided: showVoided, page });
  const [recording, setRecording] = useState(false);
  const [voiding, setVoiding] = useState<Deposit | null>(null);
  const voidDeposit = useVoidDeposit(groupId);

  if (group.data && !group.data.is_official) return <OfficialsOnly />;
  const currency = group.data?.currency ?? "KES";
  const totals = list.data?.totals_by_kind ?? {};

  return (
    <>
      <PageHeader
        title="Deposits"
        subtitle="Money paid into the group's accounts."
        actions={
          <button className="btn-primary" onClick={() => setRecording(true)}>
            <Plus className="size-4" aria-hidden /> Record deposit
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
              setKind(e.target.value as DepositKind | "");
              setPage(1);
            }}
          >
            <option value="">All deposits</option>
            {Object.entries(depositKindLabels).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
                {totals[k as DepositKind] ? ` (${formatMoney(totals[k as DepositKind], currency)})` : ""}
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
        <Spinner label="Loading deposits" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {list.data.deposits.items.length === 0 ? (
            <EmptyState title="No deposits found" />
          ) : (
            <>
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">For</th>
                    <th className="px-4 py-3 font-medium">From</th>
                    <th className="px-4 py-3 font-medium">Into</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.data.deposits.items.map((d) => (
                    <tr key={d.id} className={d.voided_at ? "text-slate-400" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(d.date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{depositKindLabels[d.kind]}</span>
                        <span className="block text-xs text-slate-500">
                          {[d.contribution?.name ?? d.fine_category?.name ?? d.income_category?.name, d.method && methodLabels[d.method], d.description]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">{d.member?.name ?? d.depositor?.name ?? "—"}</td>
                      <td className="px-4 py-3">{d.account?.name ?? <span className="text-slate-400">Not linked</span>}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {d.voided_at ? <s>{formatMoney(d.amount, currency)}</s> : formatMoney(d.amount, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {d.voided_at ? (
                          <Badge tone="danger">Voided</Badge>
                        ) : (
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setVoiding(d)}>
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager data={list.data.deposits} onPage={setPage} />
            </>
          )}
        </div>
      )}
      {recording && <RecordDepositDialog groupId={groupId} currency={currency} onClose={() => setRecording(false)} />}
      <Confirm
        open={!!voiding}
        title="Void this deposit?"
        action="Void deposit"
        danger
        pending={voidDeposit.isPending}
        error={voidDeposit.error}
        onClose={() => {
          voidDeposit.reset();
          setVoiding(null);
        }}
        onConfirm={async () => {
          if (voiding && (await voidDeposit.mutateAsync(voiding.id).catch(() => null))) setVoiding(null);
        }}
      >
        {voiding && (
          <p>
            {formatMoney(voiding.amount, currency)} {voiding.member ? `from ${voiding.member.name} ` : ""}on {formatDate(voiding.date)} will stop counting
            in the account balance{voiding.member ? " and the member's statement" : ""}. This can't be undone.
          </p>
        )}
      </Confirm>
    </>
  );
}

export function RecordDepositDialog({ groupId, currency, onClose }: { groupId: number; currency: string; onClose: () => void }) {
  const record = useRecordDeposit(groupId);
  const accounts = useAccounts(groupId);
  const members = useMembers(groupId, "active");
  const contributions = useContributions(groupId);
  const fines = useCategories(groupId, "fine");
  const incomes = useCategories(groupId, "income");
  const depositors = useDepositors(groupId);
  const openAccounts = useMemo(() => accounts.data?.accounts.filter((a) => !a.is_closed) ?? [], [accounts.data]);
  const defaultAccount = openAccounts.find((a) => a.is_default) ?? openAccounts[0];

  const [form, setForm] = useState({
    kind: "contribution" as RecordableKind,
    account_id: "",
    amount: "",
    date: todayISO(),
    method: "" as PaymentMethod | "",
    description: "",
    member_id: "",
    contribution_id: "",
    fine: "", // "cat:<id>" or "contribution:<id>"
    income_category_id: "",
    depositor_id: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const accountId = form.account_id || (defaultAccount ? String(defaultAccount.id) : "");
  const forMember = form.kind !== "income";

  const ready =
    !!accountId &&
    /^\d+(\.\d{1,2})?$/.test(form.amount) &&
    Number(form.amount) > 0 &&
    (!forMember || !!form.member_id) &&
    (form.kind !== "contribution" || !!form.contribution_id) &&
    (form.kind !== "fine" || !!form.fine) &&
    (form.kind !== "income" || !!form.income_category_id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: DepositInput = {
      kind: form.kind,
      account_id: Number(accountId),
      amount: form.amount,
      date: form.date,
      ...(form.method && { method: form.method }),
      ...(form.description.trim() && { description: form.description.trim() }),
    };
    if (forMember) body.member_id = Number(form.member_id);
    if (form.kind === "contribution") body.contribution_id = Number(form.contribution_id);
    if (form.kind === "fine") {
      const [t, id] = form.fine.split(":");
      if (t === "cat") body.fine_category_id = Number(id);
      else body.contribution_id = Number(id);
    }
    if (form.kind === "income") {
      body.income_category_id = Number(form.income_category_id);
      if (form.depositor_id) body.depositor_id = Number(form.depositor_id);
    }
    if (await record.mutateAsync(body).catch(() => null)) onClose();
  }

  const finesEnabled = contributions.data?.filter((c) => c.schedule?.fines_enabled) ?? [];

  return (
    <Dialog open onClose={onClose} title="Record deposit">
      {accounts.data && openAccounts.length === 0 ? (
        <EmptyState title="No open accounts">Add an account first, so the money has somewhere to go.</EmptyState>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <InlineError error={record.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment for" htmlFor="dp-kind">
              <select id="dp-kind" className="input" value={form.kind} onChange={(e) => set("kind")(e.target.value)}>
                {recordableKinds.map((k) => (
                  <option key={k} value={k}>
                    {depositKindLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Into account" htmlFor="dp-account">
              <select id="dp-account" className="input" value={accountId} onChange={(e) => set("account_id")(e.target.value)} required>
                {openAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {forMember && (
            <Field label="Member" htmlFor="dp-member">
              <select id="dp-member" className="input" value={form.member_id} onChange={(e) => set("member_id")(e.target.value)} required>
                <option value="">Choose a member…</option>
                {members.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {fullName(m)}
                    {m.membership_number ? ` (No. ${m.membership_number})` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form.kind === "contribution" && (
            <Field label="Contribution" htmlFor="dp-contribution">
              <select id="dp-contribution" className="input" value={form.contribution_id} onChange={(e) => set("contribution_id")(e.target.value)} required>
                <option value="">Choose…</option>
                {contributions.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form.kind === "fine" && (
            <Field label="Fine" htmlFor="dp-fine">
              <select id="dp-fine" className="input" value={form.fine} onChange={(e) => set("fine")(e.target.value)} required>
                <option value="">Choose…</option>
                {fines.data?.map((f) => (
                  <option key={`cat:${f.id}`} value={`cat:${f.id}`}>
                    {f.name}
                  </option>
                ))}
                {finesEnabled.map((c) => (
                  <option key={`contribution:${c.id}`} value={`contribution:${c.id}`}>
                    Late payment: {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form.kind === "income" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Income category" htmlFor="dp-income">
                <select id="dp-income" className="input" value={form.income_category_id} onChange={(e) => set("income_category_id")(e.target.value)} required>
                  <option value="">Choose…</option>
                  {incomes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From (optional)" htmlFor="dp-depositor">
                <select id="dp-depositor" className="input" value={form.depositor_id} onChange={(e) => set("depositor_id")(e.target.value)}>
                  <option value="">—</option>
                  {depositors.data?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`Amount (${currency})`} htmlFor="dp-amount">
              <input
                id="dp-amount"
                className="input"
                inputMode="decimal"
                placeholder="0.00"
                pattern="\d+(\.\d{1,2})?"
                value={form.amount}
                onChange={(e) => set("amount")(e.target.value.trim())}
                required
              />
            </Field>
            <Field label="Date" htmlFor="dp-date">
              <input id="dp-date" type="date" className="input" max={todayISO()} value={form.date} onChange={(e) => set("date")(e.target.value)} required />
            </Field>
            <Field label="Method" htmlFor="dp-method">
              <select id="dp-method" className="input" value={form.method} onChange={(e) => set("method")(e.target.value)}>
                <option value="">—</option>
                {Object.entries(methodLabels).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="dp-desc">
            <input id="dp-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!ready || record.isPending}>
              {record.isPending ? "Recording…" : "Record deposit"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
