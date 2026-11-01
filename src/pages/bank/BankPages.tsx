import { useState, type FormEvent } from "react";
import { Link, Navigate, useOutletContext, useParams, useSearchParams } from "react-router";
import { ArrowLeftRight, Building2, LayoutDashboard, UserCog } from "lucide-react";
import {
  alertStatusLabels,
  useAddBankUser,
  useBank,
  useBankAlerts,
  useBankDashboard,
  useBankGroup,
  useBankGroups,
  useBankUsers,
  useMyBanks,
  useRemoveBankUser,
  type AlertStatus,
  type BankPanel,
  type BankUser,
} from "../../api/payments";
import { Shell, type NavItem } from "../../components/Shell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Stat } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/format";
import { Confirm, Pager, SearchBox, StatusBadge, formatDateTime, tbody, td, theadRow, useDebounced } from "../admin/widgets";
import { DateRange, todayISO } from "../money/shared";
import { AlertsTable } from "../payments/ReconciliationPage";

/** BankHome sends bank staff to their bank's panel. */
export function BankHome() {
  const banks = useMyBanks();
  if (banks.isPending) return <Spinner label="Loading" />;
  if (banks.isError) return <ErrorState error={banks.error} onRetry={() => banks.refetch()} />;
  if (banks.data.length === 1) return <Navigate to={`/bank/${banks.data[0]!.id}`} replace />;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHeader title="Bank panels" subtitle="Pick a bank." />
      {banks.data.length === 0 ? (
        <div className="card">
          <EmptyState title="You are not on any bank's staff" />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {banks.data.map((b) => (
            <li key={b.id}>
              <Link to={`/bank/${b.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <span className="font-medium">{b.name}</span>
                <Badge>{b.role}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const useBankId = () => Number(useParams().bankId);
const useBankPanel = () => useOutletContext<BankPanel>();

/** BankShell is the layout for one bank's panel. */
export function BankShell() {
  const bankId = useBankId();
  const bank = useBank(bankId);
  if (bank.isPending) return <Spinner label="Loading" />;
  if (bank.isError)
    return (
      <div className="mx-auto max-w-md p-10">
        <ErrorState error={bank.error} />
      </div>
    );
  const base = `/bank/${bankId}`;
  const nav: NavItem[] = [
    { to: base, label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: `${base}/groups`, label: "Groups", icon: Building2 },
    { to: `${base}/transactions`, label: "Transactions", icon: ArrowLeftRight },
    { to: `${base}/staff`, label: "Staff", icon: UserCog },
  ];
  return (
    <Shell
      label="Bank"
      title={bank.data.name}
      nav={nav}
      header={
        <Link to="/groups" className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800" title="Go to your groups">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white">{bank.data.name.slice(0, 1)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{bank.data.name}</span>
            <span className="block text-xs text-slate-500">{bank.data.role === "admin" ? "Bank admin" : "Bank staff"}</span>
          </span>
        </Link>
      }
      context={bank.data}
    />
  );
}

function monthStart(): string {
  return todayISO().slice(0, 8) + "01";
}

export function BankDashboardPage() {
  const bankId = useBankId();
  const [range, setRange] = useState({ from: monthStart(), to: todayISO() });
  const d = useBankDashboard(bankId, range);
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Groups banking with you, by branch." actions={<DateRange from={range.from} to={range.to} onChange={setRange} />} />
      {d.isPending ? (
        <Spinner />
      ) : d.isError ? (
        <ErrorState error={d.error} onRetry={() => d.refetch()} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Groups" value={d.data.totals.groups.toLocaleString()} hint={`${d.data.totals.new_groups} new in this period`} />
            <Stat label="Accounts" value={d.data.totals.accounts.toLocaleString()} />
            <Stat label="Money in" value={formatMoney(d.data.totals.money_in)} hint={`${d.data.totals.alerts} transactions`} />
            <Stat label="Money out" value={formatMoney(d.data.totals.money_out)} />
          </div>
          <div className="card overflow-x-auto">
            {d.data.branches.length === 0 ? (
              <EmptyState title="No group accounts at this bank yet" />
            ) : (
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className={theadRow}>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 text-right font-medium">Groups</th>
                    <th className="px-4 py-3 text-right font-medium">New</th>
                    <th className="px-4 py-3 text-right font-medium">Accounts</th>
                    <th className="px-4 py-3 text-right font-medium">Money in</th>
                    <th className="px-4 py-3 text-right font-medium">Money out</th>
                  </tr>
                </thead>
                <tbody className={tbody}>
                  {d.data.branches.map((b) => (
                    <tr key={b.branch_id ?? 0}>
                      <td className={td}>
                        {b.branch_id ? (
                          <Link className="font-medium hover:underline" to={`/bank/${bankId}/groups?branch=${b.branch_id}`}>
                            {b.branch}
                          </Link>
                        ) : (
                          <span className="text-slate-500">{b.branch || "No branch"}</span>
                        )}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{b.groups}</td>
                      <td className={`${td} text-right tabular-nums`}>{b.new_groups}</td>
                      <td className={`${td} text-right tabular-nums`}>{b.accounts}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatMoney(b.money_in)}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatMoney(b.money_out)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}

export function BankGroupsPage() {
  const bankId = useBankId();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [params] = useSearchParams();
  const branch = Number(params.get("branch")) || undefined;
  const [page, setPage] = useState(1);
  const list = useBankGroups(bankId, { search: q, branch_id: branch, page });
  return (
    <>
      <PageHeader title="Groups" subtitle={branch ? "Groups with an account at this branch." : "Groups with an account at the bank."} />
      <div className="mb-4 flex">
        <SearchBox value={search} onChange={(v) => (setSearch(v), setPage(1))} label="Search by name or account number" />
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No groups found" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Accounts</th>
                <th className="px-4 py-3 text-right font-medium">Members</th>
                <th className="px-4 py-3 text-right font-medium">To reconcile</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {list.data.items.map((g) => (
                <tr key={g.id}>
                  <td className={td}>
                    <Link className="font-medium hover:underline" to={`/bank/${bankId}/groups/${g.id}`}>
                      {g.name}
                    </Link>
                    <span className="block text-xs text-slate-500">Since {formatDate(g.created_at)}</span>
                  </td>
                  <td className={td}>
                    {g.account_numbers}
                    <span className="block text-xs text-slate-500">{g.branches}</span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{g.members}</td>
                  <td className={`${td} text-right tabular-nums`}>{g.unreconciled || "—"}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>{formatMoney(g.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
    </>
  );
}

export function BankGroupPage() {
  const bankId = useBankId();
  const groupId = Number(useParams().groupId);
  const group = useBankGroup(bankId, groupId);
  const [page, setPage] = useState(1);
  const alerts = useBankAlerts(bankId, { group_id: groupId, page });
  if (group.isPending) return <Spinner />;
  if (group.isError) return <ErrorState error={group.error} />;
  const g = group.data;
  return (
    <>
      <PageHeader
        title={g.name}
        subtitle={
          <>
            <StatusBadge status={g.status} /> · {g.members} members · since {formatDate(g.created_at)}
          </>
        }
      />
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 text-right font-medium">Balance in Legion</th>
            </tr>
          </thead>
          <tbody className={tbody}>
            {g.accounts.map((a) => (
              <tr key={a.id}>
                <td className={td}>
                  <span className="font-medium">{a.account_number}</span> {a.is_default && <Badge tone="brand">Default</Badge>} {a.is_closed && <Badge>Closed</Badge>}
                  <span className="block text-xs text-slate-500">{a.name}</span>
                </td>
                <td className={td}>{a.branch || "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(a.balance, g.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mb-3 text-lg font-semibold">Transactions</h2>
      {alerts.isPending ? (
        <Spinner />
      ) : alerts.isError ? (
        <ErrorState error={alerts.error} />
      ) : alerts.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No transactions reported yet" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <AlertsTable items={alerts.data.items} currency={g.currency} />
          <Pager data={alerts.data} onPage={setPage} />
        </div>
      )}
    </>
  );
}

export function BankAlertsPage() {
  const bankId = useBankId();
  const [status, setStatus] = useState<AlertStatus | "">("");
  const [page, setPage] = useState(1);
  const list = useBankAlerts(bankId, { status, page });
  return (
    <>
      <PageHeader title="Transactions" subtitle="What your feed sent us for group accounts, and whether the group has reconciled it." />
      <div className="mb-4">
        <label className="text-sm">
          <span className="label">Status</span>
          <select className="input" value={status} onChange={(e) => (setStatus(e.target.value as AlertStatus | ""), setPage(1))}>
            <option value="">All</option>
            {Object.entries(alertStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No transactions" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <AlertsTable items={list.data.items} currency="KES" showGroup />
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
    </>
  );
}

export function BankStaffPage() {
  const bankId = useBankId();
  const bank = useBankPanel();
  const users = useBankUsers(bankId);
  const remove = useRemoveBankUser(bankId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<BankUser | null>(null);
  const isAdmin = bank.role === "admin";
  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="People who can open this panel. Admins can add and remove staff."
        actions={
          isAdmin && (
            <button className="btn-primary" onClick={() => setAdding(true)}>
              Add staff
            </button>
          )
        }
      />
      {users.isPending ? (
        <Spinner />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : users.data.length === 0 ? (
        <div className="card">
          <EmptyState title="No staff yet" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className={tbody}>
              {users.data.map((u) => (
                <tr key={u.user_id}>
                  <td className={td}>
                    <span className="font-medium">{u.name}</span>
                    {u.email && <span className="block text-xs text-slate-500">{u.email}</span>}
                  </td>
                  <td className={td}>{u.phone}</td>
                  <td className={td}>
                    <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{u.role === "admin" ? "Admin" : "Staff"}</Badge>
                  </td>
                  <td className={td}>{formatDateTime(u.created_at)}</td>
                  <td className={`${td} text-right`}>
                    {isAdmin && (
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setRemoving(u)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <AddStaffDialog bankId={bankId} onClose={() => setAdding(false)} />}
      <Confirm
        open={!!removing}
        title="Remove from staff?"
        action="Remove"
        danger
        pending={remove.isPending}
        error={remove.error}
        onClose={() => (remove.reset(), setRemoving(null))}
        onConfirm={async () => {
          if (removing && (await remove.mutateAsync(removing.user_id).then(() => true).catch(() => false))) setRemoving(null);
        }}
      >
        <p>{removing?.name} will no longer be able to open this bank's panel.</p>
      </Confirm>
    </>
  );
}

function AddStaffDialog({ bankId, onClose }: { bankId: number; onClose: () => void }) {
  const add = useAddBankUser(bankId);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await add.mutateAsync({ phone: phone.trim(), role }).then(() => true).catch(() => false)) onClose();
  }
  return (
    <Dialog open onClose={onClose} title="Add staff">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Phone number" htmlFor="staff-phone" hint="They need a Legion account first.">
          <input id="staff-phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Field label="Role" htmlFor="staff-role">
          <select id="staff-role" className="input" value={role} onChange={(e) => setRole(e.target.value as "admin" | "staff")}>
            <option value="staff">Staff: can view</option>
            <option value="admin">Admin: can also manage staff</option>
          </select>
        </Field>
        <InlineError error={add.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!phone.trim() || add.isPending}>
            Add
          </button>
        </div>
      </form>
    </Dialog>
  );
}

