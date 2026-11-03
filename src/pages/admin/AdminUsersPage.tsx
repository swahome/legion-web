import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Download, Loader2 } from "lucide-react";
import { exportUsers, platformRoles, useAdminUsers, useSaveUser, type AdminUser } from "../../api/admin";
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
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [role, setRole] = useState(params.get("role") ?? "");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const adding = params.get("add") === "1";
  const setAdding = (v: boolean) => {
    const next = new URLSearchParams(params);
    if (v) next.set("add", "1");
    else next.delete("add");
    setParams(next, { replace: true });
  };
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
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
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                setExportError(null);
                try {
                  await exportUsers({ q: search, role, active });
                } catch (e) {
                  setExportError(e);
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              Export to CSV
            </button>
            <button className="btn-primary" onClick={() => setAdding(true)}>
              Add user
            </button>
          </div>
        }
      />
      {exportError != null && (
        <div className="mb-4">
          <InlineError error={exportError} />
        </div>
      )}
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
                  <Th>Groups</Th>
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
                    <td className={td}>
                      <UserGroups groups={u.group_list ?? []} />
                    </td>
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

function UserGroups({ groups }: { groups: NonNullable<AdminUser["group_list"]> }) {
  const [all, setAll] = useState(false);
  if (groups.length === 0) return <span className="text-slate-400">None</span>;
  const shown = all ? groups : groups.slice(0, 3);
  return (
    <ul className="space-y-0.5">
      {shown.map((g) => (
        <li key={g.group_id}>
          <Link to={`/admin/groups/${g.group_id}`} className="hover:underline">
            {g.group_name}
          </Link>
          {g.is_official && <span className="ml-1 text-xs text-slate-500">(official)</span>}
        </li>
      ))}
      {groups.length > 3 && (
        <li>
          <button className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => setAll(!all)}>
            {all ? "Show fewer" : `and ${groups.length - 3} more`}
          </button>
        </li>
      )}
    </ul>
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
