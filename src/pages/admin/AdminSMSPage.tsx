import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { smsPageSize, useSMS, type SMSMessage } from "../../api/account";
import { Badge, EmptyState, ErrorState, PageHeader, Spinner } from "../../components/ui";
import { formatDateTime, SearchBox, tbody, td, Th, theadRow, useDebounced } from "./widgets";

const statusTones: Record<SMSMessage["status"], "brand" | "neutral" | "warn" | "danger"> = {
  sent: "brand",
  queued: "neutral",
  sending: "warn",
  failed: "danger",
};

const kindLabels: Record<string, string> = {
  verify_phone: "Phone code",
  reset_password: "Password reset",
  password_changed: "Password changed",
  invite: "Invite",
  app_pin: "App PIN",
};

/** AdminSMSPage is the SMS outbox: every text the platform queued, and how Africa's Talking answered. */
export function AdminSMSPage() {
  const [status, setStatus] = useState("");
  const [phone, setPhone] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(phone.trim());
  // The API matches whole numbers only, so wait until one is typed.
  const sms = useSMS({ status, phone: debounced.replace(/\D/g, "").length >= 9 ? debounced : "", page });

  return (
    <>
      <PageHeader title="SMS" subtitle="Texts are retried for about seven hours before they're marked failed." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox
          label="Phone number"
          value={phone}
          onChange={(v) => {
            setPhone(v);
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
          <option value="queued">Queued</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      {sms.isPending ? (
        <Spinner label="Loading texts" />
      ) : sms.isError ? (
        <ErrorState error={sms.error} onRetry={() => sms.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {sms.data.length === 0 ? (
            <EmptyState title="No texts" />
          ) : (
            <>
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className={theadRow}>
                    <Th>Queued</Th>
                    <Th>To</Th>
                    <Th>Message</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className={tbody}>
                  {sms.data.map((m) => (
                    <tr key={m.id} className="align-top">
                      <td className={`${td} whitespace-nowrap`}>
                        {formatDateTime(m.created_at)}
                        <span className="block text-xs text-slate-500">{kindLabels[m.kind] ?? m.kind}</span>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        {m.to}
                        {m.group && <span className="block text-xs text-slate-500">{m.group.name}</span>}
                      </td>
                      <td className={`${td} max-w-md break-words text-slate-600 dark:text-slate-300`}>{m.body}</td>
                      <td className={td}>
                        <Badge tone={statusTones[m.status]}>{m.status}</Badge>
                        <span className="mt-1 block text-xs text-slate-500">
                          {m.attempts} {m.attempts === 1 ? "try" : "tries"}
                          {m.provider_status && ` · ${m.provider_status}`}
                          {m.cost && ` · ${m.cost}`}
                        </span>
                        {m.error && <span className="block text-xs text-red-600 dark:text-red-400">{m.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-end gap-1 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                <span className="mr-auto text-sm text-slate-500">Page {page}</span>
                <button className="btn-ghost p-2" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
                  <ChevronLeft className="size-4" />
                </button>
                <button className="btn-ghost p-2" disabled={sms.data.length < smsPageSize} onClick={() => setPage(page + 1)} aria-label="Next page">
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
