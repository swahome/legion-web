import { Link } from "react-router";
import { useAdminStats, useAudit } from "../../api/admin";
import { EmptyState, ErrorState, PageHeader, Spinner, Stat } from "../../components/ui";
import { formatDateTime } from "./widgets";

export function AdminOverviewPage() {
  const stats = useAdminStats();
  const audit = useAudit();
  if (stats.isPending) return <Spinner label="Loading" />;
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />;
  const s = stats.data;
  return (
    <>
      <PageHeader title="Platform overview" subtitle="Every group and user on Legion." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Groups" value={s.groups.toLocaleString()} hint={`${s.active_groups.toLocaleString()} active`} />
        <Stat label="Users" value={s.users.toLocaleString()} hint={`${s.users_active_30d.toLocaleString()} signed in within 30 days`} />
        <Stat label="Active memberships" value={s.memberships.toLocaleString()} />
        <Stat label="Groups not active" value={(s.groups - s.active_groups).toLocaleString()} hint="Setting up, suspended or closed" />
      </div>
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Recent admin changes</h2>
        <Link to="/admin/audit" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
          Audit log
        </Link>
      </div>
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {audit.data?.length === 0 && <EmptyState title="No admin changes yet" />}
        {audit.data?.slice(0, 6).map((e) => (
          <div key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{e.actor_name || "Someone"}</span> <span className="text-slate-500">{describeAction(e.action)}</span>{" "}
              {e.target_id ? `#${e.target_id}` : ""}
            </span>
            <span className="text-xs text-slate-500">{formatDateTime(e.created_at)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const actions: Record<string, string> = {
  "group.status": "changed the status of group",
  "user.create": "created user",
  "user.update": "updated user",
  "user.password": "set the password of user",
  "settings.update": "changed the settings",
  "country.create": "added country",
  "country.update": "updated country",
  "county.create": "added county",
  "county.update": "updated county",
  "bank.create": "added bank",
  "bank.update": "updated bank",
  "branch.create": "added bank branch",
  "branch.update": "updated bank branch",
};

export function describeAction(a: string): string {
  return actions[a] ?? a;
}
