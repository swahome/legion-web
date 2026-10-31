import { ErrorState } from "../../components/ui";

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
