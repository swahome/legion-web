import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ExternalLink, Pencil } from "lucide-react";
import { useAdminGroup, useUpdateGroup, type AdminGroupDetail, type GroupStatus } from "../../api/admin";
import { useContributions, useMembers } from "../../api/hooks";
import { useAccounts } from "../../api/money";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../../components/ui";
import { formatDate, formatMoney, frequencyLabels, fullName, kindLabels } from "../../lib/format";
import { statusChanges, StatusChangeConfirm } from "./AdminGroupsPage";
import { formatDateTime, StatusBadge, tbody, td, Th, theadRow } from "./widgets";

/** AdminGroupPage is everything an admin needs about one group on one page. */
export function AdminGroupPage() {
  const id = Number(useParams().groupId);
  const group = useAdminGroup(id);
  const update = useUpdateGroup(id);
  const [editing, setEditing] = useState(false);
  const [change, setChange] = useState<{ to: GroupStatus; label: string; danger?: boolean } | null>(null);

  if (group.isPending) return <Spinner label="Loading group" />;
  if (group.isError) return <ErrorState error={group.error} onRetry={() => group.refetch()} />;
  const g = group.data;

  return (
    <>
      <PageHeader
        title={g.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>Group #{g.id}</span>
            {g.legacy_id != null && g.legacy_id !== g.id && <span>· old number {g.legacy_id}</span>}
            <StatusBadge status={g.status} />
            {g.notifications_off && <Badge tone="warn">Notifications off</Badge>}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/group/${g.id}`} className="btn-primary">
              <ExternalLink className="size-4" aria-hidden /> Open as official
            </Link>
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> Edit
            </button>
            {statusChanges[g.status].map((c) => (
              <button key={c.to} className={c.danger ? "btn-ghost text-red-700 dark:text-red-400" : "btn-secondary"} onClick={() => setChange(c)}>
                {c.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Count label="Members" value={g.active_members} hint={`${g.registered_members} have signed in`} />
        <Count label="Contributions" value={g.contributions} />
        <Count label="Accounts" value={g.accounts} />
        <Count label="Loans" value={g.loans} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Group information</h2>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">
            <Row label="Signed up">{formatDate(g.created_at)}</Row>
            <Row label="Registered by">{g.created_by_name || "—"}</Row>
            <Row label="Contact">
              {g.contact ? (
                <>
                  <Link to={`/admin/users/${g.contact.user_id}`} className="hover:underline">
                    {g.contact.name}
                  </Link>
                  <div className="text-xs text-slate-500">{[g.contact.phone, g.contact.email].filter(Boolean).join(" · ")}</div>
                </>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Group phone">{g.phone ?? "—"}</Row>
            <Row label="Group email">{g.email ?? "—"}</Row>
            <Row label="Country">
              {g.country_code} · {g.currency} · {g.timezone}
            </Row>
            <Row label="Last seen">{g.last_seen_at ? formatDateTime(g.last_seen_at) : "No member has signed in"}</Row>
            <Row label="Last changed">{formatDateTime(g.updated_at)}</Row>
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Notifications</h2>
          <Toggle
            id="notifications-off"
            label="Switch off this group's texts"
            hint="Invoices, fine notices, invites and other texts for this group are dropped instead of sent. Sign-in and password codes still go out."
            checked={g.notifications_off}
            onChange={(v) => update.mutate({ notifications_off: v })}
          />
          {update.isError && !editing && change == null && (
            <div className="mt-3">
              <InlineError error={update.error} />
            </div>
          )}
          <h2 className="mt-6 mb-2 font-semibold">Billing</h2>
          <p className="text-sm text-slate-500">Billing packages and trials come in a later update. Every group is on the free plan for now.</p>
        </section>
      </div>

      <Members groupId={g.id} />
      <Contributions groupId={g.id} />
      <Accounts groupId={g.id} />

      <EditDialog group={g} open={editing} onClose={() => setEditing(false)} />
      <StatusChangeConfirm
        change={change ? { name: g.name, members: g.active_members, ...change } : null}
        pending={update.isPending}
        error={update.error}
        onClose={() => {
          setChange(null);
          update.reset();
        }}
        onConfirm={() => change && update.mutate({ status: change.to }, { onSuccess: () => setChange(null) })}
      />
    </>
  );
}

function Count({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="card overflow-x-auto">{children}</div>
    </section>
  );
}

function Members({ groupId }: { groupId: number }) {
  const members = useMembers(groupId);
  return (
    <Section title="Members">
      {members.isPending ? (
        <Spinner label="Loading members" />
      ) : members.isError ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : members.data.length === 0 ? (
        <EmptyState title="No members" />
      ) : (
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className={theadRow}>
              <Th>Name</Th>
              <Th>Phone and email</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody className={tbody}>
            {members.data.map((m) => (
              <tr key={m.id}>
                <td className={td}>
                  <Link to={`/admin/users/${m.user_id}`} className="font-medium hover:underline">
                    {fullName(m)}
                  </Link>
                </td>
                <td className={`${td} text-slate-600 dark:text-slate-300`}>
                  <div>{m.phone ?? "—"}</div>
                  <div className="text-xs text-slate-500">{m.email}</div>
                </td>
                <td className={td}>
                  {m.is_official && <Badge tone="brand">Official</Badge>} {m.role_name}
                </td>
                <td className={td}>{formatDate(m.joined_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function Contributions({ groupId }: { groupId: number }) {
  const list = useContributions(groupId);
  return (
    <Section title="Contribution settings">
      {list.isPending ? (
        <Spinner label="Loading contributions" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="No contributions set up" />
      ) : (
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className={theadRow}>
              <Th>Name</Th>
              <Th right>Amount</Th>
              <Th>How often</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className={tbody}>
            {list.data.map((c) => (
              <tr key={c.id}>
                <td className={`${td} font-medium`}>{c.name}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(c.amount)}</td>
                <td className={td}>{c.schedule?.frequency ? frequencyLabels[c.schedule.frequency] : kindLabels[c.kind]}</td>
                <td className={td}>{c.is_closed ? <Badge>Closed</Badge> : c.is_active ? <Badge tone="brand">Active</Badge> : <Badge>Inactive</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function Accounts({ groupId }: { groupId: number }) {
  const list = useAccounts(groupId);
  return (
    <Section title="Group accounts">
      {list.isPending ? (
        <Spinner label="Loading accounts" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.accounts.length === 0 ? (
        <EmptyState title="No accounts" />
      ) : (
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className={theadRow}>
              <Th>Account</Th>
              <Th>Institution</Th>
              <Th>Number</Th>
              <Th right>Balance</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className={tbody}>
            {list.data.accounts.map((a) => (
              <tr key={a.id}>
                <td className={`${td} font-medium`}>{a.name}</td>
                <td className={td}>{a.institution?.name ?? "—"}</td>
                <td className={`${td} tabular-nums`}>{a.account_number || "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(a.balance)}</td>
                <td className={td}>
                  {a.is_closed ? <Badge>Closed</Badge> : a.is_verified ? <Badge tone="brand">Verified</Badge> : <Badge>Not verified</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function EditDialog({ group, open, onClose }: { group: AdminGroupDetail; open: boolean; onClose: () => void }) {
  const update = useUpdateGroup(group.id);
  const [f, setF] = useState({ name: group.name, phone: group.phone ?? "", email: group.email ?? "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  function close() {
    update.reset();
    setF({ name: group.name, phone: group.phone ?? "", email: group.email ?? "" });
    onClose();
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      { name: f.name.trim(), phone: f.phone.trim() || null, email: f.email.trim() || null },
      { onSuccess: () => onClose() },
    );
  }
  return (
    <Dialog open={open} onClose={close} title="Edit group">
      <form onSubmit={submit} className="space-y-4">
        {update.isError && <InlineError error={update.error} />}
        <Field label="Name" htmlFor="g-name">
          <input id="g-name" className="input" value={f.name} onChange={set("name")} required />
        </Field>
        <Field label="Group phone" htmlFor="g-phone">
          <input id="g-phone" className="input" inputMode="tel" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Group email" htmlFor="g-email">
          <input id="g-email" className="input" type="email" value={f.email} onChange={set("email")} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn-primary" disabled={update.isPending || !f.name.trim()}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
