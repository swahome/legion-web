import { Link, Navigate } from "react-router";
import { ArrowLeftRight, Building2, CalendarClock, History, Landmark, LayoutDashboard, MapPin, Settings, UserCog } from "lucide-react";
import { useMe } from "../../api/hooks";
import { Shell, type NavItem } from "../../components/Shell";
import { Spinner } from "../../components/ui";

const nav: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/groups", label: "Groups", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: UserCog },
  { to: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/admin/banks", label: "Banks", icon: Landmark },
  { to: "/admin/places", label: "Countries and counties", icon: MapPin },
  { to: "/admin/settings", label: "Settings and menus", icon: Settings },
  { to: "/admin/jobs", label: "Billing runs", icon: CalendarClock },
  { to: "/admin/audit", label: "Audit log", icon: History },
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
      nav={nav}
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
