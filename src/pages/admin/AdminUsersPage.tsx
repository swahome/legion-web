import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { platformRoles, useAdminUsers, useSaveUser } from "../../api/admin";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner } from "../../components/ui";
import { fullName } from "../../lib/format";
import { ActiveBadge, formatDateTime, Pager, SearchBox, tbody, td, Th, theadRow, useDebounced } from "./widgets";

export const roleLabels: Record<string, string> = {
  admin: "Admin",
  group_account_manager: "Group account manager",
  banker: "Banker",
  partner: "Partner",
  sales: "Sales",
  diocese_admin: "Diocese admin",
  deanery_admin: "Deanery admin",
  parish_admin: "Parish admin",
  sub_parish_admin: "Sub-parish admin",
};

export function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const search = useDebounced(q);
  const users = useAdminUsers({ q: search, role, active, page });
  const reset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone with a Legion login."
        actions={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            Add user
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox label="Search name, phone or email" value={q} onChange={reset(setQ)} />
        <select className="input w-auto" aria-label="Platform role" value={role} onChange={(e) => reset(setRole)(e.target.value)}>
          <option value="">Any role</option>
          {platformRoles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
        <select className="input w-auto" aria-label="Account status" value={active} onChange={(e) => reset(setActive)(e.target.value)}>
          <option value="">Active and inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      {users.isPending ? (
        <Spinner label="Loading users" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {users.data.items.length === 0 ? (
            <EmptyState title="No users match" />
          ) : (
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className={theadRow}>
                  <Th>Name</Th>
                  <Th>Phone and email</Th>
                  <Th right>Groups</Th>
                  <Th>Last sign-in</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {users.data.items.map((u) => (
                  <tr key={u.id}>
                    <td className={td}>
                      <Link to={`/admin/users/${u.id}`} className="font-medium hover:underline">
                        {fullName(u)}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.platform_roles.map((r) => (
                          <Badge key={r} tone="brand">
                            {roleLabels[r] ?? r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className={`${td} text-slate-600 dark:text-slate-300`}>
                      <div>{u.phone ?? "—"}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{u.groups ?? 0}</td>
                    <td className={td}>{formatDateTime(u.last_login_at)}</td>
                    <td className={td}>
                      <ActiveBadge active={u.is_active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pager data={users.data} onPage={setPage} />
        </div>
      )}
      <AddUserDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const save = useSaveUser();
  const navigate = useNavigate();
  const [f, setF] = useState({ first_name: "", last_name: "", phone: "", email: "", password: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const u = await save.mutateAsync({
      first_name: f.first_name.trim(),
      last_name: f.last_name.trim(),
      phone: f.phone.trim() || undefined,
      email: f.email.trim() || undefined,
      password: f.password,
    });
    onClose();
    navigate(`/admin/users/${u.id}`);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add user">
      <form onSubmit={(e) => void submit(e).catch(() => {})} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="nu-first">
            <input id="nu-first" className="input" required value={f.first_name} onChange={set("first_name")} />
          </Field>
          <Field label="Last name" htmlFor="nu-last">
            <input id="nu-last" className="input" required value={f.last_name} onChange={set("last_name")} />
          </Field>
        </div>
        <Field label="Phone" htmlFor="nu-phone" hint="Used to sign in. 0712 345 678 or +254 712 345 678.">
          <input id="nu-phone" className="input" inputMode="tel" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Email" htmlFor="nu-email" hint="Optional if there's a phone number.">
          <input id="nu-email" type="email" className="input" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Password" htmlFor="nu-pw" hint="At least 8 characters. Share it with the user privately.">
          <input id="nu-pw" type="password" className="input" required minLength={8} autoComplete="new-password" value={f.password} onChange={set("password")} />
        </Field>
        <InlineError error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={save.isPending || (!f.phone.trim() && !f.email.trim())}>
            Add user
          </button>
        </div>
      </form>
    </Dialog>
  );
}
