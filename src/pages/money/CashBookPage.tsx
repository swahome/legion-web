import { useSearchParams } from "react-router";
import { useGroup } from "../../api/hooks";
import { depositKindLabels, useAccounts, useCashBook, type CashBookEntry, type DepositKind } from "../../api/money";
import { useGroupId } from "../../components/AppShell";
import { EmptyState, ErrorState, PageHeader, Spinner, Stat } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { DateRange, OfficialsOnly, monthsAgoISO, todayISO } from "./shared";

const withdrawalLabels: Record<string, string> = {
  expense: "Expense",
  asset_purchase: "Asset purchase",
  loan_disbursement: "Loan disbursement",
  stock_purchase: "Stock purchase",
  money_market_investment: "Money market investment",
  contribution_refund: "Contribution refund",
  bank_loan_repayment: "Bank loan repayment",
  funds_transfer: "Funds transfer",
  external_loan_disbursement: "External loan",
  dividend: "Dividend",
};

/** typeLabel turns a cash book type like "deposit.fine" into words. */
export function typeLabel(type: string): string {
  const [side, kind] = type.split(".");
  if (side === "deposit") return kind ? depositKindLabels[kind as DepositKind] ?? kind : "Money in";
  if (side === "withdrawal") return kind ? withdrawalLabels[kind] ?? kind : "Money out";
  if (side === "transfer") return kind === "in" ? "Transfer in" : "Transfer out";
  return type;
}

/**
 * CashBookPage shows money in and out of the group's accounts with a running
 * balance. ?account=<id> narrows it to one account's statement.
 */
export function CashBookPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const accounts = useAccounts(groupId);
  const [params, setParams] = useSearchParams();
  const from = params.get("from") ?? monthsAgoISO(3);
  const to = params.get("to") ?? todayISO();
  const accountId = Number(params.get("account")) || undefined;
  const book = useCashBook(groupId, { from, to, account_id: accountId });

  if (group.data && !group.data.is_official) return <OfficialsOnly />;
  const currency = group.data?.currency ?? "KES";
  const account = accounts.data?.accounts.find((a) => a.id === accountId);

  function update(next: Record<string, string | undefined>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  }

  return (
    <>
      <PageHeader title={account ? `${account.name} statement` : "Cash book"} subtitle="Money in and out, with the running balance." />
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">Account</span>
          <select className="input" value={accountId ?? ""} onChange={(e) => update({ account: e.target.value || undefined })}>
            <option value="">All accounts</option>
            {accounts.data?.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.is_closed ? " (closed)" : ""}
              </option>
            ))}
          </select>
        </label>
        <DateRange from={from} to={to} onChange={(r) => update(r)} />
      </div>

      {book.isPending ? (
        <Spinner label="Loading the cash book" />
      ) : book.isError ? (
        <ErrorState error={book.error} onRetry={() => book.refetch()} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <Stat label="Opening balance" value={formatMoney(book.data.opening_balance, currency)} hint={formatDate(book.data.from)} />
            <Stat label="Money in" value={formatMoney(book.data.total_in, currency)} />
            <Stat label="Money out" value={formatMoney(book.data.total_out, currency)} />
            <Stat label="Closing balance" value={formatMoney(book.data.closing_balance, currency)} hint={formatDate(book.data.to)} />
          </div>
          {book.data.truncated && (
            <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">Showing the first 5,000 entries. Pick a shorter period to see the rest.</p>
          )}
          <div className="card overflow-x-auto">
            {book.data.entries.length === 0 ? (
              <EmptyState title="No transactions in this period" />
            ) : (
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    {!accountId && <th className="px-4 py-3 font-medium">Account</th>}
                    <th className="px-4 py-3 text-right font-medium">In</th>
                    <th className="px-4 py-3 text-right font-medium">Out</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {book.data.entries.map((e) => (
                    <Row key={e.id} e={e} currency={currency} showAccount={!accountId} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Row({ e, currency, showAccount }: { e: CashBookEntry; currency: string; showAccount: boolean }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(e.date)}</td>
      <td className="px-4 py-3">
        <span className="font-medium">{typeLabel(e.type)}</span>
        {(e.member || e.description) && (
          <span className="block text-xs text-slate-500">{[e.member?.name, e.description].filter(Boolean).join(" · ")}</span>
        )}
      </td>
      {showAccount && <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.account?.name ?? <span className="text-slate-400">Not linked</span>}</td>}
      <td className="px-4 py-3 text-right whitespace-nowrap text-emerald-700 tabular-nums dark:text-emerald-400">{e.money_in ? formatMoney(e.money_in, currency) : ""}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-rose-700 tabular-nums dark:text-rose-400">{e.money_out ? formatMoney(e.money_out, currency) : ""}</td>
      <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(e.balance, currency)}</td>
    </tr>
  );
}
