import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { platformRoles, useAdminUser, useSaveUser, useSetPassword, type AdminUser, type PlatformRole } from "../../api/admin";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../../components/ui";
import { formatDate, fullName } from "../../lib/format";
import { roleLabels } from "./AdminUsersPage";
import { ActiveBadge, Confirm, formatDateTime } from "./widgets";

export function AdminUserPage() {
  const id = Number(useParams().userId);
  const user = useAdminUser(id);
  const save = useSaveUser(id);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState(false);
  const [deactivate, setDeactivate] = useState(false);

  if (user.isPending) return <Spinner label="Loading user" />;
  if (user.isError) return <ErrorState error={user.error} onRetry={() => user.refetch()} />;
  const u = user.data;

  function toggleRole(r: PlatformRole, on: boolean) {
    const roles = on ? [...u.platform_roles, r] : u.platform_roles.filter((x) => x !== r);
    save.mutate({ platform_roles: roles });
  }

  return (
    <>
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="size-4" aria-hidden /> Users
      </Link>
      <PageHeader
        title={fullName(u)}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ActiveBadge active={u.is_active} /> User #{u.id} · joined {formatDate(u.created_at)} · last sign-in {formatDateTime(u.last_login_at)}
          </span>
        }
        actions={
          <>
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              Edit details
            </button>
            <button className="btn-secondary" onClick={() => setPassword(true)}>
              Set password
            </button>
            {u.is_active ? (
              <button className="btn-secondary text-rose-700" onClick={() => setDeactivate(true)}>
                Deactivate
              </button>
            ) : (
              <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate({ is_active: true })}>
                Reactivate
              </button>
            )}
          </>
        }
      />
      {!deactivate && <InlineError error={save.error} />}

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Contact</h2>
          <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
            <dt className="text-slate-500">Phone</dt>
            <dd>{u.phone ?? "—"}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="break-all">{u.email ?? "—"}</dd>
            <dt className="text-slate-500">ID number</dt>
            <dd>{u.id_number ?? "—"}</dd>
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Platform roles</h2>
          <p className="mt-1 text-sm text-slate-500">Admins can use this panel. The other roles carry over from the old system for later features.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {platformRoles.map((r) => (
              <Toggle
                key={r}
                id={`role-${r}`}
                label={roleLabels[r] ?? r}
                checked={u.platform_roles.includes(r)}
                onChange={(on) => toggleRole(r, on)}
              />
            ))}
          </div>
        </section>
      </div>

      <h2 className="mt-8 mb-3 font-semibold">Groups</h2>
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {u.memberships?.length === 0 && <EmptyState title="Not in any group" />}
        {u.memberships?.map((m) => (
          <div key={m.membership_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <Link to={`/group/${m.group_id}/members/${m.membership_id}`} className="font-medium hover:underline">
              {m.group_name}
            </Link>
            <span className="flex items-center gap-2">
              {m.is_official ? <Badge tone="brand">{m.role_name ?? "Official"}</Badge> : <Badge>{m.role_name ?? "Member"}</Badge>}
              {m.status !== "active" && <Badge tone="warn">{m.status}</Badge>}
            </span>
          </div>
        ))}
      </div>

      <EditUserDialog u={u} open={editing} onClose={() => setEditing(false)} />
      <PasswordDialog id={u.id} open={password} onClose={() => setPassword(false)} />
      <Confirm
        open={deactivate}
        title={`Deactivate ${fullName(u)}?`}
        action="Deactivate"
        danger
        pending={save.isPending}
        error={save.error}
        onClose={() => {
          setDeactivate(false);
          save.reset();
        }}
        onConfirm={() => save.mutate({ is_active: false }, { onSuccess: () => setDeactivate(false) })}
      >
        <p>They won't be able to sign in until an admin reactivates them. Their group records stay as they are.</p>
      </Confirm>
    </>
  );
}

function EditUserDialog({ u, open, onClose }: { u: AdminUser; open: boolean; onClose: () => void }) {
  const save = useSaveUser(u.id);
  const [f, setF] = useState({
    first_name: u.first_name,
    middle_name: u.middle_name,
    last_name: u.last_name,
    phone: u.phone ?? "",
    email: u.email ?? "",
    id_number: u.id_number ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      {
        first_name: f.first_name.trim(),
        middle_name: f.middle_name.trim(),
        last_name: f.last_name.trim(),
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        id_number: f.id_number.trim() || null,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title="Edit details">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" htmlFor="eu-first">
            <input id="eu-first" className="input" required value={f.first_name} onChange={set("first_name")} />
          </Field>
          <Field label="Middle name" htmlFor="eu-middle">
            <input id="eu-middle" className="input" value={f.middle_name} onChange={set("middle_name")} />
          </Field>
          <Field label="Last name" htmlFor="eu-last">
            <input id="eu-last" className="input" required value={f.last_name} onChange={set("last_name")} />
          </Field>
        </div>
        <Field label="Phone" htmlFor="eu-phone">
          <input id="eu-phone" className="input" inputMode="tel" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Email" htmlFor="eu-email">
          <input id="eu-email" type="email" className="input" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="ID number" htmlFor="eu-idno">
          <input id="eu-idno" className="input" value={f.id_number} onChange={set("id_number")} />
        </Field>
        <InlineError error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={save.isPending}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function PasswordDialog({ id, open, onClose }: { id: number; open: boolean; onClose: () => void }) {
  const set = useSetPassword(id);
  const [pw, setPw] = useState("");
  const close = () => {
    setPw("");
    set.reset();
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} title="Set password">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // require_change stays off until sign-up (milestone 5) adds the
          // reset flow; today a flagged user couldn't sign in at all.
          set.mutate({ password: pw, require_change: false }, { onSuccess: close });
        }}
        className="space-y-4"
      >
        <Field label="New password" htmlFor="pw-new" hint="At least 8 characters. The user is signed out everywhere.">
          <input id="pw-new" type="password" className="input" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <InlineError error={set.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button className="btn-primary" disabled={set.isPending}>
            Set password
          </button>
        </div>
      </form>
    </Dialog>
  );
}
