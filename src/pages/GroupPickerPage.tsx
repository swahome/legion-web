import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, LogOut } from "lucide-react";
import { useMe } from "../api/hooks";
import { useAuth } from "../auth/AuthProvider";
import { lastGroup } from "../components/AppShell";
import { Badge, EmptyState, ErrorState, Spinner } from "../components/ui";
import { fullName } from "../lib/format";

/**
 * GroupPickerPage lists the user's groups. "/" lands here and jumps
 * straight into the last group used, or the only one.
 */
export function GroupPickerPage({ autoEnter = false }: { autoEnter?: boolean }) {
  const me = useMe();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [groupIdInput, setGroupIdInput] = useState("");

  if (me.isPending) return <Spinner label="Loading your groups" />;
  if (me.isError)
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    );

  const { user, memberships, platform_roles } = me.data;
  const isAdmin = platform_roles.includes("admin");
  if (autoEnter && !params.has("pick")) {
    const last = lastGroup();
    if (last && memberships.some((m) => m.group_id === last)) return <Navigate to={`/g/${last}`} replace />;
    if (memberships.length === 1 && !isAdmin) return <Navigate to={`/g/${memberships[0]!.group_id}`} replace />;
  }

  function openById(e: FormEvent) {
    e.preventDefault();
    const id = Number(groupIdInput);
    if (id > 0) navigate(`/g/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Welcome back,</p>
          <h1 className="text-2xl font-semibold tracking-tight">{fullName(user)}</h1>
        </div>
        <button
          className="btn-ghost"
          onClick={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
        >
          <LogOut className="size-4" aria-hidden /> Log out
        </button>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Your groups</h2>
      <div className="card divide-y divide-slate-200 dark:divide-slate-800">
        {memberships.length === 0 && (
          <EmptyState title="You're not in any group yet">Ask a group official to add you using your phone number.</EmptyState>
        )}
        {memberships.map((m) => (
          <Link
            key={m.membership_id}
            to={`/g/${m.group_id}`}
            className="flex items-center gap-4 px-5 py-4 transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 font-semibold text-white">
              {m.group_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.group_name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {m.is_official ? <Badge tone="brand">Official</Badge> : <Badge>Member</Badge>}
                {m.role_name && <span>{m.role_name}</span>}
                {m.group_status !== "active" && <Badge tone="warn">{m.group_status}</Badge>}
              </span>
            </span>
            <ArrowRight className="size-4 text-slate-400" aria-hidden />
          </Link>
        ))}
      </div>

      {isAdmin && (
        <form onSubmit={openById} className="card mt-8 p-5">
          <h2 className="font-semibold">Open any group</h2>
          <p className="mt-1 text-sm text-slate-500">As a platform admin you can open any group as an official.</p>
          <div className="mt-4 flex gap-2">
            <label htmlFor="group-id" className="sr-only">
              Group ID
            </label>
            <input
              id="group-id"
              className="input max-w-40"
              inputMode="numeric"
              placeholder="Group ID"
              value={groupIdInput}
              onChange={(e) => setGroupIdInput(e.target.value.replace(/\D/g, ""))}
            />
            <button className="btn-primary" disabled={!groupIdInput}>
              Open
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
