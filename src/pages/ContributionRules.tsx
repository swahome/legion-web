import { Plus, Trash2 } from "lucide-react";
import type { FineRuleInput } from "../api/hooks";
import { chargeableOptions, describeChargeable, fineFrequencyLabels, fineModeLabels, percentageOfLabels } from "../api/fines";
import type { FineRule, Frequency } from "../api/types";
import { Field, Toggle } from "../components/ui";
import { formatDate, formatMoney } from "../lib/format";

// The day picker and late-payment fine settings of a regular contribution.
// Both keep the legacy setting names and codes (see legion-api
// internal/billing), so imported contributions edit cleanly.

export const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ordinals: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 32: "last" };
const ordinalLabels: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 32: "Last" };

export type Rule = Record<string, string>;

const multiple: Frequency[] = ["bimonthly", "quarterly", "biannually", "annually"];

/** dayKeys says which rule fields a frequency uses. */
function dayKeys(frequency: Frequency): { day: string; weekday: string } | null {
  if (frequency === "monthly") return { day: "month_day_monthly", weekday: "week_day_monthly" };
  if (multiple.includes(frequency)) return { day: "month_day_multiple", weekday: "week_day_multiple" };
  return null;
}

function suffix(n: number): string {
  if (n % 10 === 1 && n !== 11) return "st";
  if (n % 10 === 2 && n !== 12) return "nd";
  if (n % 10 === 3 && n !== 13) return "rd";
  return "th";
}

/** describeRule says in words which day a schedule falls on. */
export function describeRule(frequency: Frequency | null, rule: Rule | undefined): string {
  if (!frequency || !rule) return "";
  if (frequency === "weekly") {
    const wd = Number(rule.week_day_weekly);
    return wd ? `Every ${weekdays[wd - 1]}` : "";
  }
  if (frequency === "twice_monthly") {
    const a = Number(rule.after_first_starting_day);
    const b = Number(rule.after_second_starting_day);
    return a && b ? `The ${a}${suffix(a)} and ${b}${suffix(b)} of the month` : "";
  }
  const k = dayKeys(frequency);
  if (!k) return "";
  const day = Number(rule[k.day] ?? 0);
  const wd = Number(rule[k.weekday] ?? 0);
  let text: string;
  if (wd && (day === 32 || (day >= 1 && day <= 4))) text = `The ${ordinals[day]} ${weekdays[wd - 1]}`;
  else if (day === 0 || day >= 32) text = "The last day";
  else text = `The ${day}${suffix(day)}`;
  if (multiple.includes(frequency)) {
    const sm = Number(rule.start_month_multiple ?? 1) || 1;
    text += `, starting in ${months[sm - 1]}`;
  } else text += " of the month";
  return text;
}

/** DayPicker edits which day of the month (or week) a regular contribution falls on. */
export function DayPicker({ frequency, rule, onChange }: { frequency: Frequency; rule: Rule; onChange: (r: Rule) => void }) {
  const set = (patch: Rule) => onChange({ ...rule, ...patch });
  if (frequency === "weekly") {
    return (
      <Field label="Day of the week" htmlFor="cf-weekday">
        <select id="cf-weekday" className="input" value={rule.week_day_weekly ?? ""} onChange={(e) => set({ week_day_weekly: e.target.value })}>
          <option value="">Same as the contribution date</option>
          {weekdays.map((w, i) => (
            <option key={w} value={i + 1}>
              {w}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  if (frequency === "twice_monthly") {
    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {(["after_first_starting_day", "after_second_starting_day"] as const).map((k, i) => (
          <Field key={k} label={i === 0 ? "First date" : "Second date"} htmlFor={`cf-${k}`}>
            <select id={`cf-${k}`} className="input" value={rule[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })}>
              <option value="">Choose…</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                  {suffix(d)} of the month
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
    );
  }
  const k = dayKeys(frequency);
  if (!k) return <p className="text-sm text-slate-500">{frequency === "fortnightly" ? "Every two weeks from the contribution date." : "Every day."}</p>;
  const wd = rule[k.weekday] && rule[k.weekday] !== "0" ? rule[k.weekday] : "";
  const day = rule[k.day] ?? "";
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Day" htmlFor="cf-day">
        <select id="cf-day" className="input" value={day} onChange={(e) => set({ [k.day]: e.target.value })}>
          <option value="">Choose…</option>
          {wd
            ? [1, 2, 3, 4, 32].map((n) => (
                <option key={n} value={n}>
                  {ordinalLabels[n]}
                </option>
              ))
            : [...Array.from({ length: 31 }, (_, i) => i + 1), 32].map((n) => (
                <option key={n} value={n}>
                  {n === 32 ? "Last day" : `${n}${suffix(n)}`}
                </option>
              ))}
        </select>
      </Field>
      <Field label="Of" htmlFor="cf-of">
        <select
          id="cf-of"
          className="input"
          value={wd}
          onChange={(e) => {
            const v = e.target.value;
            const d = Number(day);
            // An nth-weekday picker only has 1st to 4th and last.
            const fixDay = v && !(d === 32 || (d >= 1 && d <= 4)) ? { [k.day]: "1" } : {};
            set({ [k.weekday]: v || "0", ...fixDay });
          }}
        >
          <option value="">the month</option>
          {weekdays.map((w, i) => (
            <option key={w} value={i + 1}>
              {w} of the month
            </option>
          ))}
        </select>
      </Field>
      {multiple.includes(frequency) && (
        <Field label="Starting in" htmlFor="cf-start">
          <select id="cf-start" className="input" value={rule.start_month_multiple ?? "1"} onChange={(e) => set({ start_month_multiple: e.target.value })}>
            {months.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

export type FineDraft = Omit<FineRuleInput, "fixed_amount" | "percentage_rate" | "percentage_of"> & {
  fixed_amount: string;
  percentage_rate: string;
  percentage_of: string;
};

export function toDraft(f: FineRule): FineDraft {
  return {
    id: f.id,
    kind: f.kind,
    fixed_amount: f.fixed_amount ?? "",
    percentage_rate: f.percentage_rate ? String(Number(f.percentage_rate)) : "",
    percentage_of: f.percentage_of ?? "2",
    chargeable_on: f.chargeable_on || "1",
    mode: f.mode || "1",
    frequency: f.frequency || "0",
    fine_limit: f.fine_limit ?? 0,
    is_active: f.is_active,
  };
}

export const newDraft = (): FineDraft => ({
  kind: "fixed",
  fixed_amount: "",
  percentage_rate: "",
  percentage_of: "2",
  chargeable_on: "1",
  mode: "1",
  frequency: "0",
  fine_limit: 0,
  is_active: true,
});

export function draftReady(d: FineDraft): boolean {
  if (d.kind === "fixed") return /^\d+(\.\d{1,2})?$/.test(d.fixed_amount) && Number(d.fixed_amount) > 0;
  return /^\d+(\.\d{1,4})?$/.test(d.percentage_rate) && Number(d.percentage_rate) > 0 && Number(d.percentage_rate) <= 100;
}

export function fromDraft(d: FineDraft): FineRuleInput {
  const out: FineRuleInput = {
    ...(d.id && { id: d.id }),
    kind: d.kind,
    chargeable_on: d.chargeable_on,
    mode: d.mode,
    frequency: d.frequency,
    fine_limit: d.fine_limit,
    is_active: d.is_active,
  };
  if (d.kind === "fixed") out.fixed_amount = d.fixed_amount;
  else {
    out.percentage_rate = d.percentage_rate;
    out.percentage_of = d.percentage_of;
  }
  return out;
}

/** FineRulesEditor edits a regular contribution's late-payment fines. */
export function FineRulesEditor({ rules, onChange, currency }: { rules: FineDraft[]; onChange: (r: FineDraft[]) => void; currency: string }) {
  const update = (i: number, patch: Partial<FineDraft>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-4">
      {rules.length === 0 && <p className="text-sm text-slate-500">No fines yet. Add one to charge members who pay late.</p>}
      {rules.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Fine" htmlFor={`fr-kind-${i}`}>
              <select id={`fr-kind-${i}`} className="input" value={r.kind} onChange={(e) => update(i, { kind: e.target.value as FineDraft["kind"] })}>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </Field>
            {r.kind === "fixed" ? (
              <Field label={`Amount (${currency})`} htmlFor={`fr-amount-${i}`}>
                <input id={`fr-amount-${i}`} className="input" inputMode="decimal" value={r.fixed_amount} onChange={(e) => update(i, { fixed_amount: e.target.value.trim() })} />
              </Field>
            ) : (
              <>
                <Field label="Rate (%)" htmlFor={`fr-rate-${i}`}>
                  <input id={`fr-rate-${i}`} className="input" inputMode="decimal" value={r.percentage_rate} onChange={(e) => update(i, { percentage_rate: e.target.value.trim() })} />
                </Field>
                <Field label="Of" htmlFor={`fr-of-${i}`}>
                  <select id={`fr-of-${i}`} className="input" value={r.percentage_of} onChange={(e) => update(i, { percentage_of: e.target.value })}>
                    {Object.entries(percentageOfLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="When" htmlFor={`fr-when-${i}`}>
              <select id={`fr-when-${i}`} className="input" value={r.chargeable_on} onChange={(e) => update(i, { chargeable_on: e.target.value })}>
                {chargeableOptions.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Repeat" htmlFor={`fr-freq-${i}`}>
              <select id={`fr-freq-${i}`} className="input" value={r.frequency} onChange={(e) => update(i, { frequency: e.target.value })}>
                {Object.entries(fineFrequencyLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {k === "0" ? "Once per contribution" : `${v} while unpaid`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Charge" htmlFor={`fr-mode-${i}`}>
              <select id={`fr-mode-${i}`} className="input" value={r.mode} onChange={(e) => update(i, { mode: e.target.value })}>
                {Object.entries(fineModeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            {r.mode === "1" && (
              <Field label="Most fines per invoice" htmlFor={`fr-limit-${i}`}>
                <select id={`fr-limit-${i}`} className="input" value={r.fine_limit} onChange={(e) => update(i, { fine_limit: Number(e.target.value) })}>
                  <option value={0}>No limit</option>
                  {Array.from({ length: 20 }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Toggle id={`fr-active-${i}`} label="On" checked={r.is_active} onChange={(v) => update(i, { is_active: v })} />
            <button type="button" className="btn-ghost px-2 py-1 text-xs text-rose-700" onClick={() => onChange(rules.filter((_, j) => j !== i))}>
              <Trash2 className="size-3.5" aria-hidden /> Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => onChange([...rules, newDraft()])}>
        <Plus className="size-4" aria-hidden /> Add a fine
      </button>
    </div>
  );
}

/** describeFineRule is one fine rule in words, for the contribution page. */
export function describeFineRule(f: FineRule, currency: string): string {
  const amount = f.kind === "fixed" ? formatMoney(f.fixed_amount ?? "0", currency) : `${Number(f.percentage_rate)}% ${percentageOfLabels[f.percentage_of ?? "2"] ?? ""}`;
  const parts = [amount, describeChargeable(f.chargeable_on)];
  const freq = f.frequency ?? "0";
  if (freq !== "0") parts.push(`then ${fineFrequencyLabels[freq]?.toLowerCase()} while unpaid`);
  parts.push(f.mode === "2" ? "on the outstanding balance" : "for each unpaid invoice");
  if (f.mode !== "2" && f.fine_limit) parts.push(`at most ${f.fine_limit} per invoice`);
  let text = parts.join(", ");
  if (f.is_active && f.next_fine_date) text += `. Next on ${formatDate(f.next_fine_date)}`;
  return text;
}
