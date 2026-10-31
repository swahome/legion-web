import type { Schedule } from "../../api/loans";
import { formatDate, formatMoney } from "../../lib/format";

/** ScheduleTable shows a loan's installments and totals before it is paid out. */
export function ScheduleTable({ schedule, currency, compact }: { schedule: Schedule; currency: string; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
      <p className="px-3 pt-3 text-sm">
        Repay <span className="font-semibold">{formatMoney(schedule.total, currency)}</span> ({formatMoney(schedule.interest, currency)} interest) by{" "}
        {formatDate(schedule.ends_on)}.
        {Number(schedule.processing_fee) > 0 && <> Processing fee {formatMoney(schedule.processing_fee, currency)}.</>}
      </p>
      <div className={compact ? "max-h-48 overflow-y-auto" : ""}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 text-right font-medium">Principal</th>
              <th className="px-3 py-2 text-right font-medium">Interest</th>
              <th className="px-3 py-2 text-right font-medium">Installment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {schedule.installments.map((i) => (
              <tr key={i.number}>
                <td className="px-3 py-1.5 text-slate-500">{i.number}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(i.due_on)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(i.principal, currency)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(i.interest, currency)}</td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatMoney(i.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
