import { Link } from "react-router";
import { EyeOff, Plus } from "lucide-react";
import { useContributions, useGroup } from "../api/hooks";
import { useGroupId } from "../components/AppShell";
import { Badge, EmptyState, ErrorState, PageHeader, Spinner } from "../components/ui";
import { categoryLabels, formatDate, formatMoney, frequencyLabels, kindLabels } from "../lib/format";

export function ContributionsPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const list = useContributions(groupId);
  const official = group.data?.is_official ?? false;
  const currency = group.data?.currency ?? "KES";

  return (
    <>
      <PageHeader
        title="Contributions"
        subtitle="What members pay into the group, and how often."
        actions={
          official && (
            <Link to={`/g/${groupId}/contributions/new`} className="btn-primary">
              <Plus className="size-4" aria-hidden /> New contribution
            </Link>
          )
        }
      />
      {list.isPending ? (
        <Spinner label="Loading contributions" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <div className="card">
          <EmptyState title="No contributions yet">{official ? "Create one to start invoicing members." : "Your officials haven't set any up yet."}</EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase dark:border-slate-800">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">Next date</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <Link to={`/g/${groupId}/contributions/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {c.category && <Badge>{categoryLabels[c.category]}</Badge>}
                      {!c.is_active && <Badge tone="warn">Inactive</Badge>}
                      {c.is_hidden && (
                        <Badge>
                          <EyeOff className="size-3" aria-hidden /> Hidden
                        </Badge>
                      )}
                      {!c.applies_to_all_members && <Badge>Selected members</Badge>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {c.schedule?.frequency ? frequencyLabels[c.schedule.frequency] : kindLabels[c.kind]}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(c.schedule?.contribution_date)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(c.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
