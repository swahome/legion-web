import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { query, type Paged } from "./admin";
import { api } from "./client";
import type { NamedRef } from "./money";
import type { Money } from "./types";

// MPesa payments, bank transaction alerts, reconciliation and the bank
// panel (milestone 6). See legion-api docs/api/payments.md.

const g = (groupId: number) => `/v1/groups/${groupId}`;

export type AlertStatus = "unreconciled" | "reconciled" | "ignored";
export type AlertSource = "chamasoft" | "chamasoft_direct" | "equity" | "coop" | "mpesa" | "legacy";

export const sourceLabels: Record<string, string> = {
  chamasoft: "MPesa payment",
  chamasoft_direct: "Paybill",
  equity: "Equity Bank",
  coop: "Co-op Bank",
  mpesa: "MPesa",
  legacy: "Imported",
};

export const alertStatusLabels: Record<AlertStatus, string> = {
  unreconciled: "To reconcile",
  reconciled: "Reconciled",
  ignored: "Ignored",
};

export interface Alert {
  id: number;
  source: AlertSource;
  provider_ref: string;
  bank: NamedRef | null;
  account_number: string;
  group: NamedRef | null;
  account: NamedRef | null;
  direction: "in" | "out";
  amount: Money;
  currency: string;
  transaction_at: string;
  reference: string;
  particulars: string;
  phone: string | null;
  payer_name: string;
  status: AlertStatus;
  auto_reconciled: boolean;
  reconciled_at: string | null;
  note: string;
  created_at: string;
}

export interface AlertRecord {
  id: number;
  kind: string;
  amount: Money;
  date: string;
  description: string;
  member_id: number | null;
  member_name: string;
  item_name: string;
  loan_id?: number;
  from_alert: boolean;
  voided_at: string | null;
}

export type LineKind = "contribution" | "fine" | "misc" | "income" | "loan" | "expense" | "contribution_refund";

export const lineKindLabels: Record<LineKind, string> = {
  contribution: "Contribution",
  fine: "Fine",
  misc: "Miscellaneous",
  income: "Income",
  loan: "Loan repayment",
  expense: "Expense",
  contribution_refund: "Contribution refund",
};

export const moneyInKinds: LineKind[] = ["contribution", "fine", "loan", "misc", "income"];
export const moneyOutKinds: LineKind[] = ["expense", "contribution_refund"];

export interface Line {
  kind: LineKind;
  amount: Money;
  member_id?: number;
  contribution_id?: number;
  fine_category_id?: number;
  income_category_id?: number;
  depositor_id?: number;
  loan_id?: number;
  expense_category_id?: number;
  description?: string;
  name?: string;
}

export interface AlertDetail extends Alert {
  reconciled_by: string;
  deposits: AlertRecord[];
  withdrawals: AlertRecord[];
  suggestion: { member_id: number; lines: Line[] } | null;
}

export interface AlertSummary {
  in: { count: number; amount: Money };
  out: { count: number; amount: Money };
}

export interface AlertParams {
  status?: AlertStatus | "";
  direction?: "in" | "out" | "";
  source?: string;
  account_id?: number;
  from?: string;
  to?: string;
  page?: number;
}

export function useAlerts(groupId: number, params: AlertParams) {
  return useQuery({
    queryKey: ["group", groupId, "alerts", params],
    queryFn: () => api.get<Paged<Alert>>(`${g(groupId)}/transaction-alerts${query({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

export function useAlertSummary(groupId: number) {
  return useQuery({
    queryKey: ["group", groupId, "alerts", "summary"],
    queryFn: () => api.get<AlertSummary>(`${g(groupId)}/transaction-alerts/summary`),
  });
}

export function useAlert(groupId: number, id: number | null) {
  return useQuery({
    queryKey: ["group", groupId, "alert", id],
    queryFn: () => api.get<AlertDetail>(`${g(groupId)}/transaction-alerts/${id}`),
    enabled: id != null,
  });
}

/** useAlertAction runs reconcile, match, dismiss or undo on an alert. */
export function useAlertAction(groupId: number, id: number, action: "reconcile" | "match" | "dismiss" | "undo") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => api.post<AlertDetail>(`${g(groupId)}/transaction-alerts/${id}/${action}`, body),
    onSuccess: (d) => {
      qc.setQueryData(["group", groupId, "alert", id], d);
      // Reconciling writes deposits and withdrawals, which move every balance.
      void qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}

export interface ReconcileSettings {
  auto_reconcile_payments: boolean;
  auto_reconcile_bank_alerts: boolean;
}

export function useReconcileSettings(groupId: number) {
  return useQuery({
    queryKey: ["group", groupId, "reconcile-settings"],
    queryFn: () => api.get<ReconcileSettings>(`${g(groupId)}/reconciliation-settings`),
  });
}

export function useUpdateReconcileSettings(groupId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ReconcileSettings>) => api.patch<ReconcileSettings>(`${g(groupId)}/reconciliation-settings`, body),
    onSuccess: (d) => qc.setQueryData(["group", groupId, "reconcile-settings"], d),
  });
}

// ---- Member payments ----

export type PaymentStatus = "pending" | "sent" | "failed" | "paid";

export interface Payment {
  id: number;
  group: NamedRef;
  member_id: number | null;
  member_name: string;
  phone: string;
  amount: Money;
  reference: string;
  lines: Line[];
  channel: string;
  status: PaymentStatus;
  message: string;
  receipt: string | null;
  transaction_alert_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface OwedItem {
  kind: "contribution" | "fine" | "loan";
  contribution_id?: number;
  fine_category_id?: number;
  loan_id?: number;
  name: string;
  owed: Money;
  since?: string;
}

export interface PayOptions {
  enabled: boolean;
  account: { id: number; account_number: string } | null;
  phone: string;
  owed: OwedItem[];
  contributions: NamedRef[];
  currency: string;
}

export function usePayOptions(groupId: number) {
  return useQuery({
    queryKey: ["group", groupId, "pay-options"],
    queryFn: () => api.get<PayOptions>(`${g(groupId)}/pay/options`),
  });
}

export function usePayments(groupId: number, params: { status?: string; mine?: boolean; page?: number }) {
  return useQuery({
    queryKey: ["group", groupId, "payments", params],
    queryFn: () => api.get<Paged<Payment>>(`${g(groupId)}/payments${query({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

/** usePayment polls a payment while the member is entering their PIN. */
export function usePayment(groupId: number, id: number | null) {
  return useQuery({
    queryKey: ["group", groupId, "payment", id],
    queryFn: () => api.get<Payment>(`${g(groupId)}/payments/${id}`),
    enabled: id != null,
    refetchInterval: (q) => (q.state.data && (q.state.data.status === "paid" || q.state.data.status === "failed") ? false : 3000),
  });
}

export interface PaymentInput {
  phone?: string;
  lines?: Line[];
  amount?: Money;
}

export function useStartPayment(groupId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentInput) => api.post<Payment>(`${g(groupId)}/payments`, body),
    onSuccess: (p) => {
      qc.setQueryData(["group", groupId, "payment", p.id], p);
      void qc.invalidateQueries({ queryKey: ["group", groupId, "payments"] });
    },
  });
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Starting",
  sent: "Waiting for PIN",
  failed: "Failed",
  paid: "Paid",
};

// ---- Platform admin ----

export interface WebhookEvent {
  id: number;
  source: string;
  remote_ip: string;
  body: string;
  outcome: string;
  detail: string;
  alert_id: number | null;
  created_at: string;
}

export function useAdminAlerts(params: AlertParams & { unassigned?: boolean; group_id?: number; bank_id?: number }) {
  return useQuery({
    queryKey: ["admin", "alerts", params],
    queryFn: () => api.get<Paged<Alert>>(`/v1/admin/transaction-alerts${query({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminAlert(id: number | null) {
  return useQuery({
    queryKey: ["admin", "alert", id],
    queryFn: () => api.get<AlertDetail>(`/v1/admin/transaction-alerts/${id}`),
    enabled: id != null,
  });
}

export function useAssignAlert(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: number) => api.post<AlertDetail>(`/v1/admin/transaction-alerts/${id}/assign`, { account_id: accountId }),
    onSuccess: (d) => {
      qc.setQueryData(["admin", "alert", id], d);
      void qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
    },
  });
}

export function useAdminPayments(params: { group_id?: number; status?: string; page?: number }) {
  return useQuery({
    queryKey: ["admin", "payments", params],
    queryFn: () => api.get<Paged<Payment>>(`/v1/admin/payments${query({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

export function useWebhookEvents(params: { source?: string; outcome?: string; page?: number }) {
  return useQuery({
    queryKey: ["admin", "webhooks", params],
    queryFn: () => api.get<Paged<WebhookEvent>>(`/v1/admin/webhooks${query({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

// ---- Bank panel ----

export interface BankPanel {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  role: "admin" | "staff";
}

export interface BranchKPI {
  branch_id: number | null;
  branch: string;
  accounts: number;
  groups: number;
  new_groups: number;
  money_in: Money;
  money_out: Money;
  alerts: number;
}

export interface BankDashboard {
  from: string;
  to: string;
  totals: { accounts: number; groups: number; new_groups: number; alerts: number; money_in: Money; money_out: Money };
  branches: BranchKPI[];
}

export interface BankGroup {
  id: number;
  name: string;
  status: string;
  created_at: string;
  accounts: number;
  account_numbers: string;
  branches: string;
  members: number;
  unreconciled: number;
  balance: Money;
}

export interface BankGroupDetail {
  id: number;
  name: string;
  status: string;
  created_at: string;
  currency: string;
  members: number;
  accounts: { id: number; name: string; account_number: string; branch: string; is_default: boolean; is_closed: boolean; balance: Money }[];
}

export interface BankUser {
  user_id: number;
  name: string;
  phone: string;
  email: string;
  role: "admin" | "staff";
  created_at: string;
}

const b = (bankId: number) => `/v1/bank/${bankId}`;

export function useMyBanks() {
  return useQuery({ queryKey: ["bank", "list"], queryFn: () => api.get<{ banks: BankPanel[] }>("/v1/bank/banks").then((r) => r.banks) });
}

export function useBank(bankId: number) {
  return useQuery({ queryKey: ["bank", bankId], queryFn: () => api.get<BankPanel>(b(bankId)) });
}

export function useBankDashboard(bankId: number, range: { from: string; to: string }) {
  return useQuery({
    queryKey: ["bank", bankId, "dashboard", range],
    queryFn: () => api.get<BankDashboard>(`${b(bankId)}/dashboard${query(range)}`),
    placeholderData: keepPreviousData,
  });
}

export function useBankGroups(bankId: number, params: { search?: string; branch_id?: number; page?: number }) {
  return useQuery({
    queryKey: ["bank", bankId, "groups", params],
    queryFn: () => api.get<Paged<BankGroup>>(`${b(bankId)}/groups${query({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

export function useBankGroup(bankId: number, groupId: number) {
  return useQuery({ queryKey: ["bank", bankId, "group", groupId], queryFn: () => api.get<BankGroupDetail>(`${b(bankId)}/groups/${groupId}`) });
}

export function useBankAlerts(bankId: number, params: AlertParams & { group_id?: number }) {
  return useQuery({
    queryKey: ["bank", bankId, "alerts", params],
    queryFn: () => api.get<Paged<Alert>>(`${b(bankId)}/alerts${query({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

export function useBankUsers(bankId: number) {
  return useQuery({ queryKey: ["bank", bankId, "users"], queryFn: () => api.get<{ users: BankUser[] }>(`${b(bankId)}/users`).then((r) => r.users) });
}

export function useAddBankUser(bankId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { phone: string; role: "admin" | "staff" }) => api.post<{ users: BankUser[] }>(`${b(bankId)}/users`, body),
    onSuccess: (r) => qc.setQueryData(["bank", bankId, "users"], r.users),
  });
}

export function useRemoveBankUser(bankId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => api.delete<unknown>(`${b(bankId)}/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank", bankId, "users"] }),
  });
}
