import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Paged } from "./admin";
import { api } from "./client";
import type { NamedRef } from "./money";
import type { Money } from "./types";

// Fines and the billing job (milestone 3, part 3). See legion-api
// docs/api/groups.md ("fines") and docs/api/admin.md ("Background jobs").

const g = (groupId: number) => `/v1/groups/${groupId}`;

function query(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type FineKind = "fine" | "contribution_fine";

export const fineKindLabels: Record<FineKind, string> = {
  fine: "Fine",
  contribution_fine: "Late payment fine",
};

export interface Fine {
  id: number;
  kind: FineKind;
  member: NamedRef | null;
  amount: Money;
  date: string;
  description: string;
  fine_category: NamedRef | null;
  contribution: NamedRef | null;
  invoice_due_date: string | null;
  automatic: boolean;
  created_at: string;
  voided_at: string | null;
}

export interface FineParams {
  member_id?: number;
  kind?: FineKind;
  include_voided?: boolean;
  page?: number;
}

export interface FineBalance {
  member: NamedRef;
  fined: Money;
  paid: Money;
  balance: Money;
}

export interface FineBalances {
  members: FineBalance[];
  total_owed: Money;
}

export interface FineMembersInput {
  member_ids: number[];
  fine_category_id: number;
  amount: string;
  date: string;
  description?: string;
}

export function useFines(groupId: number, params: FineParams) {
  return useQuery({
    queryKey: ["group", groupId, "fines", params],
    queryFn: () => api.get<Paged<Fine>>(`${g(groupId)}/fines${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useFineBalances(groupId: number) {
  return useQuery({
    queryKey: ["group", groupId, "fine-balances"],
    queryFn: () => api.get<FineBalances>(`${g(groupId)}/fine-balances`),
  });
}

export function useFineMembers(groupId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FineMembersInput) => api.post<{ fine_ids: number[] }>(`${g(groupId)}/fines`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group", groupId] }),
  });
}

export function useVoidFine(groupId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<unknown>(`${g(groupId)}/fines/${id}/void`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group", groupId] }),
  });
}

// ---- fine rule settings (legacy option codes) ----

export const chargeableOptions: [string, string][] = [
  ["1", "1 day after the contribution date"],
  ["7", "1 week after the contribution date"],
  ["14", "2 weeks after the contribution date"],
  ["last_day_of_the_month", "On the last day of the month"],
  ["first_day_of_the_month", "On the first day of the next month"],
  ...Array.from({ length: 56 }, (_, i) => i + 1)
    .filter((n) => ![1, 7, 14].includes(n))
    .map((n): [string, string] => [String(n), `${n} days after the contribution date`]),
];

export const fineFrequencyLabels: Record<string, string> = {
  "0": "Once",
  "1": "Every day",
  "2": "Every week",
  "3": "Every month",
  "4": "Every quarter",
  "5": "Every half year",
  "6": "Every year",
};

export const fineModeLabels: Record<string, string> = {
  "1": "For each unpaid invoice",
  "2": "On the outstanding balance",
};

export const percentageOfLabels: Record<string, string> = {
  "1": "of the contribution amount",
  "2": "of the unpaid balance",
  "3": "of the unpaid balance and fines",
};

export function describeChargeable(v: string): string {
  if (v === "last_day_of_the_month") return "charged on the last day of the month";
  if (v === "first_day_of_the_month") return "charged on the first day of the next month";
  const n = Number(v);
  if (n > 0) return `charged ${n} day${n === 1 ? "" : "s"} after the contribution date`;
  return v ? `charged: ${v}` : "";
}

// ---- admin: background jobs ----

export interface JobSummary {
  date?: string;
  schedules_invoiced?: number;
  invoices_raised?: number;
  schedules_skipped?: number;
  fine_rules_run?: number;
  fines_raised?: number;
  fine_rules_skipped?: number;
  problems?: string[];
}

export interface JobRun {
  id: number;
  job: string;
  run_date: string;
  trigger: "schedule" | "manual" | "cli";
  status: "running" | "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  summary: JobSummary;
  error: string;
  started_by: NamedRef | null;
}

export function useJobRuns(page: number) {
  return useQuery({
    queryKey: ["admin", "jobs", page],
    queryFn: () => api.get<Paged<JobRun>>(`/v1/admin/jobs${query({ job: "billing", page })}`),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === "running") ? 3000 : false),
  });
}

export function useRunBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) => api.post<{ status: string; date: string }>("/v1/admin/jobs/billing/run", date ? { date } : {}),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["admin", "jobs"] }), 500),
  });
}
