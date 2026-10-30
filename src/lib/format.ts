import type { Member } from "../api/types";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** formatMoney renders an API money string, e.g. "4200.5" → "KES 4,200.50". */
export function formatMoney(value: string | null | undefined, currency = "KES"): string {
  if (value == null || value === "") return "—";
  let f = moneyFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(currency, f);
  }
  // Two-decimal strings are exact in a double for any realistic amount.
  return f.format(Number(value)).replace(/ /g, " ");
}

export function isNegative(value: string | null | undefined): boolean {
  return !!value && value.trim().startsWith("-");
}

export function isZero(value: string | null | undefined): boolean {
  return !value || Number(value) === 0;
}

const dateFormat = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** formatDate renders a "YYYY-MM-DD" date as "5 Jan 2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? value + "T00:00:00Z" : value);
  return Number.isNaN(d.getTime()) ? value : dateFormat.format(d);
}

export function fullName(m: Pick<Member, "first_name" | "middle_name" | "last_name">): string {
  return [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ").trim() || "Unnamed member";
}

export function initials(m: Pick<Member, "first_name" | "last_name">): string {
  return ((m.first_name?.[0] ?? "") + (m.last_name?.[0] ?? "")).toUpperCase() || "?";
}

export const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Every two weeks",
  monthly: "Monthly",
  twice_monthly: "Twice a month",
  bimonthly: "Every two months",
  quarterly: "Quarterly",
  biannually: "Twice a year",
  annually: "Yearly",
};

export const kindLabels: Record<string, string> = {
  regular: "Regular",
  one_time: "One-time",
  non_scheduled: "Non-scheduled",
};

export const categoryLabels: Record<string, string> = {
  share_capital: "Share capital",
  savings: "Savings",
  welfare: "Welfare",
  membership_fee: "Membership fee",
  investment: "Investment",
  other: "Other",
};
