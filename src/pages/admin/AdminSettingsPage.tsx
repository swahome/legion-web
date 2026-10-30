import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useSaveSettings, useSettings, type Settings } from "../../api/admin";
import { groupMenus } from "../../components/menus";
import { ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../../components/ui";
import { tbody, td } from "./widgets";

const menusKey = "menus.disabled";

export function AdminSettingsPage() {
  const settings = useSettings();
  const save = useSaveSettings();
  if (settings.isPending) return <Spinner label="Loading settings" />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  const s = settings.data;
  const disabled = Array.isArray(s[menusKey]) ? (s[menusKey] as string[]) : [];

  function setMenu(id: string, on: boolean) {
    const next = on ? disabled.filter((x) => x !== id) : [...disabled, id];
    save.mutate({ [menusKey]: next.length ? next : null });
  }

  return (
    <>
      <PageHeader title="Settings and menus" subtitle="Changes apply to everyone at once and are recorded in the audit log." />
      <InlineError error={save.error} />

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Menus</h2>
        <p className="mt-1 text-sm text-slate-500">Switch a menu item off to hide it for every group. The overview can't be switched off.</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {(["group", "member"] as const).map((section) => (
            <div key={section}>
              <h3 className="mb-3 text-sm font-semibold text-slate-500 uppercase">{section === "group" ? "Officials' panel" : "Members' panel"}</h3>
              <div className="space-y-3">
                {groupMenus
                  .filter((m) => m.section === section && !m.locked)
                  .map((m) => (
                    <Toggle key={m.id} id={`menu-${m.id}`} label={m.label} checked={!disabled.includes(m.id)} onChange={(on) => setMenu(m.id, on)} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card mt-6 overflow-x-auto">
        <div className="p-5 pb-3">
          <h2 className="font-semibold">Platform settings</h2>
          <p className="mt-1 text-sm text-slate-500">Imported from the old system's settings. Numbers stay numbers; everything else is text.</p>
        </div>
        <table className="w-full min-w-[36rem] text-sm">
          <tbody className={tbody}>
            {Object.keys(s)
              .filter((k) => k !== menusKey)
              .sort()
              .map((k) => (
                <SettingRow key={k} name={k} value={s[k]} onSave={(v) => save.mutate({ [k]: v })} disabled={save.isPending} />
              ))}
          </tbody>
        </table>
        <AddSetting existing={s} onAdd={(k, v) => save.mutate({ [k]: v })} pending={save.isPending} />
      </section>
    </>
  );
}

/**
 * parseValue types a new value: numbers (without leading zeros, so phone
 * numbers stay text) and booleans. Edits keep the old value's type.
 */
function parseValue(raw: string, like?: unknown): unknown {
  if (typeof like === "string") return raw;
  const t = raw.trim();
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(t)) return Number(t);
  if (t === "true" || t === "false") return t === "true";
  return raw;
}

function show(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

function SettingRow({ name, value, onSave, disabled }: { name: string; value: unknown; onSave: (v: unknown) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(show(value));
  const changed = draft !== show(value);
  const complex = value !== null && typeof value === "object";
  return (
    <tr>
      <td className={`${td} w-1/3 font-mono text-xs`}>
        <label htmlFor={`set-${name}`}>{name}</label>
      </td>
      <td className={td}>
        <input id={`set-${name}`} className="input font-mono text-xs" value={draft} readOnly={complex} onChange={(e) => setDraft(e.target.value)} />
      </td>
      <td className={`${td} w-32 text-right whitespace-nowrap`}>
        {changed && (
          <button className="btn-primary px-3 py-1.5 text-xs" disabled={disabled} onClick={() => onSave(parseValue(draft, value))}>
            Save
          </button>
        )}
        <button className="btn-ghost p-2" aria-label={`Remove ${name}`} title="Remove" disabled={disabled} onClick={() => onSave(null)}>
          <Trash2 className="size-4" />
        </button>
      </td>
    </tr>
  );
}

function AddSetting({ existing, onAdd, pending }: { existing: Settings; onAdd: (k: string, v: unknown) => void; pending: boolean }) {
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const key = k.trim().toLowerCase();
  const valid = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(key) && !(key in existing);
  function submit(e: FormEvent) {
    e.preventDefault();
    onAdd(key, parseValue(v));
    setK("");
    setV("");
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
      <div className="min-w-48 flex-1">
        <Field label="New setting" htmlFor="new-key" hint="Lowercase letters, digits, _ and dots.">
          <input id="new-key" className="input font-mono text-xs" value={k} onChange={(e) => setK(e.target.value)} />
        </Field>
      </div>
      <div className="min-w-48 flex-1 pb-5">
        <label className="sr-only" htmlFor="new-value">
          Value
        </label>
        <input id="new-value" className="input font-mono text-xs" placeholder="Value" value={v} onChange={(e) => setV(e.target.value)} />
      </div>
      <button className="btn-secondary mb-5" disabled={!valid || pending}>
        Add
      </button>
    </form>
  );
}
