import { useMemo, useState, type FormEvent } from "react";
import { Check, Clock, Plus, X } from "lucide-react";
import { useContributions, useGroup, useMembers } from "../../api/hooks";
import {
  methodLabels,
  requestKinds,
  requestStatusLabels,
  useAccounts,
  useCategories,
  useCreateWithdrawalRequest,
  useInstitutions,
  useRequestAction,
  useWithdrawalRequest,
  useWithdrawalRequests,
  withdrawalKindLabels,
  type PaymentMethod,
  type Recipient,
  type RequestKind,
  type RequestStatus,
  type WithdrawalRequest,
  type WithdrawalRequestInput,
} from "../../api/money";
import { useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, cx } from "../../components/ui";
import { formatDate, formatMoney, fullName } from "../../lib/format";
import { Pager, formatDateTime } from "../admin/widgets";
import { isAmount, todayISO } from "./shared";

const statusTones: Record<RequestStatus, "neutral" | "brand" | "warn" | "danger"> = {
  pending: "warn",
  approved: "brand",
  paid: "neutral",
  declined: "danger",
  cancelled: "neutral",
  failed: "danger",
};

/** recipientText says who a request pays, in words. */
export function recipientText(r: WithdrawalRequest["recipient"]): string {
  switch (r.type) {
    case "mobile":
      return `Mobile money ${"phone" in r ? r.phone : ""}`;
    case "paybill":
      return `Paybill ${"paybill" in r ? r.paybill : ""}${"account_number" in r && r.account_number ? `, account ${r.account_number}` : ""}`;
    case "bank":
      return `Bank account ${"account_number" in r ? r.account_number : ""}${"account_name" in r && r.account_name ? ` (${r.account_name})` : ""}`;
    default:
      return "";
  }
}

type Tab = "mine" | RequestStatus | "all";

/**
 * WithdrawalRequestsPage: officials ask for money to be paid out and the
 * group's signatories approve or decline. Officials see every request and
 * pay approved ones; a signatory sees what is waiting for them first.
 */
export function WithdrawalRequestsPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const [tab, setTab] = useState<Tab | null>(null);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const awaiting = group.data?.withdrawal_requests_awaiting_me ?? 0;
  const current: Tab = tab ?? (awaiting > 0 ? "mine" : managing ? "pending" : "all");
  const list = useWithdrawalRequests(groupId, {
    page,
    ...(current === "mine" ? { awaiting: "me" as const } : current !== "all" ? { status: current } : {}),
  });

  if (group.data && !group.data.is_official && !group.data.is_signatory) {
    return <ErrorState error={new Error("Only officials and signatories can see withdrawal requests.")} />;
  }
  const currency = group.data?.currency ?? "KES";
  const tabs: { id: Tab; label: string }[] = [
    ...(group.data?.is_signatory ? [{ id: "mine" as const, label: awaiting ? `Waiting for me (${awaiting})` : "Waiting for me" }] : []),
    { id: "pending", label: "Pending" },
    { id: "approved", label: "To pay" },
    { id: "all", label: "All" },
  ];

  return (
    <>
      <PageHeader
        title="Withdrawal requests"
        subtitle="Money out that the group's signatories approve before it is paid."
        actions={
          managing && (
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden /> New request
            </button>
          )
        }
      />
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={current === t.id}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              current === t.id ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-700",
            )}
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {list.isPending ? (
        <Spinner label="Loading requests" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title={current === "mine" ? "Nothing is waiting for you" : "No requests here"} />
        </div>
      ) : (
        <div className="card">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.data.items.map((r) => (
              <li key={r.id}>
                <button className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => setOpenId(r.id)}>
                  <span className="min-w-0">
                    <span className="font-medium">{withdrawalKindLabels[r.kind]}</span>
                    <span className="ml-2 text-slate-500">{r.expense_category?.name ?? r.member?.name ?? r.to_account?.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {[formatDate(r.created_at.slice(0, 10)), r.requested_by && `by ${r.requested_by.name}`, r.description].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 tabular-nums">
                      {r.approvals}/{r.signatories} approved
                    </span>
                    <Badge tone={statusTones[r.status]}>{requestStatusLabels[r.status]}</Badge>
                    <span className="font-medium tabular-nums">{formatMoney(r.amount, currency)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
      {creating && <NewRequestDialog groupId={groupId} currency={currency} onClose={() => setCreating(false)} onCreated={setOpenId} />}
      {openId != null && <RequestDialog groupId={groupId} id={openId} currency={currency} managing={managing} onClose={() => setOpenId(null)} />}
    </>
  );
}

function NewRequestDialog({
  groupId,
  currency,
  onClose,
  onCreated,
}: {
  groupId: number;
  currency: string;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const create = useCreateWithdrawalRequest(groupId);
  const accounts = useAccounts(groupId);
  const members = useMembers(groupId, "active");
  const contributions = useContributions(groupId);
  const expenses = useCategories(groupId, "expense");
  const banks = useInstitutions("bank");
  const open = useMemo(() => accounts.data?.accounts.filter((a) => !a.is_closed) ?? [], [accounts.data]);
  const defaultAccount = open.find((a) => a.kind === "bank" && a.is_default) ?? open[0];
  const [form, setForm] = useState({
    kind: "expense" as RequestKind,
    account_id: "",
    to_account_id: "",
    amount: "",
    description: "",
    expense_category_id: "",
    member_id: "",
    contribution_id: "",
    recipient: "mobile" as Recipient["type"],
    phone: "",
    paybill: "",
    bank_id: "",
    account_number: "",
    account_name: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const accountId = form.account_id || (defaultAccount ? String(defaultAccount.id) : "");
  const transfer = form.kind === "funds_transfer";
  const refund = form.kind === "contribution_refund";

  function recipient(): Recipient | undefined {
    if (transfer) return undefined;
    if (form.recipient === "mobile") return { type: "mobile", phone: form.phone.trim() };
    if (form.recipient === "paybill")
      return { type: "paybill", paybill: form.paybill.trim(), ...(form.account_number.trim() && { account_number: form.account_number.trim() }) };
    return { type: "bank", bank_id: Number(form.bank_id), account_number: form.account_number.trim(), account_name: form.account_name.trim() };
  }
  const recipientReady =
    transfer ||
    (form.recipient === "mobile" && !!form.phone.trim()) ||
    (form.recipient === "paybill" && !!form.paybill.trim()) ||
    (form.recipient === "bank" && !!form.bank_id && !!form.account_number.trim() && !!form.account_name.trim());
  const ready =
    !!accountId &&
    isAmount(form.amount) &&
    recipientReady &&
    (transfer ? !!form.to_account_id && form.to_account_id !== accountId : refund ? !!form.member_id && !!form.contribution_id : !!form.expense_category_id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: WithdrawalRequestInput = {
      kind: form.kind,
      account_id: Number(accountId),
      amount: form.amount,
      ...(form.description.trim() && { description: form.description.trim() }),
      ...(transfer && { to_account_id: Number(form.to_account_id) }),
      ...(form.kind === "expense" && { expense_category_id: Number(form.expense_category_id) }),
      ...(refund && { member_id: Number(form.member_id), contribution_id: Number(form.contribution_id) }),
    };
    const r = recipient();
    if (r) body.recipient = r;
    const made = await create.mutateAsync(body).catch(() => null);
    if (made) {
      onClose();
      onCreated(made.id);
    }
  }

  return (
    <Dialog open onClose={onClose} title="New withdrawal request">
      <form onSubmit={submit} className="space-y-4">
        <InlineError error={create.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pay for" htmlFor="rq-kind">
            <select id="rq-kind" className="input" value={form.kind} onChange={(e) => set("kind")(e.target.value)}>
              {requestKinds.map((k) => (
                <option key={k} value={k}>
                  {k === "funds_transfer" ? "Transfer to another account" : withdrawalKindLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From account" htmlFor="rq-account">
            <select id="rq-account" className="input" value={accountId} onChange={(e) => set("account_id")(e.target.value)} required>
              {open.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatMoney(a.balance, currency)})
                </option>
              ))}
            </select>
          </Field>
        </div>
        {transfer && (
          <Field label="To account" htmlFor="rq-to">
            <select id="rq-to" className="input" value={form.to_account_id} onChange={(e) => set("to_account_id")(e.target.value)} required>
              <option value="">Choose…</option>
              {open
                .filter((a) => String(a.id) !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {form.kind === "expense" && (
          <Field label="Expense category" htmlFor="rq-expense">
            <select id="rq-expense" className="input" value={form.expense_category_id} onChange={(e) => set("expense_category_id")(e.target.value)} required>
              <option value="">Choose…</option>
              {expenses.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {refund && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Member" htmlFor="rq-member">
              <select id="rq-member" className="input" value={form.member_id} onChange={(e) => set("member_id")(e.target.value)} required>
                <option value="">Choose a member…</option>
                {members.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {fullName(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From contribution" htmlFor="rq-contribution">
              <select id="rq-contribution" className="input" value={form.contribution_id} onChange={(e) => set("contribution_id")(e.target.value)} required>
                <option value="">Choose…</option>
                {contributions.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {!transfer && (
          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <legend className="px-1 text-sm font-medium">Pay to</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(["mobile", "paybill", "bank"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input type="radio" name="rq-recipient" className="accent-brand-700" checked={form.recipient === t} onChange={() => set("recipient")(t)} />
                  {{ mobile: "Mobile money", paybill: "Paybill", bank: "Bank account" }[t]}
                </label>
              ))}
            </div>
            {form.recipient === "mobile" && (
              <Field label="Phone number" htmlFor="rq-phone">
                <input id="rq-phone" className="input" inputMode="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} required />
              </Field>
            )}
            {form.recipient === "paybill" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Paybill number" htmlFor="rq-paybill">
                  <input id="rq-paybill" className="input" inputMode="numeric" value={form.paybill} onChange={(e) => set("paybill")(e.target.value)} required />
                </Field>
                <Field label="Account number (optional)" htmlFor="rq-pb-account">
                  <input id="rq-pb-account" className="input" value={form.account_number} onChange={(e) => set("account_number")(e.target.value)} />
                </Field>
              </div>
            )}
            {form.recipient === "bank" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Bank" htmlFor="rq-bank">
                  <select id="rq-bank" className="input" value={form.bank_id} onChange={(e) => set("bank_id")(e.target.value)} required>
                    <option value="">Choose…</option>
                    {banks.data?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Account number" htmlFor="rq-bank-account">
                  <input id="rq-bank-account" className="input" value={form.account_number} onChange={(e) => set("account_number")(e.target.value)} required />
                </Field>
                <Field label="Account name" htmlFor="rq-bank-name">
                  <input id="rq-bank-name" className="input" value={form.account_name} onChange={(e) => set("account_name")(e.target.value)} required />
                </Field>
              </div>
            )}
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Amount (${currency})`} htmlFor="rq-amount">
            <input
              id="rq-amount"
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              pattern="\d+(\.\d{1,2})?"
              value={form.amount}
              onChange={(e) => set("amount")(e.target.value.trim())}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Reason" htmlFor="rq-desc">
              <input id="rq-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
            </Field>
          </div>
        </div>
        <p className="text-xs text-slate-500">Every signatory has to approve. Your own approval counts straight away.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!ready || create.isPending}>
            {create.isPending ? "Sending…" : "Send for approval"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const decisionIcons = { approved: Check, declined: X, pending: Clock };

export function RequestDialog({
  groupId,
  id,
  currency,
  managing,
  onClose,
}: {
  groupId: number;
  id: number;
  currency: string;
  managing: boolean;
  onClose: () => void;
}) {
  const detail = useWithdrawalRequest(groupId, id);
  const act = useRequestAction(groupId, id);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [pay, setPay] = useState({ date: todayISO(), method: "" as PaymentMethod | "" });
  const r = detail.data;

  async function run(body: Parameters<typeof act.mutateAsync>[0]) {
    if (await act.mutateAsync(body).catch(() => null)) {
      setPassword("");
      setDeclining(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={r ? `${withdrawalKindLabels[r.kind]}: ${formatMoney(r.amount, currency)}` : "Withdrawal request"}>
      {detail.isPending ? (
        <Spinner />
      ) : detail.isError ? (
        <ErrorState error={detail.error} />
      ) : (
        r && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTones[r.status]}>{requestStatusLabels[r.status]}</Badge>
              <span className="text-xs text-slate-500">Ref {r.reference_number || r.id}</span>
            </div>
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="text-slate-500">From</dt>
              <dd>{r.account?.name ?? "—"}</dd>
              {r.to_account && (
                <>
                  <dt className="text-slate-500">To</dt>
                  <dd>{r.to_account.name}</dd>
                </>
              )}
              {(r.expense_category || r.member) && (
                <>
                  <dt className="text-slate-500">For</dt>
                  <dd>{[r.expense_category?.name, r.member?.name, r.contribution?.name].filter(Boolean).join(" · ")}</dd>
                </>
              )}
              {r.recipient.type && (
                <>
                  <dt className="text-slate-500">Pay to</dt>
                  <dd>{recipientText(r.recipient)}</dd>
                </>
              )}
              {r.description && (
                <>
                  <dt className="text-slate-500">Reason</dt>
                  <dd>{r.description}</dd>
                </>
              )}
              <dt className="text-slate-500">Asked by</dt>
              <dd>
                {r.requested_by?.name ?? "—"} on {formatDateTime(r.created_at)}
              </dd>
              {r.decline_reason && (
                <>
                  <dt className="text-slate-500">{r.status === "cancelled" ? "Cancelled" : "Declined"}</dt>
                  <dd>{r.decline_reason}</dd>
                </>
              )}
            </dl>
            <div>
              <p className="mb-2 font-medium">
                Signatories ({r.approvals} of {r.signatories} approved)
              </p>
              <ul className="space-y-1.5">
                {r.approval_list.map((a) => {
                  const Icon = decisionIcons[a.decision];
                  return (
                    <li key={a.member_id} className="flex flex-wrap items-center gap-2">
                      <Icon
                        className={cx(
                          "size-4",
                          a.decision === "approved" ? "text-emerald-600" : a.decision === "declined" ? "text-rose-600" : "text-slate-400",
                        )}
                        aria-label={a.decision}
                      />
                      <span>{a.name}</span>
                      {a.role && <span className="text-xs text-slate-500">{a.role}</span>}
                      {a.comment && <span className="text-xs text-slate-500">“{a.comment}”</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
            <InlineError error={act.error} />

            {r.status === "pending" && r.my_decision === "pending" && (
              <form
                className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(declining ? { action: "decline", password, reason: reason.trim() } : { action: "approve", password });
                }}
              >
                <p className="font-medium">Your answer</p>
                {declining && (
                  <Field label="Why are you declining?" htmlFor="rq-reason">
                    <input id="rq-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required />
                  </Field>
                )}
                <Field label="Your password" htmlFor="rq-password" hint="Confirms it is you.">
                  <input id="rq-password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
                <div className="flex flex-wrap justify-end gap-2">
                  {declining ? (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => setDeclining(false)}>
                        Back
                      </button>
                      <button type="submit" className="btn-primary bg-rose-700 hover:bg-rose-800" disabled={!password || !reason.trim() || act.isPending}>
                        Decline
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => setDeclining(true)}>
                        Decline…
                      </button>
                      <button type="submit" className="btn-primary" disabled={!password || act.isPending}>
                        {act.isPending ? "Saving…" : "Approve"}
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

            {managing && r.status === "approved" && (
              <form
                className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  run({ action: "pay", date: pay.date, ...(pay.method && { method: pay.method }) });
                }}
              >
                <p className="font-medium">Record the payment</p>
                <p className="text-xs text-slate-500">Once the money has gone out, record it here. It goes into the cash book.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Paid on" htmlFor="rq-paid">
                    <input id="rq-paid" type="date" className="input" max={todayISO()} value={pay.date} onChange={(e) => setPay((p) => ({ ...p, date: e.target.value }))} required />
                  </Field>
                  {r.kind !== "funds_transfer" && (
                    <Field label="Method" htmlFor="rq-method">
                      <select id="rq-method" className="input" value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value as PaymentMethod | "" }))}>
                        <option value="">—</option>
                        {Object.entries(methodLabels).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary" disabled={act.isPending}>
                    Mark as paid
                  </button>
                </div>
              </form>
            )}

            <div className="flex justify-between gap-2 pt-1">
              <span>
                {managing && (r.status === "pending" || r.status === "approved") && (
                  <button type="button" className="btn-ghost text-rose-700 dark:text-rose-400" disabled={act.isPending} onClick={() => run({ action: "cancel" })}>
                    Cancel request
                  </button>
                )}
              </span>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )
      )}
    </Dialog>
  );
}
