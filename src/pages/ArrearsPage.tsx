import { Link } from "react-router";
import { useBalances, useGroup } from "../api/hooks";
import { useGroupId } from "../components/AppShell";
import { Balance, EmptyState, ErrorState, PageHeader, Spinner, Stat } from "../components/ui";
import { formatMoney, isNegative, isZero } from "../lib/format";

/** ArrearsPage lists every active member's contribution balance (officials). */
export function ArrearsPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const b = useBalances(groupId);

  if (group.data && !group.data.is_official) return <ErrorState error={new Error("Only group officials can see everyone's balances.")} />;
  if (b.isPending) return <Spinner label="Loading balances" />;
  if (b.isError) return <ErrorState error={b.error} onRetry={() => b.refetch()} />;
  const { currency, balances } = b.data;
  const owing = balances.filter((x) => !isZero(x.balance) && !isNegative(x.balance));
  const totalOwed = owing.reduce((s, x) => s + Number(x.balance), 0).toFixed(2);

  return (
    <>
      <PageHeader title="Arrears" subtitle="Contribution balances for every active member, most owed first." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Members owing" value={`${owing.length} of ${balances.length}`} />
        <Stat label="Total outstanding" value={formatMoney(totalOwed, currency)} />
        <Stat label="Fully paid up or ahead" value={balances.length - owing.length} />
      </div>
      <div className="card overflow-x-auto">
        {balances.length === 0 ? (
          <EmptyState title="No active members" />
        ) : (
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 text-right font-medium">Invoiced</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {balances.map((x) => (
                <tr key={x.membership_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <Link to={`/g/${groupId}/members/${x.membership_id}`} className="font-medium hover:underline">
                      {x.first_name} {x.last_name}
                    </Link>
                    {x.membership_number && <span className="ml-2 text-xs text-slate-500">No. {x.membership_number}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(x.payable, currency)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(x.paid, currency)}</td>
                  <td className="px-4 py-3 text-right">
                    <Balance value={x.balance} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
