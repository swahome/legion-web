import type { ComponentType } from "react";
import { Link } from "react-router";
import {
  Activity,
  Archive,
  Building2,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Gavel,
  Landmark,
  Lock,
  MessageSquareText,
  Receipt,
  Send,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useAdminStats, useAudit, type AdminStats } from "../../api/admin";
import { cx, EmptyState, ErrorState, PageHeader, Spinner } from "../../components/ui";
import { formatMoney } from "../../lib/format";
import { formatDateTime } from "./widgets";

interface Tile {
  label: string;
  value: (s: AdminStats) => string;
  hint?: (s: AdminStats) => string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  alert?: (s: AdminStats) => boolean;
}

const n = (v: number) => v.toLocaleString();

/** The counts on the old admin dashboard, each linked to where it is handled. */
const tiles: { title: string; items: Tile[] }[] = [
  {
    title: "Groups",
    items: [
      { label: "Groups", value: (s) => n(s.groups), hint: (s) => `${n(s.active_groups)} active`, to: "/admin/groups", icon: Building2 },
      { label: "Signed up today", value: (s) => n(s.groups_today), to: "/admin/groups?sort=newest", icon: Sparkles },
      { label: "Setting up", value: (s) => n(s.setup_groups), to: "/admin/groups/setup", icon: ClipboardCheck },
      { label: "Locked", value: (s) => n(s.suspended_groups), to: "/admin/groups/locked", icon: Lock },
      { label: "Archived", value: (s) => n(s.closed_groups), to: "/admin/groups/archived", icon: Archive },
    ],
  },
  {
    title: "Users",
    items: [
      { label: "Users", value: (s) => n(s.users), hint: (s) => `${n(s.users_active_30d)} signed in within 30 days`, to: "/admin/users", icon: Users },
      { label: "New users today", value: (s) => n(s.users_today), to: "/admin/users", icon: UserPlus },
      { label: "Active memberships", value: (s) => n(s.memberships), to: "/admin/groups", icon: Activity },
    ],
  },
  {
    title: "Money",
    items: [
      {
        label: "Transaction alerts",
        value: (s) => n(s.transaction_alerts),
        hint: (s) => `${n(s.alerts_unassigned)} without a group`,
        to: "/admin/bank-transactions",
        icon: Receipt,
        alert: (s) => s.alerts_unassigned > 0,
      },
      { label: "Accounts connected", value: (s) => n(s.accounts_connected), hint: () => "Verified bank accounts", to: "/admin/banks", icon: Landmark },
      { label: "MPesa payments", value: (s) => n(s.payments_paid), hint: (s) => formatMoney(s.payments_paid_amount, "KES"), to: "/admin/payments", icon: Smartphone },
      { label: "Invoices sent today", value: (s) => n(s.invoices_today), to: "/admin/jobs", icon: FileText },
      { label: "Fine invoices today", value: (s) => n(s.fine_invoices_today), to: "/admin/jobs", icon: Gavel },
      { label: "Open withdrawal requests", value: (s) => n(s.open_withdrawal_requests), hint: () => "Pending or approved, not yet paid", to: "/admin/transactions", icon: ClipboardCheck },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "SMS log", value: (s) => n(s.sms_total), to: "/admin/sms", icon: MessageSquareText },
      { label: "Texts sent today", value: (s) => n(s.sms_sent_today), to: "/admin/sms", icon: Send },
      { label: "Texts queued", value: (s) => n(s.sms_queued), to: "/admin/sms", icon: MessageSquareText },
      {
        label: "Failed texts",
        value: (s) => n(s.sms_failed_7d),
        hint: () => "Last 7 days",
        to: "/admin/sms",
        icon: CircleAlert,
        alert: (s) => s.sms_failed_7d > 0,
      },
      { label: "Activity log", value: (s) => n(s.audit_entries), hint: () => "Admin changes", to: "/admin/audit", icon: Activity },
    ],
  },
];

export function AdminOverviewPage() {
  const stats = useAdminStats();
  const audit = useAudit();
  if (stats.isPending) return <Spinner label="Loading" />;
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />;
  const s = stats.data;
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Every group and user on Legion. Select a number to see the list behind it." />
      {tiles.map((section) => (
        <section key={section.title} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">{section.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {section.items.map((t) => {
              const warn = t.alert?.(s);
              return (
                <Link key={t.label} to={t.to} className="card flex items-start gap-3 p-4 transition hover:border-brand-300">
                  <span
                    className={cx(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      warn ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
                    )}
                  >
                    <t.icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-500">{t.label}</span>
                    <span className="block text-2xl font-semibold tabular-nums">{t.value(s)}</span>
                    {t.hint && <span className="block truncate text-xs text-slate-500">{t.hint(s)}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <div className="mb-3 flex items-center justify-between">
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
  "group.update": "edited group",
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
