import { useAudit } from "../../api/admin";
import { EmptyState, ErrorState, PageHeader, Spinner } from "../../components/ui";
import { describeAction } from "./AdminOverviewPage";
import { formatDateTime, tbody, td, Th, theadRow } from "./widgets";

export function AdminAuditPage() {
  const audit = useAudit();
  if (audit.isPending) return <Spinner label="Loading the audit log" />;
  if (audit.isError) return <ErrorState error={audit.error} onRetry={() => audit.refetch()} />;
  return (
    <>
      <PageHeader title="Audit log" subtitle="The latest 100 changes made in this panel. Passwords are never recorded." />
      <div className="card overflow-x-auto">
        {audit.data.length === 0 ? (
          <EmptyState title="No admin changes yet" />
        ) : (
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {audit.data.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(e.created_at)}</td>
                  <td className={td}>{e.actor_name || "—"}</td>
                  <td className={td}>
                    {describeAction(e.action)} {e.target_id ? `#${e.target_id}` : ""}
                  </td>
                  <td className={`${td} font-mono text-xs break-all text-slate-500`}>{JSON.stringify(e.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
