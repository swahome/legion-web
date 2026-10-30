import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router";
import { ChevronsUpDown, FileText, HandCoins, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X } from "lucide-react";
import { useGroup, useMe } from "../api/hooks";
import { useAuth } from "../auth/AuthProvider";
import { fullName, initials } from "../lib/format";
import { Avatar, cx, ErrorState, Spinner } from "./ui";

export function useGroupId(): number {
  const { groupId } = useParams();
  return Number(groupId);
}

const lastGroupKey = "legion.lastGroup";

export function rememberGroup(id: number) {
  try {
    localStorage.setItem(lastGroupKey, String(id));
  } catch {
    // Private mode or storage disabled: the picker still works.
  }
}

export function lastGroup(): number | null {
  try {
    const v = Number(localStorage.getItem(lastGroupKey));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** AppShell is the signed-in layout for one group: sidebar, top bar, page. */
export function AppShell() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const [navOpen, setNavOpen] = useState(false);

  if (group.isPending) return <Spinner label="Loading group" />;
  if (group.isError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState error={group.error} />
        <div className="mt-4 text-center">
          <Link to="/groups" className="btn-secondary">
            Choose another group
          </Link>
        </div>
      </div>
    );
  }
  const g = group.data;
  rememberGroup(g.id);
  const base = `/g/${g.id}`;
  const nav = [
    { to: base, label: "Overview", icon: LayoutDashboard, end: true, show: true },
    { to: `${base}/statement`, label: "My statement", icon: FileText, show: g.my_membership_id != null },
    { to: `${base}/contributions`, label: "Contributions", icon: HandCoins, show: true },
    { to: `${base}/members`, label: "Members", icon: Users, show: true },
    { to: `${base}/arrears`, label: "Arrears", icon: ShieldCheck, show: g.is_official },
  ].filter((n) => n.show);

  const sidebar = (
    <nav aria-label="Group" className="flex h-full flex-col gap-1 p-3">
      <GroupSwitcher name={g.name} official={g.is_official} admin={g.platform_admin} />
      <div className="mt-3 space-y-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setNavOpen(false)}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )
            }
          >
            <n.icon className="size-4" aria-hidden />
            {n.label}
          </NavLink>
        ))}
      </div>
      <div className="mt-auto">
        <UserMenu />
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 h-dvh">{sidebar}</div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <button className="btn-ghost -ml-2 p-2" onClick={() => setNavOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <span className="truncate font-semibold">{g.name}</span>
      </header>
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setNavOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl dark:bg-slate-900">
            <button className="btn-ghost absolute top-3 right-3 p-2" onClick={() => setNavOpen(false)} aria-label="Close menu">
              <X className="size-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

function GroupSwitcher({ name, official, admin }: { name: string; official: boolean; admin: boolean }) {
  return (
    <Link
      to="/groups"
      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
      title="Switch group"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block text-xs text-slate-500">{admin ? "Platform admin" : official ? "Official" : "Member"}</span>
      </span>
      <ChevronsUpDown className="size-4 text-slate-400" aria-hidden />
    </Link>
  );
}

function UserMenu() {
  const me = useMe();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const u = me.data?.user;
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      {u && <Avatar text={initials(u)} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{u ? fullName(u) : "…"}</p>
        <p className="truncate text-xs text-slate-500">{u?.phone ?? u?.email}</p>
      </div>
      <button
        className="btn-ghost p-2"
        aria-label="Log out"
        title="Log out"
        onClick={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
