import { methodLabels } from "../../api/money";
import { ErrorState, Field } from "../../components/ui";

export function OfficialsOnly() {
  return <ErrorState error={new Error("Only group officials can see the group's money.")} />;
}

/** todayISO is today's date in Nairobi as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now);
}

/** monthsAgoISO is the date n months before today, as YYYY-MM-DD. */
export function monthsAgoISO(n: number, now = new Date()): string {
  const [y = 0, m = 1, d = 1] = todayISO(now).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 - n, d));
  return t.toISOString().slice(0, 10);
}

export function DateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="label">From</span>
        <input type="date" className="input" value={from} max={to} onChange={(e) => e.target.value && onChange({ from: e.target.value, to })} />
      </label>
      <label className="text-sm">
        <span className="label">To</span>
        <input type="date" className="input" value={to} min={from} onChange={(e) => e.target.value && onChange({ from, to: e.target.value })} />
      </label>
    </div>
  );
}

/** isAmount accepts a positive amount with at most two decimals. */
export function isAmount(v: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0;
}

/** AmountDateMethod is the amount, date and payment method row of a money form. */
export function AmountDateMethod({
  idPrefix,
  currency,
  form,
  set,
  method = true,
}: {
  idPrefix: string;
  currency: string;
  form: { amount: string; date: string; method?: string };
  set: (k: "amount" | "date" | "method") => (v: string) => void;
  method?: boolean;
}) {
  return (
    <div className={`grid gap-4 ${method ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      <Field label={`Amount (${currency})`} htmlFor={`${idPrefix}-amount`}>
        <input
          id={`${idPrefix}-amount`}
          className="input"
          inputMode="decimal"
          placeholder="0.00"
          pattern="\d+(\.\d{1,2})?"
          value={form.amount}
          onChange={(e) => set("amount")(e.target.value.trim())}
          required
        />
      </Field>
      <Field label="Date" htmlFor={`${idPrefix}-date`}>
        <input id={`${idPrefix}-date`} type="date" className="input" max={todayISO()} value={form.date} onChange={(e) => set("date")(e.target.value)} required />
      </Field>
      {method && (
        <Field label="Method" htmlFor={`${idPrefix}-method`}>
          <select id={`${idPrefix}-method`} className="input" value={form.method ?? ""} onChange={(e) => set("method")(e.target.value)}>
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
  );
}
