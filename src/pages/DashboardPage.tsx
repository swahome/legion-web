import { useState } from "react";
import { Link } from "react-router";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ClipboardCheck } from "lucide-react";
import { useContributions, useGroup, useStatement } from "../api/hooks";
import { useDashboard, type Dashboard, type DashboardMovement } from "../api/dashboard";
import { depositKindLabels, withdrawalKindLabels, type DepositKind, type WithdrawalKind } from "../api/money";
import { useGroupBase, useGroupId, useManaging } from "../components/AppShell";
import { MoneyChart, type Period } from "../components/MoneyChart";
import { Badge, Balance, balanceHint, ErrorState, PageHeader, Spinner, Stat } from "../components/ui";
import { formatDate, formatMoney, frequencyLabels } from "../lib/format";

export function DashboardPage() {
  const base = useGroupBase();
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const contributions = useContributions(groupId);
  const managing = useManaging(group.data);
  if (!group.data) return <Spinner />;
  const g = group.data;
  if (managing) return <GroupDashboard />;

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
          <Link to={`${base}/contributions`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {contributions.data
            ?.filter((c) => c.is_active)
            .slice(0, 4)
            .map((c) => (
              <Link key={c.id} to={`${base}/contributions/${c.id}`} className="card group min-w-0 p-5 transition hover:border-brand-300">
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
  const base = useGroupBase();
  const st = useStatement(groupId, memberId, {});
  const balance = st.data ? st.data.totals.reduce((s, t) => s + Number(t.balance), 0).toFixed(2) : null;
  return (
    <Link to={`${base}/statement`} className="card group min-w-0 p-5 transition hover:border-brand-300">
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

const monthName = new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("en-KE", { month: "short", timeZone: "UTC" });

/** monthPeriods labels the dashboard's months for the chart. */
export function monthPeriods(d: Dashboard): Period[] {
  return d.months.map((m) => {
    const date = new Date(m.month + "-01T00:00:00Z");
    const short = monthShort.format(date);
    return { ...m, label: date.getUTCMonth() === 0 ? `${short} ${String(date.getUTCFullYear()).slice(2)}` : short, title: monthName.format(date) };
  });
}

/** yearPeriods fills in quiet years so the axis has no gaps. */
export function yearPeriods(d: Dashboard): Period[] {
  if (d.years.length === 0) return [];
  const byYear = new Map(d.years.map((y) => [y.year, y]));
  const out: Period[] = [];
  const zero = { contributions: "0.00", fines: "0.00", misc: "0.00", income: "0.00", expenses: "0.00" };
  const first = d.years[0]!.year;
  const last = d.years[d.years.length - 1]!.year;
  for (let y = first; y <= last; y++) {
    out.push({ ...zero, ...byYear.get(y), label: String(y), title: String(y) });
  }
  return out;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** GroupDashboard is the officials' home page: cash, arrears, money in and out, and recent movements. */
function GroupDashboard() {
  const base = useGroupBase();
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const dash = useDashboard(groupId);
  const contributions = useContributions(groupId);
  const [view, setView] = useState<"months" | "years" | null>(null);
  const g = group.data!;

  if (dash.isPending) return <Spinner label="Loading dashboard" />;
  if (dash.isError) return <ErrorState error={dash.error} onRetry={() => dash.refetch()} />;
  const d = dash.data;
  const cur = d.currency;
  const months = monthPeriods(d);
  const years = yearPeriods(d);
  const quietYear = months.every((m) => m.contributions === "0.00" && m.fines === "0.00" && m.misc === "0.00" && m.income === "0.00" && m.expenses === "0.00");
  const shown = view ?? (quietYear && years.length > 0 ? "years" : "months");
  const bankAccounts = d.cash.accounts.bank + d.cash.accounts.sacco;
  const pending = d.pending_withdrawal_requests ?? 0;

  return (
    <>
      <PageHeader
        title={g.name}
        subtitle={`${plural(g.summary.active_members, "active member")} · ${plural(g.summary.officials, "official")} · as of ${formatDate(d.as_of)}`}
      />
      {pending > 0 && (
        <Link
          to={`${base}/withdrawal-requests`}
          className="card mb-4 flex items-center gap-3 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <ClipboardCheck className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">{plural(pending, "withdrawal request")} waiting for approval.</span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
      <div className={`grid gap-4 sm:grid-cols-2 ${d.loans ? "xl:grid-cols-3 2xl:grid-cols-5" : "2xl:grid-cols-4"}`}>
        <LinkStat to={`${base}/accounts`} label="Cash at bank" value={formatMoney(d.cash.at_bank, cur)} hint={bankAccounts ? `In ${plural(bankAccounts, "bank and sacco account")}` : "Bank and sacco accounts"} />
        <LinkStat
          to={`${base}/accounts`}
          label="Cash at hand"
          value={formatMoney(d.cash.at_hand, cur)}
          hint={`Mobile money ${formatMoney(d.cash.by_kind.mobile_money, cur)} · petty cash ${formatMoney(d.cash.by_kind.petty_cash, cur)}`}
        />
        <LinkStat
          to={`${base}/arrears`}
          label="Contribution arrears"
          value={formatMoney(d.owed.contributions.owed, cur)}
          hint={d.owed.contributions.members ? `${plural(d.owed.contributions.members, "member")} behind` : "Everyone is up to date"}
        />
        <LinkStat
          to={`${base}/fines`}
          label="Unpaid fines"
          value={formatMoney(d.owed.fines.owed, cur)}
          hint={d.owed.fines.members ? `Owed by ${plural(d.owed.fines.members, "member")}` : "No fines owed"}
        />
        {d.loans && (
          <LinkStat
            to={`${base}/loans`}
            label="Loans owed"
            value={formatMoney(d.loans.balance, cur)}
            hint={d.loans.count ? `${plural(d.loans.count, "loan")} · ${formatMoney(d.loans.repaid, cur)} repaid` : "No loans yet"}
          />
        )}
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Money in and out</h2>
            <p className="text-sm text-slate-500">Member payments and income against expenses.</p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-700" role="group" aria-label="Period">
            {(["months", "years"] as const).map((v) => (
              <button
                key={v}
                className={`rounded-md px-3 py-1 ${shown === v ? "bg-slate-100 font-medium dark:bg-slate-800" : "text-slate-500"}`}
                aria-pressed={shown === v}
                onClick={() => setView(v)}
              >
                {v === "months" ? "Last 12 months" : "By year"}
              </button>
            ))}
          </div>
        </div>
        {shown === "months" && quietYear ? (
          <p className="py-10 text-center text-sm text-slate-500">No money moved in the last 12 months.</p>
        ) : shown === "years" && years.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No money has been recorded yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <div className="min-w-[34rem]">
              <MoneyChart periods={shown === "months" ? months : years} currency={cur} />
            </div>
          </div>
        )}
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4 dark:border-slate-800">
          <Total label="Contributions paid" value={d.totals.contributions} currency={cur} />
          <Total label="Fines paid" value={d.totals.fines} currency={cur} />
          <Total label="Income" value={d.totals.income} currency={cur} />
          <Total label="Expenses" value={d.totals.expenses} currency={cur} />
        </dl>
        <p className="mt-2 text-xs text-slate-500">All time.</p>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card min-w-0">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold">Recent transactions</h2>
            <Link to={`${base}/cash-book`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              Cash book
            </Link>
          </div>
          {d.recent && d.recent.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {d.recent.map((m) => (
                <Movement key={m.id} m={m} currency={cur} />
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-5 text-sm text-slate-500">Nothing recorded yet.</p>
          )}
        </section>
        <section className="card min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Contributions</h2>
            <Link to={`${base}/contributions`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {contributions.data
              ?.filter((c) => c.is_active)
              .slice(0, 6)
              .map((c) => (
                <li key={c.id}>
                  <Link to={`${base}/contributions/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-700">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block text-xs text-slate-500">
                        {c.schedule?.frequency ? frequencyLabels[c.schedule.frequency] : c.kind === "one_time" ? "One-time" : "Whenever members pay"}
                        {c.schedule?.contribution_date && ` · next due ${formatDate(c.schedule.contribution_date)}`}
                      </span>
                    </span>
                    <span className="font-medium whitespace-nowrap tabular-nums">{formatMoney(c.amount, cur)}</span>
                  </Link>
                </li>
              ))}
          </ul>
          {contributions.data?.length === 0 && <p className="text-sm text-slate-500">This group has no contributions set up yet.</p>}
        </section>
      </div>
    </>
  );
}

function LinkStat({ to, label, value, hint }: { to: string; label: string; value: string; hint: string }) {
  return (
    <Link to={to} className="card group min-w-0 p-5 transition hover:border-brand-300">
      <p className="flex items-center justify-between text-sm text-slate-500">
        {label} <ArrowRight className="size-4 opacity-0 transition group-hover:opacity-100" aria-hidden />
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight whitespace-nowrap tabular-nums xl:text-2xl">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>
    </Link>
  );
}

function Total({ label, value, currency }: { label: string; value: string; currency: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{formatMoney(value, currency)}</dd>
    </div>
  );
}

/** movementLabel names a cash book row: its deposit or withdrawal kind, else its description. */
export function movementLabel(m: DashboardMovement): string {
  if (m.kind === "transfer") return m.direction === "in" ? "Transfer in" : "Transfer out";
  const label = m.direction === "in" ? depositKindLabels[m.kind as DepositKind] : withdrawalKindLabels[m.kind as WithdrawalKind];
  return label ?? (m.description || (m.direction === "in" ? "Money in" : "Money out"));
}

function Movement({ m, currency }: { m: DashboardMovement; currency: string }) {
  const incoming = m.direction === "in";
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <li className="flex items-center gap-3 px-5 py-3 text-sm">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${incoming ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {movementLabel(m)}
          {m.member && <span className="font-normal text-slate-500"> · {m.member}</span>}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {formatDate(m.date)}
          {m.account && ` · ${m.account}`}
        </span>
      </span>
      <span className={`font-medium whitespace-nowrap tabular-nums ${incoming ? "" : "text-slate-600 dark:text-slate-300"}`}>
        {incoming ? "+" : "−"}
        {formatMoney(m.amount, currency)}
      </span>
    </li>
  );
}
