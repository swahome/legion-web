import { Link, Navigate, useLocation, useParams } from "react-router";
import { ChevronsUpDown } from "lucide-react";
import { useGroup, useMe } from "../api/hooks";
import type { Group } from "../api/types";
import { isMenuOff, menuNav } from "./menus";
import { Shell } from "./Shell";
import { ErrorState, Spinner } from "./ui";

/** The group sections: officials manage the group, members see their own records. */
export type Section = "group" | "member";

export function useGroupId(): number {
  const { groupId } = useParams();
  return Number(groupId);
}

/** useGroupBase is the URL prefix of the current group section, like /group/15. */
export function useGroupBase(): string {
  const { pathname } = useLocation();
  const section: Section = pathname.startsWith("/member/") ? "member" : "group";
  return `/${section}/${useGroupId()}`;
}

/**
 * useManaging tells a page whether to show official tools: only in the
 * /group section. An official viewing /member sees what members see.
 */
export function useManaging(g: { is_official: boolean } | undefined): boolean {
  const { pathname } = useLocation();
  return !!g?.is_official && !pathname.startsWith("/member/");
}

/** sectionFor picks the section a user lands in for a group. */
export function sectionFor(g: { is_official: boolean }): Section {
  return g.is_official ? "group" : "member";
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

/**
 * AppShell is the layout for one group. It sends people to the section
 * their role allows: members away from /group, and admins who aren't
 * members away from /member.
 */
export function AppShell({ section }: { section: Section }) {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const me = useMe();
  const { pathname } = useLocation();

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
  if (section === "group" && !g.is_official) return <Navigate to={`/member/${g.id}`} replace />;
  if (section === "member" && g.my_membership_id == null) {
    return <Navigate to={pathname.replace(/^\/member\//, "/group/")} replace />;
  }
  rememberGroup(g.id);
  const base = `/${section}/${g.id}`;
  const disabled = me.data?.disabled_menus ?? [];
  // A switched-off menu also closes its page. Detail pages stay reachable
  // from elsewhere, like a member opened from the arrears list.
  if (isMenuOff(section, pathname.slice(base.length + 1), disabled)) return <Navigate to={base} replace />;
  return (
    <Shell
      label="Group"
      title={g.name}
      header={<GroupSwitcher g={g} section={section} />}
      nav={menuNav(section, base, g, disabled)}
    />
  );
}

function GroupSwitcher({ g, section }: { g: Group; section: Section }) {
  const role = g.platform_admin && g.my_membership_id == null ? "Platform admin" : section === "group" ? "Official" : "Member";
  return (
    <div>
      <Link
        to="/groups"
        className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
        title="Switch group"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white">
          {g.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{g.name}</span>
          <span className="block text-xs text-slate-500">{role}</span>
        </span>
        <ChevronsUpDown className="size-4 text-slate-400" aria-hidden />
      </Link>
      {g.is_official && g.my_membership_id != null && (
        <Link
          to={section === "group" ? `/member/${g.id}` : `/group/${g.id}`}
          className="mt-2 block px-3 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          {section === "group" ? "View as a member" : "Back to managing the group"}
        </Link>
      )}
    </div>
  );
}
