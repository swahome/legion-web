import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useBanks, useBranches, useSaveRef, type Bank, type Branch } from "../../api/admin";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../../components/ui";
import { ActiveBadge, SearchBox, tbody, td, Th, theadRow, useDebounced } from "./widgets";

/** optInt turns a form field into a number, or null when blank. */
export function optInt(v: string): number | null {
  const n = Number(v.trim());
  return v.trim() === "" || !Number.isInteger(n) ? null : n;
}

export function AdminBanksPage() {
  const [q, setQ] = useState("");
  const banks = useBanks(useDebounced(q));
  const [editing, setEditing] = useState<Bank | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Banks"
        subtitle="Banks and branches groups can pick for their accounts. Partner banks are featured first."
        actions={
          <button className="btn-primary" onClick={() => setEditing("new")}>
            Add bank
          </button>
        }
      />
      <div className="mb-4">
        <SearchBox label="Search banks" value={q} onChange={setQ} />
      </div>
      {banks.isPending ? (
        <Spinner label="Loading banks" />
      ) : banks.isError ? (
        <ErrorState error={banks.error} onRetry={() => banks.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {banks.data.length === 0 ? (
            <EmptyState title="No banks match" />
          ) : (
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className={theadRow}>
                  <Th>Bank</Th>
                  <Th>Code</Th>
                  <Th right>Branches</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className={tbody}>
                {banks.data.map((b) => (
                  <tr key={b.id}>
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        {b.branding.primary && <span className="size-3 rounded-full" style={{ background: b.branding.primary }} aria-hidden />}
                        <Link to={`/admin/banks/${b.id}`} className="font-medium hover:underline">
                          {b.name}
                        </Link>
                        {b.is_partner && <Badge tone="brand">Partner</Badge>}
                        {b.is_default && <Badge>Default</Badge>}
                      </span>
                    </td>
                    <td className={`${td} tabular-nums`}>{b.code ?? "—"}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.branch_count ?? 0}</td>
                    <td className={td}>
                      <ActiveBadge active={b.is_active} />
                    </td>
                    <td className={`${td} text-right`}>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(b)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {editing && <BankDialog bank={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BankDialog({ bank, onClose }: { bank?: Bank; onClose: () => void }) {
  const save = useSaveRef<Bank>("banks");
  const [f, setF] = useState({
    name: bank?.name ?? "",
    code: bank?.code?.toString() ?? "",
    short_code: bank?.short_code ?? "",
    is_partner: bank?.is_partner ?? false,
    is_active: bank?.is_active ?? true,
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ id: bank?.id, ...f, name: f.name.trim(), code: optInt(f.code), short_code: f.short_code.trim() }, { onSuccess: onClose });
  }
  return (
    <Dialog open onClose={onClose} title={bank ? `Edit ${bank.name}` : "Add bank"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="bk-name">
          <input id="bk-name" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank code" htmlFor="bk-code">
            <input id="bk-code" className="input" inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          </Field>
          <Field label="Short code" htmlFor="bk-short">
            <input id="bk-short" className="input" value={f.short_code} onChange={(e) => setF({ ...f, short_code: e.target.value })} />
          </Field>
        </div>
        <Toggle id="bk-partner" label="Partner bank" checked={f.is_partner} onChange={(v) => setF({ ...f, is_partner: v })} />
        <Toggle id="bk-active" label="Active" hint="Inactive banks are hidden from groups." checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
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

export function AdminBankPage() {
  const bankId = Number(useParams().bankId);
  const banks = useBanks();
  const branches = useBranches(bankId);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const bank = banks.data?.find((b) => b.id === bankId);
  const shown = branches.data?.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())) ?? [];

  return (
    <>
      <Link to="/admin/banks" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="size-4" aria-hidden /> Banks
      </Link>
      <PageHeader
        title={bank?.name ?? "Bank"}
        subtitle="Branches"
        actions={
          <button className="btn-primary" onClick={() => setEditing("new")}>
            Add branch
          </button>
        }
      />
      <div className="mb-4">
        <SearchBox label="Search branches" value={q} onChange={setQ} />
      </div>
      {branches.isPending ? (
        <Spinner label="Loading branches" />
      ) : branches.isError ? (
        <ErrorState error={branches.error} onRetry={() => branches.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          {shown.length === 0 ? (
            <EmptyState title="No branches" />
          ) : (
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className={theadRow}>
                  <Th>Branch</Th>
                  <Th>Code</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className={tbody}>
                {shown.map((b) => (
                  <tr key={b.id}>
                    <td className={`${td} font-medium`}>{b.name}</td>
                    <td className={`${td} tabular-nums`}>{b.code ?? "—"}</td>
                    <td className={td}>
                      <ActiveBadge active={b.is_active} />
                    </td>
                    <td className={`${td} text-right`}>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(b)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {editing && <BranchDialog bankId={bankId} branch={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BranchDialog({ bankId, branch, onClose }: { bankId: number; branch?: Branch; onClose: () => void }) {
  const save = useSaveRef<Branch>(`banks/${bankId}/branches`);
  const [f, setF] = useState({ name: branch?.name ?? "", code: branch?.code?.toString() ?? "", is_active: branch?.is_active ?? true });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ id: branch?.id, name: f.name.trim(), code: optInt(f.code), is_active: f.is_active }, { onSuccess: onClose });
  }
  return (
    <Dialog open onClose={onClose} title={branch ? `Edit ${branch.name}` : "Add branch"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="br-name">
          <input id="br-name" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Branch code" htmlFor="br-code">
          <input id="br-code" className="input" inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        </Field>
        <Toggle id="br-active" label="Active" checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
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
