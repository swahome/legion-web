import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Download, Loader2 } from "lucide-react";
import { exportGroups, useAdminGroups, useSetGroupStatus, type AdminGroup, type GroupListParams, type GroupStatus } from "../../api/admin";
import { EmptyState, ErrorState, InlineError, PageHeader, Spinner } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { Confirm, formatDateTime, Pager, SearchBox, StatusBadge, tbody, td, Th, theadRow, useDebounced } from "./widgets";

export const statusChanges: Record<GroupStatus, { to: GroupStatus; label: string; danger?: boolean }[]> = {
  setup: [{ to: "active", label: "Activate" }],
  active: [
    { to: "suspended", label: "Lock", danger: true },
    { to: "closed", label: "Archive", danger: true },
  ],
  suspended: [
    { to: "active", label: "Unlock" },
    { to: "closed", label: "Archive", danger: true },
  ],
  closed: [{ to: "active", label: "Restore" }],
};

export type GroupView = "all" | "setup" | "locked" | "archived" | "inactive";

const views: Record<GroupView, { title: string; subtitle: string; params: GroupListParams }> = {
  all: { title: "Groups", subtitle: "Find any group by name, number or phone, open it, or lock it.", params: {} },
  setup: { title: "Groups setting up", subtitle: "Groups that have signed up but haven't finished setup.", params: { status: "setup" } },
  locked: { title: "Locked groups", subtitle: "Members can't use these groups until an admin unlocks them.", params: { status: "suspended" } },
  archived: { title: "Archived groups", subtitle: "Closed groups. Their records are kept; restoring one lets members back in.", params: { status: "closed" } },
  inactive: {
    title: "Potential archives",
    subtitle: "Active groups nobody has signed in to for 90 days.",
    params: { view: "inactive" },
  },
};

export function AdminGroupsPage({ view = "all" }: { view?: GroupView }) {
  const v = views[view];
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const sort = params.get("sort") === "newest" ? "newest" : "name";
  const search = useDebounced(q);
  const filters: GroupListParams = { ...v.params, q: search, sort: sort === "newest" ? "newest" : undefined };
  if (view === "all" && status) filters.status = status;
  const groups = useAdminGroups({ ...filters, page });
  const [change, setChange] = useState<{ g: AdminGroup; to: GroupStatus; label: string; danger?: boolean } | null>(null);
  const setGroupStatus = useSetGroupStatus();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  async function download() {
    setExporting(true);
    setExportError(null);
    try {
      await exportGroups(filters);
    } catch (e) {
      setExportError(e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={v.title}
        subtitle={v.subtitle}
        actions={
          <button className="btn-secondary" onClick={download} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Export to CSV
          </button>
        }
      />
      {exportError != null && (
        <div className="mb-4">
          <InlineError error={exportError} />
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox
          label="Search name, number or phone"
          value={q}
          onChange={(x) => {
            setQ(x);
            setPage(1);
          }}
        />
        {view === "all" && (
          <select
            className="input w-auto"
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="setup">Setting up</option>
            <option value="suspended">Locked</option>
            <option value="closed">Archived</option>
          </select>
        )}
        <select
          className="input w-auto"
          aria-label="Sort"
          value={sort}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value === "newest") next.set("sort", "newest");
            else next.delete("sort");
            setParams(next, { replace: true });
            setPage(1);
          }}
        >
          <option value="name">By name</option>
          <option value="newest">Newest first</option>
        </select>
      </div>
      {groups.isPending ? (
        <Spinner label="Loading groups" />
      ) : groups.isError ? (
        <ErrorState error={groups.error} onRetry={() => groups.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {groups.data.items.length === 0 ? (
            <EmptyState title="No groups match" />
          ) : (
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className={theadRow}>
                  <Th>Group</Th>
                  <Th>Contact</Th>
                  <Th right>Members</Th>
                  <Th>Status</Th>
                  <Th>Last seen</Th>
                  <Th>Joined</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className={tbody}>
                {groups.data.items.map((g) => (
                  <tr key={g.id}>
                    <td className={td}>
                      <Link to={`/admin/groups/${g.id}`} className="font-medium hover:underline">
                        {g.name}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">#{g.id}</span>
                    </td>
                    <td className={`${td} text-slate-600 dark:text-slate-300`}>
                      {g.contact ? (
                        <>
                          <Link to={`/admin/users/${g.contact.user_id}`} className="hover:underline">
                            {g.contact.name}
                          </Link>
                          <div className="text-xs text-slate-500">{[g.contact.phone, g.contact.email].filter(Boolean).join(" · ")}</div>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={`${td} text-right tabular-nums`} title={`${g.registered_members} of ${g.active_members} have signed in`}>
                      {g.active_members}
                      <div className="text-xs whitespace-nowrap text-slate-500">{g.registered_members} signed in</div>
                    </td>
                    <td className={td}>
                      <StatusBadge status={g.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{g.last_seen_at ? formatDateTime(g.last_seen_at) : "Never"}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(g.created_at)}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <Link to={`/group/${g.id}`} className="btn-ghost px-2 py-1 text-xs" title="Open the group as an official">
                        Open
                      </Link>
                      {statusChanges[g.status].map((c) => (
                        <button key={c.to} className="btn-ghost px-2 py-1 text-xs" onClick={() => setChange({ g, ...c })}>
                          {c.label}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pager data={groups.data} onPage={setPage} />
        </div>
      )}
      <StatusChangeConfirm
        change={change ? { name: change.g.name, members: change.g.active_members, to: change.to, label: change.label, danger: change.danger } : null}
        pending={setGroupStatus.isPending}
        error={setGroupStatus.error}
        onClose={() => {
          setChange(null);
          setGroupStatus.reset();
        }}
        onConfirm={() => change && setGroupStatus.mutate({ id: change.g.id, status: change.to }, { onSuccess: () => setChange(null) })}
      />
    </>
  );
}

/** StatusChangeConfirm asks before a group is locked, archived or let back in. */
export function StatusChangeConfirm({
  change,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  change: { name: string; members: number; to: GroupStatus; label: string; danger?: boolean } | null;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Confirm
      open={change != null}
      title={`${change?.label} ${change?.name}?`}
      action={change?.label ?? ""}
      danger={change?.danger}
      pending={pending}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      {change?.to === "active" ? (
        <p>Members will be able to use the group again.</p>
      ) : (
        <p>
          The group's {change?.members} members will lose access until a platform admin lets them back in. Its records are kept, and platform
          admins can still open it.
        </p>
      )}
    </Confirm>
  );
}
