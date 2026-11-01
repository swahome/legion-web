import { useState, type FormEvent, type ReactNode } from "react";
import { useActiveCountries, useGroupTypes, type GroupDetails, type GroupDetailsInput } from "../../api/account";
import { ApiError } from "../../api/client";
import { Field, InlineError } from "../../components/ui";

export function groupError(err: unknown): string | null {
  if (!err) return null;
  if (!(err instanceof ApiError)) return "Could not reach the server. Check your connection and try again.";
  switch (err.code) {
    case "phone_not_verified":
      return "Confirm your phone number before creating a group.";
    case "currency_locked":
      return "The country and currency can't change once the group is live.";
    default:
      return err.message;
  }
}

/**
 * GroupDetailsForm is the group's name, kind, size, country and contacts,
 * for a new group and the setup wizard's first step. Country and currency
 * are only offered while the group isn't live.
 */
export function GroupDetailsForm({
  initial,
  locked = false,
  busy,
  error,
  onSubmit,
  submitLabel,
  extra,
}: {
  initial?: GroupDetails;
  locked?: boolean;
  busy: boolean;
  error: unknown;
  onSubmit: (input: GroupDetailsInput) => void;
  submitLabel: string;
  extra?: ReactNode;
}) {
  const types = useGroupTypes();
  const countries = useActiveCountries();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? "",
    size: initial?.size ? String(initial.size) : "",
    country_code: initial?.country_code ?? "",
    currency: initial?.currency ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const country = countries.data?.find((c) => c.code === form.country_code);

  function submit(e: FormEvent) {
    e.preventDefault();
    const input: GroupDetailsInput = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() };
    if (form.type) input.type = form.type;
    if (form.size) input.size = Number(form.size);
    if (initial) input.address = form.address.trim();
    if (!locked && form.country_code) {
      input.country_code = form.country_code;
      input.currency = form.currency.trim().toUpperCase() || country?.currency_code;
    }
    onSubmit(input);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!!error && <InlineError error={new Error(groupError(error) ?? "")} />}
      <Field label="Group name" htmlFor="gd-name">
        <input id="gd-name" className="input" value={form.name} onChange={set("name")} required autoFocus={!initial} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind of group" htmlFor="gd-type">
          <select id="gd-type" className="input" value={form.type} onChange={set("type")}>
            <option value="">Choose…</option>
            {types.data?.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Number of members" htmlFor="gd-size">
          <input id="gd-size" className="input" inputMode="numeric" value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value.replace(/\D/g, "") }))} />
        </Field>
      </div>
      {!locked && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" htmlFor="gd-country">
            <select
              id="gd-country"
              className="input"
              value={form.country_code}
              onChange={(e) => {
                const c = countries.data?.find((x) => x.code === e.target.value);
                setForm((f) => ({ ...f, country_code: e.target.value, currency: c?.currency_code ?? f.currency }));
              }}
            >
              <option value="">{initial ? "Choose…" : "Default country"}</option>
              {countries.data?.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Currency" htmlFor="gd-currency" hint="The group keeps its books in this currency.">
            <input id="gd-currency" className="input uppercase" maxLength={3} value={form.currency} onChange={set("currency")} placeholder={country?.currency_code ?? "KES"} />
          </Field>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Group phone (optional)" htmlFor="gd-phone">
          <input id="gd-phone" className="input" type="tel" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Group email (optional)" htmlFor="gd-email">
          <input id="gd-email" className="input" type="email" value={form.email} onChange={set("email")} />
        </Field>
      </div>
      {initial && (
        <Field label="Address (optional)" htmlFor="gd-address">
          <input id="gd-address" className="input" value={form.address} onChange={set("address")} />
        </Field>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {extra}
        <button type="submit" className="btn-primary" disabled={busy || !form.name.trim()}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
