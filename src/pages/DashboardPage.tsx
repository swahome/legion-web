import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { useContributions, useGroup, useStatement } from "../api/hooks";
import { useGroupId } from "../components/AppShell";
import { Badge, Balance, balanceHint, PageHeader, Spinner, Stat } from "../components/ui";
import { formatDate, formatMoney, frequencyLabels } from "../lib/format";

export function DashboardPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const contributions = useContributions(groupId);
  if (!group.data) return <Spinner />;
  const g = group.data;

  return (
    <>
      <PageHeader
        title={g.name}
        subtitle={g.platform_admin ? "You are viewing this group as a platform admin." : g.is_official ? "You are an official of this group." : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {g.my_membership_id != null && <MyBalance groupId={groupId} memberId={g.my_membership_id} currency={g.currency} />}
        <Stat label="Active members" value={g.summary.active_members} hint={`${g.summary.officials} official${g.summary.officials === 1 ? "" : "s"}`} />
        <Stat label="Contributions" value={g.summary.active_contributions} hint="active" />
        <Stat label="Total contributions paid" value={formatMoney(g.summary.total_contributions_paid, g.currency)} hint="all time" />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Contributions</h2>
          <Link to={`/g/${groupId}/contributions`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            View all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {contributions.data
            ?.filter((c) => c.is_active)
            .slice(0, 4)
            .map((c) => (
              <Link key={c.id} to={`/g/${groupId}/contributions/${c.id}`} className="card group p-5 transition hover:border-brand-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {c.schedule?.frequency ? frequencyLabels[c.schedule.frequency] : c.kind === "one_time" ? "One-time" : "Whenever members pay"}
                      {c.schedule?.contribution_date && ` · next due ${formatDate(c.schedule.contribution_date)}`}
                    </p>
                  </div>
                  {!c.applies_to_all_members && <Badge>Selected members</Badge>}
                </div>
                <p className="mt-4 text-xl font-semibold tabular-nums">{formatMoney(c.amount, g.currency)}</p>
              </Link>
            ))}
          {contributions.data?.length === 0 && <p className="text-sm text-slate-500">This group has no contributions set up yet.</p>}
        </div>
      </section>
    </>
  );
}

function MyBalance({ groupId, memberId, currency }: { groupId: number; memberId: number; currency: string }) {
  const st = useStatement(groupId, memberId, {});
  const balance = st.data ? st.data.totals.reduce((s, t) => s + Number(t.balance), 0).toFixed(2) : null;
  return (
    <Link to={`/g/${groupId}/statement`} className="card group p-5 transition hover:border-brand-300">
      <p className="flex items-center justify-between text-sm text-slate-500">
        My balance <ArrowRight className="size-4 opacity-0 transition group-hover:opacity-100" aria-hidden />
      </p>
      {balance == null ? (
        <p className="mt-2 text-2xl font-semibold text-slate-300">…</p>
      ) : (
        <>
          <Balance value={balance} currency={currency} className="mt-2 block text-xl xl:text-2xl" />
          <p className="mt-1 text-xs text-slate-500">{balanceHint(balance)}</p>
        </>
      )}
    </Link>
  );
}
