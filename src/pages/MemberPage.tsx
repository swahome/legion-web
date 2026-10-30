import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, Pencil } from "lucide-react";
import { useGroup, useMember, useRoles, useUpdateMember } from "../api/hooks";
import type { Member, MembershipStatus } from "../api/types";
import { useGroupId } from "../components/AppShell";
import { StatementView } from "../components/StatementView";
import { Avatar, Badge, Dialog, ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../components/ui";
import { formatDate, fullName, initials } from "../lib/format";

/** MemberPage shows one member's details and contribution statement. */
export function MemberPage() {
  const groupId = useGroupId();
  const memberId = Number(useParams().memberId);
  const group = useGroup(groupId);
  const member = useMember(groupId, memberId);
  const [editing, setEditing] = useState(false);

  if (member.isPending) return <Spinner label="Loading member" />;
  if (member.isError) return <ErrorState error={member.error} />;
  const m = member.data;
  const official = group.data?.is_official ?? false;

  return (
    <>
      <Link to={`/g/${groupId}/members`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ChevronLeft className="size-4" aria-hidden /> Members
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar text={initials(m)} className="size-11 text-sm" />
            {fullName(m)}
          </span>
        }
        actions={
          official && (
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> Edit membership
            </button>
          )
        }
      />
      <MemberDetails m={m} />
      <h2 className="mt-10 mb-4 text-lg font-semibold">Contribution statement</h2>
      <StatementView groupId={groupId} memberId={memberId} />
      {official && editing && <EditMemberDialog groupId={groupId} member={m} open onClose={() => setEditing(false)} />}
    </>
  );
}

export function MyStatementPage() {
  const groupId = useGroupId();
  const group = useGroup(groupId);
  const me = group.data?.my_membership_id;
  if (!group.data) return <Spinner />;
  if (me == null) return <ErrorState error={new Error("You are not a member of this group, so you have no statement here.")} />;
  return (
    <>
      <PageHeader title="My statement" subtitle="Everything you've been invoiced and paid towards contributions." />
      <StatementView groupId={groupId} memberId={me} />
    </>
  );
}

function MemberDetails({ m }: { m: Member }) {
  const items: [string, React.ReactNode][] = [
    ["Status", <Badge key="s" tone={m.status === "active" ? "brand" : m.status === "removed" ? "danger" : "warn"}>{m.status}</Badge>],
    ["Office", m.is_official ? `${m.role_name ?? "Official"}` : (m.role_name ?? "Member")],
    ["Member number", m.membership_number ?? "—"],
    ["Phone", m.phone ?? "—"],
    ["Email", m.email ?? "—"],
    ["Joined", formatDate(m.joined_at)],
  ];
  if (m.date_of_birth) items.push(["Date of birth", formatDate(m.date_of_birth)]);
  if (m.postal_address) items.push(["Postal address", m.postal_address]);
  if (m.physical_address) items.push(["Physical address", m.physical_address]);
  return (
    <dl className="card grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium text-slate-500 uppercase">{k}</dt>
          <dd className="mt-1 text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function EditMemberDialog({ groupId, member, open, onClose }: { groupId: number; member: Member; open: boolean; onClose: () => void }) {
  const update = useUpdateMember(groupId, member.id);
  const roles = useRoles(groupId);
  const [form, setForm] = useState({
    is_official: member.is_official,
    role_id: member.role_id ? String(member.role_id) : "",
    membership_number: member.membership_number ?? "",
    status: member.status as MembershipStatus,
  });

  function close() {
    update.reset();
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await update
      .mutateAsync({
        is_official: form.is_official,
        role_id: form.role_id ? Number(form.role_id) : null,
        membership_number: form.membership_number.trim() || undefined,
        status: form.status,
      })
      .catch(() => null);
    if (ok) close();
  }

  return (
    <Dialog open={open} onClose={close} title={`Edit ${fullName(member)}`}>
      <form onSubmit={submit} className="space-y-4">
        <InlineError error={update.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Office" htmlFor="em-role">
            <select id="em-role" className="input" value={form.role_id} onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}>
              <option value="">None</option>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Member number" htmlFor="em-number">
            <input id="em-number" className="input" value={form.membership_number} onChange={(e) => setForm((f) => ({ ...f, membership_number: e.target.value }))} />
          </Field>
        </div>
        <Field label="Status" htmlFor="em-status" hint="Suspended and removed members can no longer open the group.">
          <select id="em-status" className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MembershipStatus }))}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="removed">Removed</option>
          </select>
        </Field>
        <Toggle id="em-official" label="Group official" checked={form.is_official} onChange={(v) => setForm((f) => ({ ...f, is_official: v }))} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
