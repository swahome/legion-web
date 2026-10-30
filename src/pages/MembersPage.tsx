import { useDeferredValue, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Search, UserPlus } from "lucide-react";
import { useAddMember, useGroup, useMembers, useRoles } from "../api/hooks";
import { useGroupBase, useGroupId, useManaging } from "../components/AppShell";
import { Avatar, Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../components/ui";
import { formatDate, fullName, initials } from "../lib/format";

export function MembersPage() {
  const base = useGroupBase();
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [adding, setAdding] = useState(false);
  const search = useDeferredValue(q.trim());
  const members = useMembers(groupId, status, search);
  const official = useManaging(group.data);

  return (
    <>
      <PageHeader
        title="Members"
        subtitle={members.data ? `${members.data.length} ${status === "active" ? "active " : ""}member${members.data.length === 1 ? "" : "s"}` : undefined}
        actions={
          official && (
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <UserPlus className="size-4" aria-hidden /> Add member
            </button>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor="member-search" className="sr-only">
            Search members
          </label>
          <input
            id="member-search"
            className="input pl-9"
            placeholder={official ? "Search by name, phone or member number" : "Search by name or member number"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {official && (
          <>
            <label htmlFor="member-status" className="sr-only">
              Status
            </label>
            <select id="member-status" className="input sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="removed">Removed</option>
              <option value="all">Everyone</option>
            </select>
          </>
        )}
      </div>

      {members.isPending ? (
        <Spinner label="Loading members" />
      ) : members.isError ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {members.data.length === 0 && <EmptyState title={search ? "No members match your search" : "No members here"} />}
          {members.data.map((m) => {
            const canOpen = official || m.id === group.data?.my_membership_id;
            const row = (
              <>
                <Avatar text={initials(m)} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{fullName(m)}</span>
                    {m.is_official && <Badge tone="brand">Official</Badge>}
                    {m.status !== "active" && <Badge tone={m.status === "removed" ? "danger" : "warn"}>{m.status}</Badge>}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-slate-500">
                    {[m.role_name, m.membership_number && `No. ${m.membership_number}`, m.phone].filter(Boolean).join(" · ") || `Joined ${formatDate(m.joined_at)}`}
                  </span>
                </span>
              </>
            );
            return canOpen ? (
              <Link key={m.id} to={`${base}/members/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {row}
              </Link>
            ) : (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                {row}
              </div>
            );
          })}
        </div>
      )}

      <AddMemberDialog groupId={groupId} open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function AddMemberDialog({ groupId, open, onClose }: { groupId: number; open: boolean; onClose: () => void }) {
  const base = useGroupBase();
  const add = useAddMember(groupId);
  const roles = useRoles(groupId);
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", membership_number: "", role_id: "", is_official: false });
  const set = (k: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  function close() {
    add.reset();
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = await add
      .mutateAsync({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        membership_number: form.membership_number.trim() || undefined,
        role_id: form.role_id ? Number(form.role_id) : null,
        is_official: form.is_official,
      })
      .catch(() => null);
    if (m) {
      setForm({ first_name: "", last_name: "", phone: "", email: "", membership_number: "", role_id: "", is_official: false });
      close();
      navigate(`${base}/members/${m.id}`);
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Add member">
      <form onSubmit={submit} className="space-y-4">
        <InlineError error={add.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="am-first">
            <input id="am-first" className="input" value={form.first_name} onChange={(e) => set("first_name")(e.target.value)} required />
          </Field>
          <Field label="Last name" htmlFor="am-last">
            <input id="am-last" className="input" value={form.last_name} onChange={(e) => set("last_name")(e.target.value)} />
          </Field>
        </div>
        <Field label="Phone number" htmlFor="am-phone" hint="If this person already uses Legion, their existing account is added to the group.">
          <input id="am-phone" className="input" inputMode="tel" placeholder="0712 345 678" value={form.phone} onChange={(e) => set("phone")(e.target.value)} required />
        </Field>
        <Field label="Email (optional)" htmlFor="am-email">
          <input id="am-email" type="email" className="input" value={form.email} onChange={(e) => set("email")(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Member number" htmlFor="am-number">
            <input id="am-number" className="input" value={form.membership_number} onChange={(e) => set("membership_number")(e.target.value)} />
          </Field>
          <Field label="Office" htmlFor="am-role">
            <select id="am-role" className="input" value={form.role_id} onChange={(e) => set("role_id")(e.target.value)}>
              <option value="">None</option>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Toggle id="am-official" label="Group official" hint="Officials can manage members and contributions." checked={form.is_official} onChange={set("is_official")} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={add.isPending || !form.first_name.trim() || !form.phone.trim()}>
            {add.isPending ? "Adding…" : "Add member"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
