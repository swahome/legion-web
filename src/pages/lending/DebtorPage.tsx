import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Banknote, Pencil } from "lucide-react";
import { useGroup } from "../../api/hooks";
import { useDebtor, useDebtorAction } from "../../api/lending";
import { interestText, loanStatusLabels, loanStatusTones, periodWords, useLoans } from "../../api/loans";
import { useGroupBase, useGroupId, useManaging } from "../../components/AppShell";
import { Badge, EmptyState, ErrorState, PageHeader, Spinner, Stat } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { Confirm, Pager, tbody, theadRow } from "../admin/widgets";
import { RecordLoanDialog } from "../loans/LoansPage";
import { OfficialsOnly } from "../money/shared";
import { DebtorDialog } from "./DebtorsPage";

/** DebtorPage is one debtor: their details and loans. Officials only. */
export function DebtorPage() {
  const groupId = useGroupId();
  const base = useGroupBase();
  const id = Number(useParams().debtorId);
  const group = useGroup(groupId);
  const managing = useManaging(group.data);
  const debtor = useDebtor(groupId, id);
  const [page, setPage] = useState(1);
  const loans = useLoans(groupId, { debtor_id: id, page });
  const act = useDebtorAction(groupId, id);
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"edit" | "lend" | "delete" | null>(null);

  if (!group.data || debtor.isPending) return <Spinner />;
  if (!managing) return <OfficialsOnly />;
  if (debtor.isError) return <ErrorState error={debtor.error} onRetry={() => debtor.refetch()} />;
  const d = debtor.data;
  const currency = group.data.currency;

  return (
    <>
      <Link to={`${base}/debtors`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Debtors
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {d.name} {!d.is_active && <Badge tone="warn">Suspended</Badge>}
          </span>
        }
        subtitle={[d.phone, d.email, d.id_number && `ID ${d.id_number}`, d.description].filter(Boolean).join(" · ") || "No contact details yet."}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setDialog("edit")}>
              <Pencil className="size-4" aria-hidden /> Edit
            </button>
            <button className="btn-ghost" disabled={act.isPending} onClick={() => act.mutate(d.is_active ? "suspend" : "activate")}>
              {d.is_active ? "Suspend" : "Reactivate"}
            </button>
            {d.loans === 0 && (
              <button className="btn-ghost text-rose-700 dark:text-rose-400" onClick={() => setDialog("delete")}>
                Delete
              </button>
            )}
            {d.is_active && (
              <button className="btn-primary" onClick={() => setDialog("lend")}>
                <Banknote className="size-4" aria-hidden /> Record a loan
              </button>
            )}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Loans" value={d.loans.toLocaleString()} />
        <Stat label="Lent" value={formatMoney(d.lent, currency)} />
        <Stat label="Still owed" value={formatMoney(d.balance, currency)} hint="Installments and fines, less repayments" />
      </div>
      {loans.isPending ? (
        <Spinner label="Loading loans" />
      ) : loans.isError ? (
        <ErrorState error={loans.error} onRetry={() => loans.refetch()} />
      ) : loans.data.loans.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No loans">Loans you record for {d.name} show here, with their schedule and repayments.</EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Paid out</th>
                <th className="px-4 py-3 font-medium">Loan</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Repaid</th>
                <th className="px-4 py-3 text-right font-medium">Owed</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {loans.data.loans.items.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`${base}/loans/${l.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                      {formatDate(l.disbursed_on)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{l.loan_type?.name ?? "Custom loan"}</span>
                    <span className="block text-xs text-slate-500">
                      {interestText({ interest_type: l.interest_type, interest_rate: l.interest_rate, rate_per: l.rate_per })} · {l.installments}{" "}
                      {periodWords[l.frequency]} · ends {formatDate(l.ends_on)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(l.amount, currency)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(l.paid, currency)}</td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(l.balance, currency)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={loanStatusTones[l.status]}>{loanStatusLabels[l.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={loans.data.loans} onPage={setPage} />
        </div>
      )}
      {dialog === "edit" && <DebtorDialog groupId={groupId} debtor={d} onClose={() => setDialog(null)} />}
      {dialog === "lend" && <RecordLoanDialog groupId={groupId} currency={currency} debtor={{ id: d.id, name: d.name }} onClose={() => setDialog(null)} />}
      <Confirm
        open={dialog === "delete"}
        title={`Delete ${d.name}?`}
        action="Delete"
        danger
        pending={act.isPending}
        error={act.error}
        onClose={() => {
          act.reset();
          setDialog(null);
        }}
        onConfirm={async () => {
          if (await act.mutateAsync("delete").then(() => true).catch(() => false)) navigate(`${base}/debtors`);
        }}
      >
        <p>{d.name} has no loans, so they can be removed from the group's debtors.</p>
      </Confirm>
    </>
  );
}
