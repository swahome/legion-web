import { useState } from "react";
import { useAdminGroups } from "../../api/admin";
import {
  alertStatusLabels,
  paymentStatusLabels,
  useAdminAlert,
  useAdminAlerts,
  useAdminPayments,
  useAssignAlert,
  useWebhookEvents,
  type AlertStatus,
} from "../../api/payments";
import { useAccounts } from "../../api/money";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner } from "../../components/ui";
import { AlertFacts, AlertsTable, RecordsList } from "../payments/ReconciliationPage";
import { PaymentsTable } from "../payments/PayPage";
import { Pager, SearchBox, formatDateTime, tbody, td, theadRow, useDebounced } from "./widgets";

/** AdminAlertsPage: every bank and MPesa transaction, and the ones no group account matched. */
export function AdminAlertsPage() {
  const [unassigned, setUnassigned] = useState(true);
  const [status, setStatus] = useState<AlertStatus | "">("");
  const [page, setPage] = useState(1);
  const list = useAdminAlerts({ unassigned, status, page });
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <PageHeader
        title="Bank transactions"
        subtitle="What the bank feeds and MPesa reported. Transactions on an account number no group has (or more than one group has) wait here to be assigned."
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-brand-700"
            checked={unassigned}
            onChange={(e) => {
              setUnassigned(e.target.checked);
              setPage(1);
            }}
          />
          Only unassigned
        </label>
        <label className="text-sm">
          <span className="label">Status</span>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AlertStatus | "");
              setPage(1);
            }}
          >
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
        <Spinner label="Loading transactions" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title={unassigned ? "Every transaction has a group" : "No transactions yet"} />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <AlertsTable items={list.data.items} currency="KES" onOpen={setOpen} showGroup />
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
      {open != null && <AdminAlertDialog id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AdminAlertDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const alert = useAdminAlert(id);
  const assign = useAssignAlert(id);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const groups = useAdminGroups({ q, page: 1 });
  const [groupId, setGroupId] = useState(0);
  const [accountId, setAccountId] = useState("");
  const a = alert.data;
  return (
    <Dialog open onClose={onClose} title="Transaction">
      {alert.isPending ? (
        <Spinner />
      ) : alert.isError || !a ? (
        <ErrorState error={alert.error} />
      ) : (
        <div className="space-y-5">
          <AlertFacts a={a} currency="KES" />
          {a.group && (
            <p className="text-sm">
              Group: <span className="font-medium">{a.group.name}</span>
            </p>
          )}
          <RecordsList records={[...a.deposits, ...a.withdrawals]} currency={a.currency} />
          {!a.group && (
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-sm font-medium">Assign to a group account</p>
              <SearchBox value={search} onChange={setSearch} label="Search groups" />
              <Field label="Group" htmlFor="assign-group">
                <select
                  id="assign-group"
                  className="input"
                  value={groupId || ""}
                  onChange={(e) => {
                    setGroupId(Number(e.target.value));
                    setAccountId("");
                  }}
                >
                  <option value="">Choose a group</option>
                  {(groups.data?.items ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              {groupId > 0 && <AccountPicker groupId={groupId} value={accountId} onChange={setAccountId} />}
              <InlineError error={assign.error} />
              <div className="flex justify-end">
                <button className="btn-primary" disabled={!accountId || assign.isPending} onClick={() => assign.mutate(Number(accountId))}>
                  Assign
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function AccountPicker({ groupId, value, onChange }: { groupId: number; value: string; onChange: (v: string) => void }) {
  const accounts = useAccounts(groupId);
  return (
    <Field label="Account" htmlFor="assign-account">
      <select id="assign-account" className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose an account</option>
        {(accounts.data?.accounts ?? []).map((acc) => (
          <option key={acc.id} value={acc.id}>
            {acc.name} {acc.account_number && `(${acc.account_number})`}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** AdminPaymentsPage: every MPesa payment members started. */
export function AdminPaymentsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = useAdminPayments({ status: status || undefined, page });
  return (
    <>
      <PageHeader title="MPesa payments" subtitle="Payments members started, in every group." />
      <div className="mb-4">
        <label className="text-sm">
          <span className="label">Status</span>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {Object.entries(paymentStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <Spinner label="Loading payments" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No payments found" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <PaymentsTable items={list.data.items} currency="KES" showMember />
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
    </>
  );
}

const outcomeTone: Record<string, "brand" | "warn" | "danger" | "neutral"> = {
  accepted: "brand",
  reconciled: "brand",
  duplicate: "neutral",
  rejected: "danger",
  error: "danger",
};

/** AdminWebhooksPage: the latest calls from the banks and Chamasoft, for support. */
export function AdminWebhooksPage() {
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const list = useWebhookEvents({ source: source || undefined, page });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Webhook log" subtitle="Calls from Equity, Co-op Bank, Chamasoft and MPesa, newest first. Passwords are removed." />
      <div className="mb-4">
        <label className="text-sm">
          <span className="label">From</span>
          <select
            className="input"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Everyone</option>
            <option value="equity">Equity Bank</option>
            <option value="coop">Co-op Bank</option>
            <option value="chamasoft">Chamasoft payments</option>
            <option value="chamasoft_direct">Chamasoft paybill</option>
            <option value="mpesa">MPesa C2B</option>
          </select>
        </label>
      </div>
      {list.isPending ? (
        <Spinner label="Loading" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No calls yet" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className={tbody}>
              {list.data.items.map((e) => (
                <tr key={e.id}>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(e.created_at)}</td>
                  <td className={td}>{e.source}</td>
                  <td className={td}>{e.remote_ip}</td>
                  <td className={td}>
                    <Badge tone={outcomeTone[e.outcome] ?? "neutral"}>{e.outcome || "—"}</Badge>
                    {e.detail && <span className="block text-xs text-slate-500">{e.detail}</span>}
                  </td>
                  <td className={`${td} text-right`}>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setOpen(e.body)}>
                      Body
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={list.data} onPage={setPage} />
        </div>
      )}
      <Dialog open={open != null} onClose={() => setOpen(null)} title="Request body">
        <pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-3 text-xs break-all whitespace-pre-wrap dark:bg-slate-950">{pretty(open ?? "")}</pre>
      </Dialog>
    </>
  );
}

function pretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
