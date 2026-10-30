import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import { useContribution, useGroup, useMembers, useSaveContribution, type ContributionInput } from "../api/hooks";
import type { Contribution, ContributionCategory, ContributionKind, Frequency } from "../api/types";
import { useGroupId } from "../components/AppShell";
import { Badge, ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../components/ui";
import { categoryLabels, formatDate, formatMoney, frequencyLabels, fullName, kindLabels } from "../lib/format";

/** ContributionPage shows a contribution; officials edit it in place. "new" creates one. */
export function ContributionPage() {
  const groupId = useGroupId();
  const raw = useParams().contributionId;
  const isNew = raw === "new";
  const id = isNew ? 0 : Number(raw);
  const group = useGroup(groupId);
  const c = useContribution(groupId, id, !isNew);
  const [editing, setEditing] = useState(false);

  if (!group.data || (!isNew && c.isPending)) return <Spinner />;
  if (!isNew && c.isError) return <ErrorState error={c.error} />;
  const official = group.data.is_official;
  const back = (
    <Link to={`/g/${groupId}/contributions`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
      <ChevronLeft className="size-4" aria-hidden /> Contributions
    </Link>
  );

  if (isNew || editing) {
    if (!official) return <ErrorState error={new Error("Only group officials can change contributions.")} />;
    return (
      <>
        {back}
        <PageHeader title={isNew ? "New contribution" : `Edit ${c.data?.name}`} />
        <ContributionForm groupId={groupId} existing={isNew ? undefined : c.data} onDone={() => setEditing(false)} />
      </>
    );
  }
  const d = c.data!;
  return (
    <>
      {back}
      <PageHeader
        title={d.name}
        subtitle={[kindLabels[d.kind], d.category && categoryLabels[d.category]].filter(Boolean).join(" · ")}
        actions={
          official && (
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
          )
        }
      />
      <ContributionDetails c={d} currency={group.data.currency} groupId={groupId} />
    </>
  );
}

function ContributionDetails({ c, currency, groupId }: { c: Contribution; currency: string; groupId: number }) {
  const members = useMembers(groupId, "all");
  const s = c.schedule;
  const rows: [string, React.ReactNode][] = [
    ["Amount", <span className="text-lg font-semibold tabular-nums">{formatMoney(c.amount, currency)}</span>],
    ["Status", c.is_active ? <Badge tone="brand">Active</Badge> : <Badge tone="warn">Inactive</Badge>],
    ["Applies to", c.applies_to_all_members ? "All members" : selectedLabel(c.member_ids?.length ?? 0)],
  ];
  if (s) {
    if (s.frequency) rows.push(["Frequency", frequencyLabels[s.frequency]]);
    rows.push(["Contribution date", formatDate(s.contribution_date)]);
    rows.push(["Invoice date", formatDate(s.invoice_date)]);
    rows.push(["Invoicing", s.invoicing_active ? "On" : "Off"]);
    rows.push(["Fines", s.fines_enabled ? "Enabled" : "Off"]);
    rows.push(["Notifications", [s.sms_notifications && "SMS", s.email_notifications && "Email"].filter(Boolean).join(", ") || "None"]);
  }
  const selected = new Set(c.member_ids ?? []);
  return (
    <div className="space-y-6">
      <dl className="card grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-medium text-slate-500 uppercase">{k}</dt>
            <dd className="mt-1 text-sm">{v}</dd>
          </div>
        ))}
      </dl>
      {c.fine_rules && c.fine_rules.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Fines</h2>
          <ul className="space-y-2 text-sm">
            {c.fine_rules.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.kind === "fixed" ? formatMoney(f.fixed_amount, currency) : `${f.percentage_rate}%`}</span>
                <span className="text-slate-500">{describeChargeable(f.chargeable_on)}</span>
                {!f.is_active && <Badge tone="warn">Off</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!c.applies_to_all_members && members.data && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Members who pay this</h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {members.data
              .filter((m) => selected.has(m.id))
              .map((m) => (
                <li key={m.id}>{fullName(m)}</li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function selectedLabel(n: number): string {
  return `${n} selected member${n === 1 ? "" : "s"}`;
}

function describeChargeable(v: string): string {
  if (v === "last_day_of_the_month") return "charged on the last day of the month";
  if (v === "first_day_of_the_month") return "charged on the first day of the month";
  const n = Number(v);
  if (n > 0) return `charged ${n} day${n === 1 ? "" : "s"} after the contribution date`;
  return v ? `charged: ${v}` : "";
}

const frequencies = Object.keys(frequencyLabels) as Frequency[];

function ContributionForm({ groupId, existing, onDone }: { groupId: number; existing?: Contribution; onDone: () => void }) {
  const save = useSaveContribution(groupId, existing?.id);
  const members = useMembers(groupId, "active");
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: existing?.name ?? "",
    kind: (existing?.kind ?? "regular") as ContributionKind,
    category: (existing?.category ?? "") as ContributionCategory | "",
    amount: existing?.amount ?? "",
    is_active: existing?.is_active ?? true,
    is_hidden: existing?.is_hidden ?? false,
    all: existing?.applies_to_all_members ?? true,
    member_ids: new Set(existing?.member_ids ?? []),
    frequency: (existing?.schedule?.frequency ?? "monthly") as Frequency,
    contribution_date: existing?.schedule?.contribution_date ?? "",
    invoice_date: existing?.schedule?.invoice_date ?? "",
    invoicing_active: existing?.schedule?.invoicing_active ?? true,
    fines_enabled: existing?.schedule?.fines_enabled ?? false,
    sms: existing?.schedule?.sms_notifications ?? false,
    email: existing?.schedule?.email_notifications ?? false,
  });
  const upd = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const scheduled = f.kind !== "non_scheduled";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input: ContributionInput = {
      name: f.name.trim(),
      amount: f.amount.trim(),
      is_active: f.is_active,
      is_hidden: f.is_hidden,
      applies_to_all_members: f.all,
      member_ids: f.all ? [] : [...f.member_ids],
    };
    if (!existing) input.kind = f.kind;
    if (f.category) input.category = f.category;
    if (scheduled && f.contribution_date) {
      input.schedule = {
        frequency: f.kind === "regular" ? f.frequency : null,
        contribution_date: f.contribution_date,
        invoice_date: f.invoice_date || null,
        invoicing_active: f.invoicing_active,
        fines_enabled: f.fines_enabled,
        sms_notifications: f.sms,
        email_notifications: f.email,
      };
    }
    const saved = await save.mutateAsync(input).catch(() => null);
    if (!saved) return;
    if (existing) onDone();
    else navigate(`/g/${groupId}/contributions/${saved.id}`, { replace: true });
  }

  return (
    <form onSubmit={submit} className="card max-w-3xl space-y-6 p-6">
      <InlineError error={save.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="cf-name">
          <input id="cf-name" className="input" value={f.name} onChange={(e) => upd("name", e.target.value)} required />
        </Field>
        <Field label="Amount" htmlFor="cf-amount" hint="Per member, per period.">
          <input id="cf-amount" className="input" inputMode="decimal" placeholder="1000.00" value={f.amount} onChange={(e) => upd("amount", e.target.value)} required />
        </Field>
        <Field label="Type" htmlFor="cf-kind" hint={existing ? "The type can't be changed after creation." : undefined}>
          <select id="cf-kind" className="input" value={f.kind} disabled={!!existing} onChange={(e) => upd("kind", e.target.value as ContributionKind)}>
            {Object.entries(kindLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category" htmlFor="cf-category">
          <select id="cf-category" className="input" value={f.category} onChange={(e) => upd("category", e.target.value as ContributionCategory)}>
            <option value="">None</option>
            {Object.entries(categoryLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {scheduled && (
        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <legend className="px-1 text-sm font-semibold">Schedule</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {f.kind === "regular" && (
              <Field label="Frequency" htmlFor="cf-frequency">
                <select id="cf-frequency" className="input" value={f.frequency} onChange={(e) => upd("frequency", e.target.value as Frequency)}>
                  {frequencies.map((k) => (
                    <option key={k} value={k}>
                      {frequencyLabels[k]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={f.kind === "regular" ? "Next contribution date" : "Contribution date"} htmlFor="cf-cdate">
              <input id="cf-cdate" type="date" className="input" value={f.contribution_date} onChange={(e) => upd("contribution_date", e.target.value)} required={f.kind === "regular"} />
            </Field>
            <Field label="Invoice date" htmlFor="cf-idate">
              <input id="cf-idate" type="date" className="input" value={f.invoice_date} max={f.contribution_date || undefined} onChange={(e) => upd("invoice_date", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle id="cf-invoicing" label="Send invoices" checked={f.invoicing_active} onChange={(v) => upd("invoicing_active", v)} />
            <Toggle id="cf-fines" label="Charge late fines" checked={f.fines_enabled} onChange={(v) => upd("fines_enabled", v)} />
            <Toggle id="cf-sms" label="SMS reminders" checked={f.sms} onChange={(v) => upd("sms", v)} />
            <Toggle id="cf-email" label="Email reminders" checked={f.email} onChange={(v) => upd("email", v)} />
          </div>
        </fieldset>
      )}

      <div className="space-y-3">
        <Toggle id="cf-active" label="Active" hint="Inactive contributions stop invoicing but keep their history." checked={f.is_active} onChange={(v) => upd("is_active", v)} />
        <Toggle id="cf-hidden" label="Hidden from members" hint="Only officials will see it." checked={f.is_hidden} onChange={(v) => upd("is_hidden", v)} />
        <Toggle id="cf-all" label="Applies to every member" checked={f.all} onChange={(v) => upd("all", v)} />
      </div>
      {!f.all && (
        <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <legend className="px-1 text-sm font-semibold">Members who pay this ({f.member_ids.size})</legend>
          <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {members.data?.map((m) => (
              <Toggle
                key={m.id}
                id={`cf-m-${m.id}`}
                label={fullName(m)}
                checked={f.member_ids.has(m.id)}
                onChange={(v) => {
                  const next = new Set(f.member_ids);
                  if (v) next.add(m.id);
                  else next.delete(m.id);
                  upd("member_ids", next);
                }}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button type="button" className="btn-secondary" onClick={() => (existing ? onDone() : navigate(-1))}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending || !f.name.trim() || !f.amount.trim()}>
          {save.isPending ? "Saving…" : existing ? "Save changes" : "Create contribution"}
        </button>
      </div>
    </form>
  );
}
