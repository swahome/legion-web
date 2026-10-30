import { useState, type FormEvent } from "react";
import { useCounties, useCountries, useSaveRef, type Country, type County } from "../../api/admin";
import { Badge, Dialog, EmptyState, ErrorState, Field, InlineError, PageHeader, Spinner, Toggle } from "../../components/ui";
import { optInt } from "./AdminBanksPage";
import { ActiveBadge, SearchBox, tbody, td, Th, theadRow } from "./widgets";

export function AdminPlacesPage() {
  const countries = useCountries();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Country | "new" | null>(null);
  const [countyCountry, setCountyCountry] = useState<number | null>(null);

  if (countries.isPending) return <Spinner label="Loading countries" />;
  if (countries.isError) return <ErrorState error={countries.error} onRetry={() => countries.refetch()} />;
  const def = countries.data.find((c) => c.is_default);
  const selected = countyCountry ?? def?.id ?? countries.data[0]?.id;
  const term = q.trim().toLowerCase();
  const shown = countries.data.filter((c) => !term || c.name.toLowerCase().includes(term) || c.code.toLowerCase() === term);

  return (
    <>
      <PageHeader title="Countries and counties" subtitle="The default country sets the currency and phone code for new groups." />
      <div className="grid gap-8 xl:grid-cols-[3fr_2fr]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SearchBox label="Search countries" value={q} onChange={setQ} />
            <button className="btn-primary" onClick={() => setEditing("new")}>
              Add country
            </button>
          </div>
          <div className="card max-h-[36rem] overflow-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-900">
                <tr className={theadRow}>
                  <Th>Country</Th>
                  <Th>Currency</Th>
                  <Th>Phone code</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className={tbody}>
                {shown.map((c) => (
                  <tr key={c.id} className={c.id === selected ? "bg-brand-50/60 dark:bg-brand-900/20" : ""}>
                    <td className={td}>
                      <button className="text-left font-medium hover:underline" onClick={() => setCountyCountry(c.id)}>
                        {c.name}
                      </button>
                      <span className="ml-2 text-xs text-slate-500">{c.code}</span>
                      {c.is_default && (
                        <span className="ml-2">
                          <Badge tone="brand">Default</Badge>
                        </span>
                      )}
                      {!c.is_active && (
                        <span className="ml-2">
                          <Badge>Inactive</Badge>
                        </span>
                      )}
                    </td>
                    <td className={td}>{c.currency_code}</td>
                    <td className={`${td} tabular-nums`}>+{c.calling_code}</td>
                    <td className={`${td} text-right`}>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(c)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {selected && <Counties country={countries.data.find((c) => c.id === selected)!} />}
      </div>
      {editing && <CountryDialog country={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Counties({ country }: { country: Country }) {
  const counties = useCounties(country.id);
  const [editing, setEditing] = useState<County | "new" | null>(null);
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Counties in {country.name}</h2>
        <button className="btn-secondary" onClick={() => setEditing("new")}>
          Add county
        </button>
      </div>
      <div className="card max-h-[36rem] overflow-auto">
        {counties.isPending ? (
          <Spinner label="Loading counties" />
        ) : counties.isError ? (
          <ErrorState error={counties.error} />
        ) : counties.data.length === 0 ? (
          <EmptyState title="No counties" />
        ) : (
          <table className="w-full text-sm">
            <tbody className={tbody}>
              {counties.data.map((c) => (
                <tr key={c.id}>
                  <td className={`${td} w-12 text-slate-500 tabular-nums`}>{c.code ?? ""}</td>
                  <td className={td}>
                    <span className="font-medium">{c.name}</span>
                    {c.capital && <span className="block text-xs text-slate-500">{c.capital}</span>}
                  </td>
                  <td className={td}>{!c.is_active && <ActiveBadge active={false} />}</td>
                  <td className={`${td} text-right`}>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(c)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <CountyDialog countryId={country.id} county={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function CountryDialog({ country, onClose }: { country?: Country; onClose: () => void }) {
  const save = useSaveRef<Country>("countries");
  const [f, setF] = useState({
    name: country?.name ?? "",
    code: country?.code ?? "",
    currency_code: country?.currency_code ?? "",
    currency_name: country?.currency_name ?? "",
    calling_code: country?.calling_code ?? "",
    is_active: country?.is_active ?? true,
    is_default: country?.is_default ?? false,
  });
  const set = (k: "name" | "code" | "currency_code" | "currency_name" | "calling_code") => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ id: country?.id, ...f }, { onSuccess: onClose });
  }
  return (
    <Dialog open onClose={onClose} title={country ? `Edit ${country.name}` : "Add country"}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label="Name" htmlFor="ct-name">
            <input id="ct-name" className="input" required value={f.name} onChange={set("name")} />
          </Field>
          <Field label="ISO code" htmlFor="ct-code">
            <input id="ct-code" className="input uppercase" required maxLength={2} value={f.code} onChange={set("code")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[7rem_1fr_7rem]">
          <Field label="Currency" htmlFor="ct-cur">
            <input id="ct-cur" className="input uppercase" required maxLength={3} value={f.currency_code} onChange={set("currency_code")} />
          </Field>
          <Field label="Currency name" htmlFor="ct-curname">
            <input id="ct-curname" className="input" value={f.currency_name} onChange={set("currency_name")} />
          </Field>
          <Field label="Phone code" htmlFor="ct-call">
            <input id="ct-call" className="input" required inputMode="numeric" value={f.calling_code} onChange={set("calling_code")} />
          </Field>
        </div>
        <Toggle id="ct-active" label="Active" checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
        <Toggle
          id="ct-default"
          label="Default country"
          hint="Only one country can be the default."
          checked={f.is_default}
          onChange={(v) => setF({ ...f, is_default: v })}
        />
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

function CountyDialog({ countryId, county, onClose }: { countryId: number; county?: County; onClose: () => void }) {
  const save = useSaveRef<County>("counties");
  const [f, setF] = useState({
    name: county?.name ?? "",
    code: county?.code?.toString() ?? "",
    capital: county?.capital ?? "",
    is_active: county?.is_active ?? true,
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      { id: county?.id, country_id: countryId, name: f.name.trim(), code: optInt(f.code), capital: f.capital.trim(), is_active: f.is_active },
      { onSuccess: onClose },
    );
  }
  return (
    <Dialog open onClose={onClose} title={county ? `Edit ${county.name}` : "Add county"}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label="Name" htmlFor="co-name">
            <input id="co-name" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Code" htmlFor="co-code">
            <input id="co-code" className="input" inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          </Field>
        </div>
        <Field label="Capital" htmlFor="co-capital">
          <input id="co-capital" className="input" value={f.capital} onChange={(e) => setF({ ...f, capital: e.target.value })} />
        </Field>
        <Toggle id="co-active" label="Active" checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
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
