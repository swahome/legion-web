import { useState } from "react";
import { Link } from "react-router";
import { useAdminTransactions } from "../../api/admin";
import { Badge, EmptyState, ErrorState, PageHeader, Spinner, Toggle } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { Pager, tbody, td, Th, theadRow, useDebounced } from "./widgets";

const types: [string, string][] = [
  ["contribution_invoice", "Contribution invoice"],
  ["contribution_payment", "Contribution payment"],
  ["contribution_fine_invoice", "Contribution fine"],
  ["fine_invoice", "Fine"],
  ["fine_payment", "Fine payment"],
  ["misc_invoice", "Miscellaneous invoice"],
  ["misc_payment", "Miscellaneous payment"],
  ["contribution_refund", "Contribution refund"],
  ["contribution_transfer_in", "Contribution transfer in"],
  ["contribution_transfer_out", "Contribution transfer out"],
  ["contribution_to_fine_transfer", "Contribution transfer to fine"],
  ["contribution_to_loan_transfer", "Contribution transfer to loan"],
  ["loan_to_contribution_transfer", "Loan transfer to contribution"],
  ["loan_to_fine_transfer", "Loan transfer to fine"],
];

export function AdminTransactionsPage() {
  const [groupId, setGroupId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [voided, setVoided] = useState(false);
  const [page, setPage] = useState(1);
  const group = useDebounced(groupId);
  const tx = useAdminTransactions({ group_id: group, type, from, to, include_voided: voided, page });
  const reset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Transactions" subtitle="Invoices, payments and transfers across every group, newest first." />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <input
          className="input w-32"
          inputMode="numeric"
          placeholder="Group ID"
          aria-label="Group ID"
          value={groupId}
          onChange={(e) => reset(setGroupId)(e.target.value.replace(/\D/g, ""))}
        />
        <select className="input w-auto" aria-label="Type" value={type} onChange={(e) => reset(setType)(e.target.value)}>
          <option value="">All types</option>
          {types.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input type="date" className="input w-auto" aria-label="From" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        <input type="date" className="input w-auto" aria-label="To" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        <div className="px-2 py-2">
          <Toggle
            id="tx-voided"
            label="Include voided"
            checked={voided}
            onChange={(v) => {
              setVoided(v);
              setPage(1);
            }}
          />
        </div>
      </div>
      {tx.isPending ? (
        <Spinner label="Loading transactions" />
      ) : tx.isError ? (
        <ErrorState error={tx.error} onRetry={() => tx.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {tx.data.items.length === 0 ? (
            <EmptyState title="No transactions match" />
          ) : (
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className={theadRow}>
                  <Th>Date</Th>
                  <Th>Group</Th>
                  <Th>Member</Th>
                  <Th>Type</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {tx.data.items.map((t) => (
                  <tr key={t.id} className={t.voided_at ? "text-slate-400 line-through" : ""}>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(t.date)}</td>
                    <td className={td}>
                      <Link to={`/group/${t.group_id}`} className="hover:underline">
                        {t.group_name}
                      </Link>
                    </td>
                    <td className={td}>
                      {t.membership_id ? (
                        <Link to={`/group/${t.group_id}/members/${t.membership_id}`} className="hover:underline">
                          {t.member_name || `Member #${t.membership_id}`}
                        </Link>
                      ) : (
                        <span className="text-slate-400">No member</span>
                      )}
                    </td>
                    <td className={td}>
                      {t.label || t.type}
                      {t.contribution_name && <span className="block text-xs text-slate-500">{t.contribution_name}</span>}
                      {t.voided_at && <Badge tone="danger">Voided</Badge>}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap tabular-nums`}>{formatMoney(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pager data={tx.data} onPage={setPage} />
        </div>
      )}
    </>
  );
}
