import { useState, type ComponentType, type ReactNode } from "react";
import { matchPath, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useMe } from "../api/hooks";
import { useAuth } from "../auth/AuthProvider";
import { fullName, initials } from "../lib/format";
import { Avatar, cx } from "./ui";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  end?: boolean;
  /** A section: the item opens to show these links instead of being one. */
  children?: NavItem[];
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
    isActive
      ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  );

/** isUnder says whether the current path is one of a section's links. */
function isUnder(n: NavItem, pathname: string): boolean {
  return (n.children ?? []).some((c) => matchPath({ path: c.to, end: false }, pathname) || isUnder(c, pathname));
}

function NavSection({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const active = isUnder(item, pathname);
  const [open, setOpen] = useState(active);
  const shown = open || active;
  return (
    <div>
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setOpen(!shown)}
        className={cx(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-slate-800",
          active ? "text-brand-800 dark:text-brand-200" : "text-slate-600 dark:text-slate-300",
        )}
      >
        <item.icon className="size-4" aria-hidden />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cx("size-4 text-slate-400 transition", shown && "rotate-180")} aria-hidden />
      </button>
      {shown && (
        <div className="mt-1 ml-5 space-y-1 border-l border-slate-200 pl-2 dark:border-slate-800">
          {item.children!.map((c) =>
            c.children ? (
              <NavSection key={c.label} item={c} onNavigate={onNavigate} />
            ) : (
              <NavLink key={c.to} to={c.to} end={c.end} onClick={onNavigate} className={linkClass}>
                <c.icon className="size-4" aria-hidden />
                {c.label}
              </NavLink>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Shell is the signed-in layout shared by the admin, group and member
 * sections: a sidebar (a drawer on small screens), and the page.
 */
export function Shell({
  label,
  title,
  header,
  nav,
  context,
  toolbar,
}: {
  label: string;
  title: string;
  header: ReactNode;
  nav: NavItem[];
  context?: unknown;
  /** Shown above every page, on the right (the admin's quick actions). */
  toolbar?: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  const sidebar = (
    <nav aria-label={label} className="flex h-full flex-col gap-1 p-3">
      {header}
      <div className="mt-3 space-y-1 overflow-y-auto">
        {nav.map((n) =>
          n.children ? (
            <NavSection key={n.label} item={n} onNavigate={() => setNavOpen(false)} />
          ) : (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setNavOpen(false)} className={linkClass}>
              <n.icon className="size-4" aria-hidden />
              {n.label}
            </NavLink>
          ),
        )}
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
        <span className="truncate font-semibold">{title}</span>
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

      <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {toolbar && <div className="mb-4 flex justify-end">{toolbar}</div>}
        <Outlet context={context} />
      </main>
    </div>
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
