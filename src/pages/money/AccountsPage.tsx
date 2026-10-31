import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Landmark, Pencil, Plus, Smartphone, Wallet } from "lucide-react";
import { useGroup } from "../../api/hooks";
import {
  accountKindLabels,
  useAccounts,
  useDeleteAccount,
  useInstitutionBranches,
  useInstitutions,
  useSaveAccount,
  type Account,
  type AccountKind,
} from "../../api/money";
import { useGroupBase, useGroupId } from "../../components/AppShell";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Stat, Toggle } from "../../components/ui";
import { formatMoney } from "../../lib/format";
import { OfficialsOnly } from "./shared";

const kinds: AccountKind[] = ["bank", "sacco", "mobile_money", "petty_cash"];

const kindIcons = { bank: Landmark, sacco: Landmark, mobile_money: Smartphone, petty_cash: Wallet };

/** AccountsPage lists the group's accounts with their balances (officials). */
export function AccountsPage() {
  const groupId = useGroupId();
  const base = useGroupBase();
  const group = useGroup(groupId);
  const list = useAccounts(groupId);
  const [editing, setEditing] = useState<Account | "new" | null>(null);

  if (group.data && !group.data.is_official) return <OfficialsOnly />;
  if (list.isPending) return <Spinner label="Loading accounts" />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const currency = group.data?.currency ?? "KES";
  const { accounts, unassigned, total_balance } = list.data;
  const open = accounts.filter((a) => !a.is_closed);
  const closed = accounts.filter((a) => a.is_closed);

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Where the group's money is held."
        actions={
          <>
            <Link to={`${base}/cash-book`} className="btn-secondary">
              Cash book
            </Link>
            <button className="btn-primary" onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden /> Add account
            </button>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total balance" value={formatMoney(total_balance, currency)} />
        <Stat label="Open accounts" value={open.length} />
        <Stat label="Closed accounts" value={closed.length} />
      </div>

      {unassigned.length > 0 && (
        <div className="card mb-6 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">Some older transactions aren't linked to an account</p>
          <p className="mt-1">
            The old system's records didn't say which account they went to:{" "}
            {unassigned.map((u, i) => (
              <span key={u.kind}>
                {i > 0 && ", "}
                {formatMoney(u.balance, currency)} across {u.entries.toLocaleString()} {accountKindLabels[u.kind].toLowerCase()} transactions
              </span>
            ))}
            . They still count in the total balance.
          </p>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="card">
          <EmptyState title="No accounts yet">Add the group's bank, sacco, mobile money or petty cash account to start recording money.</EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...open, ...closed].map((a) => (
            <AccountCard key={a.id} account={a} currency={currency} base={base} onEdit={() => setEditing(a)} />
          ))}
        </div>
      )}
      {editing && <AccountDialog groupId={groupId} account={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function AccountCard({ account: a, currency, base, onEdit }: { account: Account; currency: string; base: string; onEdit: () => void }) {
  const Icon = kindIcons[a.kind];
  return (
    <div className={`card flex min-w-0 flex-col gap-4 p-5 ${a.is_closed ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{a.name}</p>
            <p className="truncate text-xs text-slate-500">
              {[a.institution?.name ?? accountKindLabels[a.kind], a.branch?.name, a.account_number].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <button className="btn-ghost -mr-2 -mt-1 p-2" onClick={onEdit} aria-label={`Edit ${a.name}`}>
          <Pencil className="size-4" />
        </button>
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(a.balance, currency)}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1.5">
          <Badge>{accountKindLabels[a.kind]}</Badge>
          {a.is_default && <Badge tone="brand">Default</Badge>}
          {a.is_closed && <Badge tone="warn">Closed</Badge>}
        </span>
        <Link to={`${base}/cash-book?account=${a.id}`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
          Statement
        </Link>
      </div>
    </div>
  );
}

function AccountDialog({ groupId, account, onClose }: { groupId: number; account?: Account; onClose: () => void }) {
  const save = useSaveAccount(groupId, account?.id);
  const del = useDeleteAccount(groupId);
  const [form, setForm] = useState({
    kind: (account?.kind ?? "bank") as AccountKind,
    name: account?.name ?? "",
    account_number: account?.account_number ?? "",
    institution_id: account?.institution?.id ? String(account.institution.id) : "",
    branch_id: account?.branch?.id ? String(account.branch.id) : "",
    initial_balance: account?.initial_balance ?? "",
    is_default: account?.is_default ?? false,
    is_closed: account?.is_closed ?? false,
  });
  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const institutions = useInstitutions(form.kind);
  const branches = useInstitutionBranches(form.kind, form.institution_id ? Number(form.institution_id) : null);
  const needsInstitution = form.kind !== "petty_cash";
  const hasBranch = form.kind === "bank" || form.kind === "sacco";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = account
      ? {
          name: form.name.trim(),
          account_number: form.account_number.trim(),
          ...(hasBranch && { branch_id: form.branch_id ? Number(form.branch_id) : null }),
          initial_balance: form.initial_balance || "0",
          is_default: form.is_default,
          is_closed: form.is_closed,
        }
      : {
          kind: form.kind,
          name: form.name.trim(),
          account_number: form.account_number.trim(),
          ...(needsInstitution && { institution_id: Number(form.institution_id) }),
          ...(hasBranch && form.branch_id && { branch_id: Number(form.branch_id) }),
          initial_balance: form.initial_balance || "0",
          is_default: form.is_default,
        };
    if (await save.mutateAsync(body).catch(() => null)) onClose();
  }

  async function remove() {
    if (account && (await del.mutateAsync(account.id).then(() => true).catch(() => false))) onClose();
  }

  const institutionLabel = { bank: "Bank", sacco: "Sacco", mobile_money: "Provider", petty_cash: "" }[form.kind];

  return (
    <Dialog open onClose={onClose} title={account ? `Edit ${account.name}` : "Add account"}>
      <form onSubmit={submit} className="space-y-4">
        <InlineError error={save.error ?? del.error} />
        {!account && (
          <Field label="Type" htmlFor="ac-kind">
            <select
              id="ac-kind"
              className="input"
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as AccountKind, institution_id: "", branch_id: "" }))}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {accountKindLabels[k]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Account name" htmlFor="ac-name">
          <input id="ac-name" className="input" value={form.name} onChange={(e) => set("name")(e.target.value)} required />
        </Field>
        {needsInstitution && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={institutionLabel} htmlFor="ac-inst">
              <select
                id="ac-inst"
                className="input"
                value={form.institution_id}
                disabled={!!account}
                onChange={(e) => setForm((f) => ({ ...f, institution_id: e.target.value, branch_id: "" }))}
                required
              >
                <option value="">{account ? account.institution?.name ?? "—" : institutions.isPending ? "Loading…" : "Choose…"}</option>
                {institutions.data?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
            {hasBranch && (
              <Field label="Branch" htmlFor="ac-branch">
                <select id="ac-branch" className="input" value={form.branch_id} disabled={!form.institution_id} onChange={(e) => set("branch_id")(e.target.value)}>
                  <option value="">None</option>
                  {branches.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {form.kind !== "petty_cash" && (
            <Field label={form.kind === "mobile_money" ? "Till or phone number" : "Account number"} htmlFor="ac-number">
              <input id="ac-number" className="input" value={form.account_number} onChange={(e) => set("account_number")(e.target.value)} />
            </Field>
          )}
          <Field label="Opening balance" htmlFor="ac-initial" hint="Money in the account before you started recording in Legion.">
            <input
              id="ac-initial"
              className="input"
              inputMode="decimal"
              pattern="\d+(\.\d{1,2})?"
              placeholder="0.00"
              value={form.initial_balance}
              onChange={(e) => set("initial_balance")(e.target.value)}
            />
          </Field>
        </div>
        <Toggle id="ac-default" label="Default account" hint={`Picked first when recording money into a ${accountKindLabels[form.kind].toLowerCase()} account.`} checked={form.is_default} onChange={set("is_default")} />
        {account && <Toggle id="ac-closed" label="Closed" hint="Closed accounts keep their history but can't receive new money." checked={form.is_closed} onChange={set("is_closed")} />}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <span>
            {account && (
              <button type="button" className="btn-ghost text-rose-700 dark:text-rose-400" onClick={remove} disabled={del.isPending}>
                Delete
              </button>
            )}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={save.isPending || !form.name.trim() || (needsInstitution && !form.institution_id)}>
              {save.isPending ? "Saving…" : account ? "Save" : "Add account"}
            </button>
          </span>
        </div>
      </form>
    </Dialog>
  );
}
