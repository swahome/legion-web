import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Check, Clock, Plus, X } from "lucide-react";
import { useGroup, useMembers } from "../../api/hooks";
import {
  applicationStatusLabels,
  interestText,
  periodWords,
  termText,
  useApplicationAction,
  useApplyForLoan,
  useLoanApplication,
  useLoanApplications,
  useLoanTypes,
  usePreviewLoan,
  type ApplicationAction,
  type ApplicationStatus,
  type GuarantorInput,
} from "../../api/loans";
import { methodLabels, useAccounts, type PaymentMethod } from "../../api/money";
import { useGroupBase, useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, cx } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { Pager, formatDateTime, tbody, theadRow } from "../admin/widgets";
import { isAmount, todayISO } from "../money/shared";
import { GuarantorRows } from "./LoansPage";
import { ScheduleTable } from "./ScheduleTable";

const statusTones: Record<ApplicationStatus, "neutral" | "brand" | "warn" | "danger"> = {
  pending_guarantors: "warn",
  pending_approval: "warn",
  approved: "brand",
  disbursed: "neutral",
  declined: "danger",
  cancelled: "neutral",
};

const decisionIcons = { pending: Clock, approved: Check, declined: X };

/**
 * LoanApplicationsPage: members apply for loans; guarantors and signatories
 * answer; an official pays approved applications out.
 */
export function LoanApplicationsPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const [view, setView] = useState<"me" | "all">("all");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = useLoanApplications(groupId, { status: status || undefined, awaiting: view === "me" ? "me" : undefined, page });
  const [applying, setApplying] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  if (!group.data) return <Spinner />;
  const currency = group.data.currency;
  const canApply = group.data.my_membership_id != null;

  return (
    <>
      <PageHeader
        title="Loan applications"
        subtitle={
          managing
            ? "Applications go to the guarantors, then the signatories. Pay out approved ones here."
            : "Apply for a loan, and answer applications that name you as a guarantor or signatory."
        }
        actions={
          canApply && (
            <button className="btn-primary" onClick={() => setApplying(true)}>
              <Plus className="size-4" aria-hidden /> Apply for a loan
            </button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {(["all", "me"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={cx("rounded-md px-3 py-1.5 text-sm font-medium", view === v ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500")}
              onClick={() => {
                setView(v);
                setPage(1);
              }}
            >
              {v === "all" ? (managing ? "All applications" : "Mine and ones I'm on") : "Waiting for my answer"}
            </button>
          ))}
        </div>
        <label className="text-sm">
          <span className="sr-only">Status</span>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any status</option>
            <option value="open">Still open</option>
            {Object.entries(applicationStatusLabels).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <Spinner label="Loading applications" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title={view === "me" ? "Nothing waiting for you" : "No applications"} />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Loan</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {list.data.items.map((a) => (
                <tr key={a.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => setOpenId(a.id)}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button className="font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => setOpenId(a.id)}>
                      {formatDate(a.created_at.slice(0, 10))}
                    </button>
                  </td>
                  <td className="px-4 py-3">{a.member.name}</td>
                  <td className="px-4 py-3">
                    {a.loan_type.name}
                    <span className="block text-xs text-slate-500">{a.installments} installments</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(a.amount, currency)}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusTones[a.status]}>{applicationStatusLabels[a.status]}</Badge>
                      {(a.awaiting_my_guarantee || a.awaiting_my_approval) && <Badge tone="brand">Your answer</Badge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
      {applying && (
        <ApplyDialog
          groupId={groupId}
          currency={currency}
          me={group.data.my_membership_id ?? 0}
          onClose={() => setApplying(false)}
          onDone={(id) => {
            setApplying(false);
            setOpenId(id);
          }}
        />
      )}
      {openId != null && <ApplicationDialog groupId={groupId} id={openId} currency={currency} onClose={() => setOpenId(null)} />}
    </>
  );
}

export function ApplyDialog({ groupId, currency, me, onClose, onDone }: { groupId: number; currency: string; me: number; onClose: () => void; onDone: (id: number) => void }) {
  const types = useLoanTypes(groupId);
  const members = useMembers(groupId, "active");
  const apply = useApplyForLoan(groupId);
  const [form, setForm] = useState({ type: "", amount: "", installments: "", description: "" });
  const [guarantors, setGuarantors] = useState<GuarantorInput[]>([]);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const type = types.data?.find((t) => String(t.id) === form.type);
  const installments = type?.fixed_term ?? (Number(form.installments) || 0);
  const ready = !!type && isAmount(form.amount) && installments > 0;
  const preview = usePreviewLoan(groupId, ready ? { loan_type_id: type.id, amount: form.amount, installments } : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!type) return;
    const r = await apply
      .mutateAsync({
        loan_type_id: type.id,
        amount: form.amount,
        ...(!type.fixed_term && { installments }),
        ...(form.description.trim() && { description: form.description.trim() }),
        guarantors: guarantors.filter((g) => g.member_id),
      })
      .catch(() => null);
    if (r) onDone(r.id);
  }

  return (
    <Dialog open onClose={onClose} title="Apply for a loan">
      {types.data && types.data.length === 0 ? (
        <EmptyState title="No loan types">The group's officials haven't set up any loans to apply for yet.</EmptyState>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <InlineError error={apply.error} />
          <Field label="Loan" htmlFor="la-type">
            <select id="la-type" className="input" value={form.type} onChange={(e) => set("type")(e.target.value)} required>
              <option value="">Choose a loan…</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {type && (
            <p className="text-sm text-slate-500">
              {interestText(type)}. {termText(type)}.
              {type.amount_basis === "range"
                ? ` ${formatMoney(type.min_amount, currency)} to ${formatMoney(type.max_amount, currency)}.`
                : ` Up to ${Number(type.savings_multiple)} times your savings.`}
              {type.guarantors !== "none" && ` Needs ${type.min_guarantors ?? 1} or more guarantors${type.guarantors === "over_max" ? " above your limit" : ""}.`}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Amount (${currency})`} htmlFor="la-amount">
              <input id="la-amount" className="input" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => set("amount")(e.target.value.trim())} required />
            </Field>
            <Field label={type ? `Repay over (${periodWords[type.frequency]})` : "Repay over"} htmlFor="la-inst">
              <input
                id="la-inst"
                className="input"
                inputMode="numeric"
                value={type?.fixed_term ? String(type.fixed_term) : form.installments}
                disabled={!!type?.fixed_term}
                onChange={(e) => set("installments")(e.target.value.replace(/\D/g, ""))}
                required
              />
            </Field>
          </div>
          {type && type.guarantors !== "none" && (
            <GuarantorRows members={members.data ?? []} exclude={me} rows={guarantors} onChange={setGuarantors} currency={currency} />
          )}
          <Field label="What is it for? (optional)" htmlFor="la-desc">
            <input id="la-desc" className="input" value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </Field>
          {ready && (preview.isError ? <InlineError error={preview.error} /> : preview.data && <ScheduleTable schedule={preview.data} currency={currency} compact />)}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!ready || apply.isPending}>
              {apply.isPending ? "Applying…" : "Apply"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ApplicationDialog({ groupId, id, currency, onClose }: { groupId: number; id: number; currency: string; onClose: () => void }) {
  const base = useGroupBase();
  const detail = useLoanApplication(groupId, id);
  const act = useApplicationAction(groupId, id);
  const accounts = useAccounts(groupId);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState<"guarantee" | "sign" | "cancel" | null>(null);
  const [pay, setPay] = useState({ account: "", date: todayISO(), method: "" as PaymentMethod | "", skipFee: false });
  const a = detail.data;

  async function run(body: ApplicationAction) {
    if (await act.mutateAsync(body).catch(() => null)) {
      setPassword("");
      setReason("");
      setDeclining(null);
    }
  }

  return (
    <Dialog open onClose={onClose} title={a ? `${a.loan_type.name}: ${formatMoney(a.amount, currency)}` : "Loan application"}>
      {detail.isPending ? (
        <Spinner />
      ) : detail.isError ? (
        <ErrorState error={detail.error} />
      ) : (
        a && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTones[a.status]}>{applicationStatusLabels[a.status]}</Badge>
              {a.loan_id && (
                <Link to={`${base}/loans/${a.loan_id}`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                  View the loan
                </Link>
              )}
            </div>
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="text-slate-500">Member</dt>
              <dd>{a.member.name}</dd>
              <dt className="text-slate-500">Applied</dt>
              <dd>{formatDateTime(a.created_at)}</dd>
              <dt className="text-slate-500">Term</dt>
              <dd>{a.installments} installments</dd>
              {a.description && (
                <>
                  <dt className="text-slate-500">For</dt>
                  <dd>{a.description}</dd>
                </>
              )}
              {a.decline_reason && (
                <>
                  <dt className="text-slate-500">{a.status === "cancelled" ? "Cancelled" : "Declined"}</dt>
                  <dd>{a.decline_reason}</dd>
                </>
              )}
            </dl>
            {a.guarantors.length > 0 && (
              <People
                title="Guarantors"
                rows={a.guarantors.map((g) => ({
                  id: g.member_id,
                  name: g.name,
                  decision: g.decision,
                  extra: [g.amount && formatMoney(g.amount, currency), g.reason && `“${g.reason}”`].filter(Boolean).join(" · "),
                }))}
              />
            )}
            {a.approval_list.length > 0 && (
              <People
                title="Signatories"
                rows={a.approval_list.map((s) => ({ id: s.member_id, name: s.name, decision: s.decision, extra: [s.role, s.comment && `“${s.comment}”`].filter(Boolean).join(" · ") }))}
              />
            )}
            {a.schedule && <ScheduleTable schedule={a.schedule} currency={currency} compact />}
            {a.schedule_problem && <p className="text-amber-700 dark:text-amber-300">This loan can't be paid out as it stands: {a.schedule_problem}</p>}
            <InlineError error={act.error} />

            {a.status === "pending_guarantors" && a.my_guarantee === "pending" && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="font-medium">{a.member.name} asks you to guarantee this loan</p>
                {declining === "guarantee" && (
                  <Field label="Why are you declining?" htmlFor="ap-greason">
                    <input id="ap-greason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                )}
                <div className="flex justify-end gap-2">
                  {declining === "guarantee" ? (
                    <>
                      <button className="btn-secondary" onClick={() => setDeclining(null)}>
                        Back
                      </button>
                      <button className="btn-primary bg-rose-700 hover:bg-rose-800" disabled={!reason.trim() || act.isPending} onClick={() => run({ action: "guarantee", approve: false, reason: reason.trim() })}>
                        Decline
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-secondary" onClick={() => setDeclining("guarantee")}>
                        Decline…
                      </button>
                      <button className="btn-primary" disabled={act.isPending} onClick={() => run({ action: "guarantee", approve: true })}>
                        Guarantee
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {a.status === "pending_approval" && a.my_decision === "pending" && (
              <form
                className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(declining === "sign" ? { action: "decline", password, reason: reason.trim() } : { action: "approve", password });
                }}
              >
                <p className="font-medium">Your answer as a signatory</p>
                {declining === "sign" && (
                  <Field label="Why are you declining?" htmlFor="ap-reason">
                    <input id="ap-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required />
                  </Field>
                )}
                <Field label="Your password" htmlFor="ap-password" hint="Confirms it is you.">
                  <input id="ap-password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
                <div className="flex justify-end gap-2">
                  {declining === "sign" ? (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => setDeclining(null)}>
                        Back
                      </button>
                      <button type="submit" className="btn-primary bg-rose-700 hover:bg-rose-800" disabled={!password || !reason.trim() || act.isPending}>
                        Decline
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => setDeclining("sign")}>
                        Decline…
                      </button>
                      <button type="submit" className="btn-primary" disabled={!password || act.isPending}>
                        Approve
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

            {a.can_disburse && (
              <form
                className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  run({
                    action: "disburse",
                    account_id: Number(pay.account),
                    disbursed_on: pay.date,
                    ...(pay.method && { method: pay.method }),
                    ...(pay.skipFee && { skip_processing_fee: true }),
                  });
                }}
              >
                <p className="font-medium">Pay out the loan</p>
                <p className="text-xs text-slate-500">Once the money has gone to {a.member.name}, record it here. The loan and its schedule start from that date.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="From" htmlFor="ap-account">
                    <select id="ap-account" className="input" value={pay.account} onChange={(e) => setPay((p) => ({ ...p, account: e.target.value }))} required>
                      <option value="">Choose…</option>
                      {(accounts.data?.accounts ?? [])
                        .filter((x) => !x.is_closed)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Paid on" htmlFor="ap-date">
                    <input id="ap-date" type="date" className="input" max={todayISO()} value={pay.date} onChange={(e) => setPay((p) => ({ ...p, date: e.target.value }))} required />
                  </Field>
                  <Field label="Method" htmlFor="ap-method">
                    <select id="ap-method" className="input" value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value as PaymentMethod | "" }))}>
                      <option value="">—</option>
                      {Object.entries(methodLabels).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {a.schedule && Number(a.schedule.processing_fee) > 0 && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-brand-700" checked={pay.skipFee} onChange={(e) => setPay((p) => ({ ...p, skipFee: e.target.checked }))} />
                    Don't charge the {formatMoney(a.schedule.processing_fee, currency)} processing fee
                  </label>
                )}
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary" disabled={!pay.account || act.isPending}>
                    Record payout
                  </button>
                </div>
              </form>
            )}

            {declining === "cancel" && (
              <Field label="Why is it declined?" htmlFor="ap-creason">
                <input id="ap-creason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
            <div className="flex justify-between gap-2 pt-1">
              <span className="flex gap-2">
                {a.can_cancel && (
                  <button className="btn-ghost text-rose-700 dark:text-rose-400" disabled={act.isPending} onClick={() => run({ action: "cancel" })}>
                    Withdraw application
                  </button>
                )}
                {!a.can_cancel && ["pending_guarantors", "pending_approval", "approved"].includes(a.status) && (
                  <OfficialDecline
                    open={declining === "cancel"}
                    pending={act.isPending}
                    ready={!!reason.trim()}
                    onOpen={() => setDeclining("cancel")}
                    onConfirm={() => run({ action: "cancel", reason: reason.trim() })}
                  />
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

/** OfficialDecline is shown to officials (the API refuses anyone else). */
function OfficialDecline({ open, pending, ready, onOpen, onConfirm }: { open: boolean; pending: boolean; ready: boolean; onOpen: () => void; onConfirm: () => void }) {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  if (!managing) return null;
  return open ? (
    <button className="btn-ghost text-rose-700 dark:text-rose-400" disabled={pending || !ready} onClick={onConfirm}>
      Decline application
    </button>
  ) : (
    <button className="btn-ghost text-rose-700 dark:text-rose-400" onClick={onOpen}>
      Decline…
    </button>
  );
}

function People({ title, rows }: { title: string; rows: { id: number; name: string; decision: "pending" | "approved" | "declined"; extra: string }[] }) {
  const done = rows.filter((r) => r.decision === "approved").length;
  return (
    <div>
      <p className="mb-2 font-medium">
        {title} ({done} of {rows.length} agreed)
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const Icon = decisionIcons[r.decision];
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <Icon
                className={cx("size-4", r.decision === "approved" ? "text-emerald-600" : r.decision === "declined" ? "text-rose-600" : "text-slate-400")}
                aria-label={r.decision}
              />
              <span>{r.name}</span>
              {r.extra && <span className="text-xs text-slate-500">{r.extra}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
