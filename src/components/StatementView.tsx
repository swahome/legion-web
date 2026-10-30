import { useState } from "react";
import { Download } from "lucide-react";
import { useStatement, type StatementParams } from "../api/hooks";
import type { Statement } from "../api/types";
import { formatDate, formatMoney } from "../lib/format";
import { Badge, Balance, balanceHint, cx, EmptyState, ErrorState, Spinner } from "./ui";

/** StatementView shows a member's contribution statement with filters. */
export function StatementView({ groupId, memberId }: { groupId: number; memberId: number }) {
  const [params, setParams] = useState<StatementParams>({});
  const st = useStatement(groupId, memberId, params);

  if (st.isPending) return <Spinner label="Loading statement" />;
  if (st.isError) return <ErrorState error={st.error} onRetry={() => st.refetch()} />;
  const s = st.data;
  const lifetime = s.totals.reduce((sum, t) => sum + Number(t.balance), 0).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 sm:col-span-1">
          <p className="text-sm text-slate-500">Contribution balance</p>
          <Balance value={lifetime} currency={s.currency} className="mt-2 block text-2xl" />
          <p className="mt-1 text-xs text-slate-500">{balanceHint(lifetime)}</p>
        </div>
        <div className="card p-5 sm:col-span-2">
          <p className="mb-3 text-sm text-slate-500">By contribution</p>
          {s.totals.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {s.totals.map((t) => (
                <li key={t.contribution_id ?? "none"} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="truncate">{t.contribution_name ?? "Unallocated"}</span>
                  <span className="shrink-0 text-right">
                    <span className="text-slate-500">
                      paid {formatMoney(t.paid, s.currency)} of {formatMoney(t.payable, s.currency)} ·{" "}
                    </span>
                    <Balance value={t.balance} currency={s.currency} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <label className="label" htmlFor="st-from">
              From
            </label>
            <input id="st-from" type="date" className="input" value={params.from ?? ""} onChange={(e) => setParams((p) => ({ ...p, from: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="label" htmlFor="st-to">
              To
            </label>
            <input id="st-to" type="date" className="input" value={params.to ?? ""} onChange={(e) => setParams((p) => ({ ...p, to: e.target.value || undefined }))} />
          </div>
          <div className="sm:min-w-56">
            <label className="label" htmlFor="st-contribution">
              Contribution
            </label>
            <select
              id="st-contribution"
              className="input"
              value={params.contribution_id ?? ""}
              onChange={(e) => setParams((p) => ({ ...p, contribution_id: Number(e.target.value) || undefined }))}
            >
              <option value="">All contributions</option>
              {s.totals
                .filter((t) => t.contribution_id != null)
                .map((t) => (
                  <option key={t.contribution_id} value={t.contribution_id!}>
                    {t.contribution_name}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            {(params.from || params.to || params.contribution_id) && (
              <button className="btn-ghost" onClick={() => setParams({})}>
                Clear
              </button>
            )}
            <button className="btn-secondary" onClick={() => downloadCsv(s)} disabled={s.entries.length === 0}>
              <Download className="size-4" aria-hidden /> CSV
            </button>
          </div>
        </div>
        <StatementTable statement={s} />
      </div>
    </div>
  );
}

export function StatementTable({ statement: s }: { statement: Statement }) {
  if (s.entries.length === 0 && s.opening_balance === "0.00") {
    return <EmptyState title="No transactions">Invoices and payments will show up here.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Details</th>
            <th className="px-4 py-3 text-right font-medium">Invoiced</th>
            <th className="px-4 py-3 text-right font-medium">Paid</th>
            <th className="px-4 py-3 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {s.from && (
            <tr className="bg-slate-50/60 dark:bg-slate-800/30">
              <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(s.from)}</td>
              <td className="px-4 py-3 text-slate-500" colSpan={3}>
                Opening balance
              </td>
              <td className="px-4 py-3 text-right">
                <Balance value={s.opening_balance} currency={s.currency} />
              </td>
            </tr>
          )}
          {s.entries.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(e.date)}</td>
              <td className="px-4 py-3">
                <span className="font-medium">{e.label || e.type}</span>
                {e.is_backdated && (
                  <span className="ml-2">
                    <Badge>Backdated</Badge>
                  </span>
                )}
                <span className="block text-xs text-slate-500">{[e.contribution_name, e.description].filter(Boolean).join(" · ")}</span>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{e.debit ? formatMoney(e.debit, s.currency) : ""}</td>
              <td className={cx("px-4 py-3 text-right whitespace-nowrap tabular-nums", e.credit && "text-emerald-700 dark:text-emerald-400")}>
                {e.credit ? formatMoney(e.credit, s.currency) : ""}
              </td>
              <td className="px-4 py-3 text-right">
                <Balance value={e.balance} currency={s.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadCsv(s: Statement) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [
    ["Date", "Type", "Contribution", "Description", "Invoiced", "Paid", "Balance"],
    ...s.entries.map((e) => [e.date, e.label || e.type, e.contribution_name ?? "", e.description, e.debit ?? "", e.credit ?? "", e.balance]),
  ];
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `statement-${s.member.membership_number ?? s.member.id}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
