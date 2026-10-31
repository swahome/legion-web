import { useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { useGroup } from "../../api/hooks";
import {
  feeText,
  fineFrequencyLabels,
  fineText,
  frequencyLabels,
  interestText,
  interestTypeLabels,
  rateOnLabels,
  ratePerLabels,
  termText,
  useDeleteLoanType,
  useLoanTypes,
  useSaveLoanType,
  type FineRule,
  type Frequency,
  type InterestType,
  type LoanType,
  type LoanTypeInput,
  type ProcessingFee,
  type RatePer,
} from "../../api/loans";
import { useGroupId, useManaging } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../../components/ui";
import { formatMoney } from "../../lib/format";
import { Confirm } from "../admin/widgets";
import { OfficialsOnly } from "../money/shared";

/** LoanTypesPage is where officials set the group's loan products. */
export function LoanTypesPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const types = useLoanTypes(groupId, true);
  const [editing, setEditing] = useState<LoanType | "new" | null>(null);

  if (!group.data) return <Spinner />;
  if (!managing) return <OfficialsOnly />;
  const currency = group.data.currency;

  return (
    <>
      <PageHeader
        title="Loan types"
        subtitle="The loans members can apply for: interest, term, limits, guarantors, fines and fees. A loan keeps the terms it was given."
        actions={
          <button className="btn-primary" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> New loan type
          </button>
        }
      />
      {types.isPending ? (
        <Spinner label="Loading loan types" />
      ) : types.isError ? (
        <ErrorState error={types.error} onRetry={() => types.refetch()} />
      ) : types.data.length === 0 ? (
        <div className="card">
          <EmptyState title="No loan types yet">Add one so members can apply for loans.</EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {types.data.map((t) => (
            <article key={t.id} className="card p-5 text-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">
                  {t.name} {t.is_hidden && <Badge>Hidden</Badge>}
                </h2>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(t)}>
                  <Pencil className="size-3.5" aria-hidden /> Edit
                </button>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                <dt className="text-slate-500">Interest</dt>
                <dd>{t.interest_type === "fixed_amount" ? `${formatMoney(t.fixed_interest, currency)} fixed` : interestText(t)}</dd>
                <dt className="text-slate-500">Term</dt>
                <dd>
                  {termText(t)}, repaid {frequencyLabels[t.frequency].toLowerCase()}
                </dd>
                <dt className="text-slate-500">Amount</dt>
                <dd>
                  {t.amount_basis === "savings"
                    ? `Up to ${Number(t.savings_multiple)} times the member's savings`
                    : `${formatMoney(t.min_amount, currency)} to ${formatMoney(t.max_amount, currency)}`}
                </dd>
                <dt className="text-slate-500">Guarantors</dt>
                <dd>
                  {t.guarantors === "none"
                    ? "Not needed"
                    : `${t.min_guarantors ?? 1}${t.max_guarantors ? ` to ${t.max_guarantors}` : ""}${t.guarantors === "over_max" ? ", over the member's limit" : ""}`}
                </dd>
                <dt className="text-slate-500">Late fine</dt>
                <dd>{fineText(t.late_fine, currency)}</dd>
                <dt className="text-slate-500">Balance fine</dt>
                <dd>{fineText(t.balance_fine, currency)}</dd>
                <dt className="text-slate-500">Processing fee</dt>
                <dd>{feeText(t.processing_fee, currency)}</dd>
                <dt className="text-slate-500">Approval</dt>
                <dd>{t.needs_approval ? "Signatories approve applications" : "Applications go straight to an official"}</dd>
              </dl>
            </article>
          ))}
        </div>
      )}
      {editing && <LoanTypeDialog groupId={groupId} currency={currency} type={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const blank: LoanTypeInput = {
  name: "",
  interest_type: "fixed_balance",
  interest_rate: 0,
  rate_per: "month",
  reducing_method: "equal_installments",
  fixed_interest: "0",
  fixed_interest_rate: 0,
  frequency: "monthly",
  fixed_term: null,
  min_term: 1,
  max_term: 12,
  grace_periods: 1,
  amount_basis: "range",
  min_amount: "",
  max_amount: "",
  savings_multiple: null,
  guarantors: "none",
  min_guarantors: null,
  max_guarantors: null,
  late_fine: null,
  balance_fine: null,
  processing_fee: null,
  fine_deferment: false,
  needs_approval: true,
  is_hidden: false,
};

function LoanTypeDialog({ groupId, currency, type, onClose }: { groupId: number; currency: string; type: LoanType | null; onClose: () => void }) {
  const save = useSaveLoanType(groupId, type?.id);
  const remove = useDeleteLoanType(groupId);
  const [deleting, setDeleting] = useState(false);
  const [t, setT] = useState<LoanTypeInput>(() => (type ? { ...type } : blank));
  const [fixedTerm, setFixedTerm] = useState(type ? type.fixed_term != null : false);
  const set = <K extends keyof LoanTypeInput>(k: K) => (v: LoanTypeInput[K]) => setT((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: LoanTypeInput = {
      ...t,
      name: t.name.trim(),
      fixed_term: fixedTerm ? t.fixed_term : null,
      min_term: fixedTerm ? null : t.min_term,
      max_term: fixedTerm ? null : t.max_term,
      min_amount: t.amount_basis === "range" ? t.min_amount : null,
      max_amount: t.amount_basis === "range" ? t.max_amount : null,
      savings_multiple: t.amount_basis === "savings" ? t.savings_multiple : null,
      min_guarantors: t.guarantors === "none" ? null : t.min_guarantors,
      max_guarantors: t.guarantors === "none" ? null : t.max_guarantors,
    };
    if (await save.mutateAsync(body).catch(() => null)) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={type ? `Edit ${type.name}` : "New loan type"}>
      <form onSubmit={submit} className="space-y-5">
        <InlineError error={save.error} />
        <Field label="Name" htmlFor="lt-name">
          <input id="lt-name" className="input" value={t.name} onChange={(e) => set("name")(e.target.value)} required />
        </Field>

        <fieldset className="space-y-3">
          <legend className="label">Interest</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input" aria-label="Interest type" value={t.interest_type} onChange={(e) => set("interest_type")(e.target.value as InterestType)}>
              {Object.entries(interestTypeLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            {t.interest_type === "fixed_amount" ? (
              <input
                className="input sm:col-span-2"
                aria-label={`Fixed interest (${currency})`}
                placeholder={`Interest (${currency})`}
                inputMode="decimal"
                value={t.fixed_interest ?? ""}
                onChange={(e) => set("fixed_interest")(e.target.value)}
                required
              />
            ) : (
              <>
                <input
                  className="input"
                  aria-label="Interest rate (%)"
                  placeholder="Rate %"
                  inputMode="decimal"
                  value={t.interest_rate || ""}
                  onChange={(e) => set("interest_rate")(Number(e.target.value) || 0)}
                />
                <select className="input" aria-label="Rate per" value={t.rate_per} onChange={(e) => set("rate_per")(e.target.value as RatePer)}>
                  {Object.entries(ratePerLabels).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="label">Term</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input" aria-label="Repayment frequency" value={t.frequency} onChange={(e) => set("frequency")(e.target.value as Frequency)}>
              {Object.entries(frequencyLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select className="input" aria-label="Term type" value={fixedTerm ? "fixed" : "range"} onChange={(e) => setFixedTerm(e.target.value === "fixed")}>
              <option value="range">Term range</option>
              <option value="fixed">Fixed term</option>
            </select>
            {fixedTerm ? (
              <input className="input" aria-label="Installments" placeholder="Installments" inputMode="numeric" value={t.fixed_term ?? ""} onChange={(e) => set("fixed_term")(num(e.target.value))} required />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input className="input" aria-label="Fewest installments" placeholder="Min" inputMode="numeric" value={t.min_term ?? ""} onChange={(e) => set("min_term")(num(e.target.value))} />
                <input className="input" aria-label="Most installments" placeholder="Max" inputMode="numeric" value={t.max_term ?? ""} onChange={(e) => set("max_term")(num(e.target.value))} />
              </div>
            )}
          </div>
          <Field label="Periods before the first installment is due" htmlFor="lt-grace">
            <input id="lt-grace" className="input w-28" inputMode="numeric" value={t.grace_periods} onChange={(e) => set("grace_periods")(Number(e.target.value) || 0)} />
          </Field>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="label">Amount</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input" aria-label="Amount limit" value={t.amount_basis} onChange={(e) => set("amount_basis")(e.target.value as "range" | "savings")}>
              <option value="range">Range</option>
              <option value="savings">× savings</option>
            </select>
            {t.amount_basis === "range" ? (
              <>
                <input className="input" aria-label={`Smallest loan (${currency})`} placeholder="Smallest" inputMode="decimal" value={t.min_amount ?? ""} onChange={(e) => set("min_amount")(e.target.value)} required />
                <input className="input" aria-label={`Largest loan (${currency})`} placeholder="Largest" inputMode="decimal" value={t.max_amount ?? ""} onChange={(e) => set("max_amount")(e.target.value)} required />
              </>
            ) : (
              <input className="input" aria-label="Times savings" placeholder="Times savings" inputMode="decimal" value={t.savings_multiple ?? ""} onChange={(e) => set("savings_multiple")(e.target.value)} required />
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="label">Guarantors</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input" aria-label="Guarantors" value={t.guarantors} onChange={(e) => set("guarantors")(e.target.value as LoanType["guarantors"])}>
              <option value="none">Not needed</option>
              <option value="always">Always</option>
              <option value="over_max">Over limit</option>
            </select>
            {t.guarantors !== "none" && (
              <>
                <input className="input" aria-label="Fewest guarantors" placeholder="Min" inputMode="numeric" value={t.min_guarantors ?? ""} onChange={(e) => set("min_guarantors")(num(e.target.value))} required />
                <input className="input" aria-label="Most guarantors" placeholder="Max" inputMode="numeric" value={t.max_guarantors ?? ""} onChange={(e) => set("max_guarantors")(num(e.target.value))} />
              </>
            )}
          </div>
        </fieldset>

        <FineEditor label="Late payment fine" currency={currency} value={t.late_fine} onChange={set("late_fine")} late />
        <FineEditor label="Outstanding balance fine" currency={currency} value={t.balance_fine} onChange={set("balance_fine")} />
        <FeeEditor currency={currency} value={t.processing_fee} onChange={set("processing_fee")} />

        <div className="space-y-3">
          <Toggle id="lt-approval" label="Signatories approve applications" checked={t.needs_approval} onChange={set("needs_approval")} />
          <Toggle id="lt-defer" label="Repayments settle installments before fines" checked={t.fine_deferment} onChange={set("fine_deferment")} />
          <Toggle id="lt-hidden" label="Hidden from members" hint="Officials can still record loans of this type." checked={t.is_hidden} onChange={set("is_hidden")} />
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <span>
            {type && (
              <button type="button" className="btn-ghost text-rose-700 dark:text-rose-400" onClick={() => setDeleting(true)}>
                Delete
              </button>
            )}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!t.name.trim() || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </span>
        </div>
      </form>
      <Confirm
        open={deleting}
        title={`Delete ${type?.name}?`}
        action="Delete"
        danger
        pending={remove.isPending}
        error={remove.error}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          if (type && (await remove.mutateAsync(type.id).then(() => true).catch(() => false))) onClose();
        }}
      >
        <p>Members can no longer apply for it. Loans already recorded keep their terms.</p>
      </Confirm>
    </Dialog>
  );
}

function FineEditor({
  label,
  currency,
  value,
  onChange,
  late,
}: {
  label: string;
  currency: string;
  value: FineRule | null;
  onChange: (v: FineRule | null) => void;
  late?: boolean;
}) {
  const id = late ? "lf" : "bf";
  const patch = (p: Partial<FineRule>) => value && onChange({ ...value, ...p });
  return (
    <fieldset className="space-y-3">
      <Toggle
        id={`${id}-on`}
        label={label}
        checked={!!value}
        onChange={(on) => onChange(on ? { kind: "fixed", amount: "", frequency: late ? "once" : "monthly", ...(late && { scope: "installment" as const }) } : null)}
      />
      {value && (
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="input" aria-label={`${label}: kind`} value={value.kind} onChange={(e) => patch({ kind: e.target.value as FineRule["kind"] })}>
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage</option>
          </select>
          {value.kind === "fixed" ? (
            <input className="input" aria-label={`${label}: amount (${currency})`} placeholder={currency} inputMode="decimal" value={value.amount ?? ""} onChange={(e) => patch({ amount: e.target.value })} required />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input className="input" aria-label={`${label}: rate (%)`} placeholder="%" inputMode="decimal" value={value.rate ?? ""} onChange={(e) => patch({ rate: Number(e.target.value) || 0 })} required />
              <select className="input" aria-label={`${label}: of`} value={value.rate_on ?? "installment_balance"} onChange={(e) => patch({ rate_on: e.target.value as FineRule["rate_on"] })}>
                {Object.entries(rateOnLabels).map(([k, l]) => (
                  <option key={k} value={k}>
                    of {l}
                  </option>
                ))}
              </select>
            </div>
          )}
          <select className="input" aria-label={`${label}: how often`} value={value.frequency} onChange={(e) => patch({ frequency: e.target.value as FineRule["frequency"] })}>
            {Object.entries(fineFrequencyLabels).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
}

function FeeEditor({ currency, value, onChange }: { currency: string; value: ProcessingFee | null; onChange: (v: ProcessingFee | null) => void }) {
  const patch = (p: Partial<ProcessingFee>) => value && onChange({ ...value, ...p });
  return (
    <fieldset className="space-y-3">
      <Toggle id="pf-on" label="Processing fee" checked={!!value} onChange={(on) => onChange(on ? { kind: "fixed", amount: "" } : null)} />
      {value && (
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="input" aria-label="Processing fee: kind" value={value.kind} onChange={(e) => patch({ kind: e.target.value as ProcessingFee["kind"] })}>
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage</option>
          </select>
          {value.kind === "fixed" ? (
            <input className="input" aria-label={`Processing fee (${currency})`} placeholder={currency} inputMode="decimal" value={value.amount ?? ""} onChange={(e) => patch({ amount: e.target.value })} required />
          ) : (
            <>
              <input className="input" aria-label="Processing fee rate (%)" placeholder="%" inputMode="decimal" value={value.rate ?? ""} onChange={(e) => patch({ rate: Number(e.target.value) || 0 })} required />
              <select className="input" aria-label="Processing fee: of" value={value.on ?? "amount"} onChange={(e) => patch({ on: e.target.value as ProcessingFee["on"] })}>
                <option value="amount">of the amount</option>
                <option value="amount_plus_interest">of the amount plus interest</option>
              </select>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}
