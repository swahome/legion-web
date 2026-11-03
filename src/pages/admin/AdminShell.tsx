import { Link, Navigate } from "react-router";
import {
  Archive,
  ArrowLeftRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Hash,
  History,
  Landmark,
  LayoutDashboard,
  Lock,
  MapPin,
  MessageSquareText,
  Moon,
  Receipt,
  Settings,
  Smartphone,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  Webhook,
  Zap,
} from "lucide-react";
import { useMe } from "../../api/hooks";
import { Shell, type NavItem } from "../../components/Shell";
import { Spinner } from "../../components/ui";
import { DropdownMenu } from "./widgets";

/** The admin menu, grouped the way the old panel grouped it. */
export const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  {
    to: "/admin/groups",
    label: "Groups",
    icon: Building2,
    children: [
      { to: "/admin/groups", label: "All groups", icon: Building2, end: true },
      { to: "/admin/groups/setup", label: "Setting up", icon: Sparkles },
      { to: "/admin/groups/locked", label: "Locked", icon: Lock },
      { to: "/admin/groups/archived", label: "Archived", icon: Archive },
      { to: "/admin/groups/inactive", label: "Potential archives", icon: Moon },
    ],
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: UserCog,
    children: [
      { to: "/admin/users", label: "All users", icon: Users, end: true },
      { to: "/admin/roles", label: "User roles", icon: BadgeCheck },
    ],
  },
  {
    to: "/admin/transactions",
    label: "Money",
    icon: Wallet,
    children: [
      { to: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
      { to: "/admin/bank-transactions", label: "Bank transactions", icon: Receipt },
      { to: "/admin/payments", label: "MPesa payments", icon: Smartphone },
      { to: "/admin/jobs", label: "Billing runs", icon: CalendarClock },
    ],
  },
  {
    to: "/admin/sms",
    label: "Communication",
    icon: MessageSquareText,
    children: [
      { to: "/admin/sms", label: "SMS", icon: MessageSquareText },
      { to: "/admin/channels", label: "USSD and WhatsApp", icon: Hash },
    ],
  },
  {
    to: "/admin/settings",
    label: "Settings",
    icon: Settings,
    children: [
      { to: "/admin/settings", label: "Settings and menus", icon: Settings },
      { to: "/admin/banks", label: "Banks", icon: Landmark },
      { to: "/admin/places", label: "Countries and counties", icon: MapPin },
      { to: "/admin/webhooks", label: "Webhook log", icon: Webhook },
      { to: "/admin/audit", label: "Audit log", icon: History },
    ],
  },
];

const quickActions = [
  { label: "Find a group", to: "/admin/groups" },
  { label: "Find a user", to: "/admin/users" },
  { label: "Add a user", to: "/admin/users?add=1" },
  { label: "Unassigned bank transactions", to: "/admin/bank-transactions" },
  { label: "SMS outbox", to: "/admin/sms" },
  { label: "Run billing", to: "/admin/jobs" },
];

/** AdminShell is the platform admin panel. Other users go back to their groups. */
export function AdminShell() {
  const me = useMe();
  if (me.isPending) return <Spinner label="Loading" />;
  if (!me.data?.platform_roles.includes("admin")) return <Navigate to="/groups" replace />;
  return (
    <Shell
      label="Admin"
      title="Legion admin"
      nav={adminNav}
      toolbar={<DropdownMenu label="Quick actions" icon={<Zap className="size-4" aria-hidden />} items={quickActions} />}
      header={
        <Link to="/groups" className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800" title="Go to your groups">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">L</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">Legion admin</span>
            <span className="block text-xs text-slate-500">Platform admin</span>
          </span>
        </Link>
      }
    />
  );
}
