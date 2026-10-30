import { useState } from "react";
import { Link } from "react-router";
import { useAdminGroups, useSetGroupStatus, type AdminGroup, type GroupStatus } from "../../api/admin";
import { EmptyState, ErrorState, PageHeader, Spinner } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { Confirm, Pager, SearchBox, StatusBadge, tbody, td, Th, theadRow, useDebounced } from "./widgets";

const statusChanges: Record<GroupStatus, { to: GroupStatus; label: string; danger?: boolean }[]> = {
  setup: [{ to: "active", label: "Activate" }],
  active: [
    { to: "suspended", label: "Suspend", danger: true },
    { to: "closed", label: "Close", danger: true },
  ],
  suspended: [
    { to: "active", label: "Reactivate" },
    { to: "closed", label: "Close", danger: true },
  ],
  closed: [{ to: "active", label: "Reopen" }],
};

export function AdminGroupsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const groups = useAdminGroups({ q: search, status, page });
  const [change, setChange] = useState<{ g: AdminGroup; to: GroupStatus; label: string; danger?: boolean } | null>(null);
  const setGroupStatus = useSetGroupStatus();

  return (
    <>
      <PageHeader title="Groups" subtitle="Find any group, open it as an official, or suspend it." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox
          label="Search by name or ID"
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
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
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
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
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className={theadRow}>
                  <Th>Group</Th>
                  <Th>Status</Th>
                  <Th right>Members</Th>
                  <Th>Created</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className={tbody}>
                {groups.data.items.map((g) => (
                  <tr key={g.id}>
                    <td className={td}>
                      <Link to={`/group/${g.id}`} className="font-medium hover:underline">
                        {g.name}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">#{g.id}</span>
                    </td>
                    <td className={td}>
                      <StatusBadge status={g.status} />
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{g.active_members}</td>
                    <td className={td}>{formatDate(g.created_at)}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
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
      <Confirm
        open={change != null}
        title={`${change?.label} ${change?.g.name}?`}
        action={change?.label ?? ""}
        danger={change?.danger}
        pending={setGroupStatus.isPending}
        error={setGroupStatus.error}
        onClose={() => {
          setChange(null);
          setGroupStatus.reset();
        }}
        onConfirm={() =>
          change && setGroupStatus.mutate({ id: change.g.id, status: change.to }, { onSuccess: () => setChange(null) })
        }
      >
        {change?.to === "active" ? (
          <p>Members will be able to use the group again.</p>
        ) : (
          <p>
            The group's {change?.g.active_members} members will lose access until a platform admin reactivates it. Platform admins can still open
            it.
          </p>
        )}
      </Confirm>
    </>
  );
}
