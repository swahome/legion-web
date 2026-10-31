import { useState } from "react";
import { Play } from "lucide-react";
import { useJobRuns, useRunBilling, type JobRun } from "../../api/fines";
import { Badge, EmptyState, ErrorState, InlineError, PageHeader, Spinner } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { todayISO } from "../money/shared";
import { formatDateTime, Pager, tbody, td, Th, theadRow } from "./widgets";

const triggerLabels: Record<JobRun["trigger"], string> = { schedule: "Nightly", manual: "Run by hand", cli: "Command line" };

/** AdminJobsPage shows the nightly billing runs and lets an admin run billing now. */
export function AdminJobsPage() {
  const [page, setPage] = useState(1);
  const runs = useJobRuns(page);
  const run = useRunBilling();
  const [date, setDate] = useState(todayISO());

  return (
    <>
      <PageHeader
        title="Billing runs"
        subtitle="Every night the server raises the day's contribution invoices and late-payment fines. Running a day again adds nothing it already raised."
      />
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">Bill the day</span>
          <input type="date" className="input" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={run.isPending || !date} onClick={() => run.mutate(date)}>
          <Play className="size-4" aria-hidden /> {run.isPending ? "Starting…" : "Run billing now"}
        </button>
        {run.isSuccess && <span className="pb-2.5 text-sm text-slate-500">Started for {formatDate(run.data.date)}.</span>}
        <div className="w-full">
          <InlineError error={run.error} />
        </div>
      </div>
      {runs.isPending ? (
        <Spinner label="Loading runs" />
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => runs.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {runs.data.items.length === 0 ? (
            <EmptyState title="Billing hasn't run yet" />
          ) : (
            <>
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className={theadRow}>
                    <Th>Day billed</Th>
                    <Th>Started</Th>
                    <Th>How</Th>
                    <Th>Status</Th>
                    <Th>What it did</Th>
                  </tr>
                </thead>
                <tbody className={tbody}>
                  {runs.data.items.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className={`${td} whitespace-nowrap font-medium`}>{formatDate(r.run_date)}</td>
                      <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.started_at)}</td>
                      <td className={td}>
                        {triggerLabels[r.trigger]}
                        {r.started_by && <span className="block text-xs text-slate-500">{r.started_by.name}</span>}
                      </td>
                      <td className={td}>
                        <RunStatus run={r} />
                      </td>
                      <td className={td}>
                        <RunSummary run={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager data={runs.data} onPage={setPage} />
            </>
          )}
        </div>
      )}
    </>
  );
}

function RunStatus({ run }: { run: JobRun }) {
  if (run.status === "running") return <Badge tone="warn">Running</Badge>;
  if (run.status === "failed") return <Badge tone="danger">Failed</Badge>;
  if (run.summary.problems?.length) return <Badge tone="warn">Done, with problems</Badge>;
  return <Badge tone="brand">Done</Badge>;
}

export function summaryText(s: JobRun["summary"]): string {
  const parts = [
    `${s.invoices_raised ?? 0} invoice${s.invoices_raised === 1 ? "" : "s"}`,
    `${s.fines_raised ?? 0} fine${s.fines_raised === 1 ? "" : "s"}`,
  ];
  const skipped = (s.schedules_skipped ?? 0) + (s.fine_rules_skipped ?? 0);
  if (skipped) parts.push(`${skipped} out-of-date setting${skipped === 1 ? "" : "s"} moved on`);
  return parts.join(", ");
}

function RunSummary({ run }: { run: JobRun }) {
  return (
    <div>
      <span>{summaryText(run.summary)}</span>
      {run.error && <span className="block text-xs text-red-600">{run.error}</span>}
      {run.summary.problems && run.summary.problems.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-xs text-slate-500">
          {run.summary.problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
