import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Paged } from "./admin";
import { api } from "./client";
import type { Money } from "./types";

// Group accounts, the cash book, deposits and categories (milestone 3).
// See legion-api docs/api/groups.md, "Money".

const g = (groupId: number) => `/v1/groups/${groupId}`;

export type AccountKind = "bank" | "sacco" | "mobile_money" | "petty_cash";

export const accountKindLabels: Record<AccountKind, string> = {
  bank: "Bank",
  sacco: "Sacco",
  mobile_money: "Mobile money",
  petty_cash: "Petty cash",
};

export interface NamedRef {
  id: number;
  name: string;
}

export interface Account {
  id: number;
  kind: AccountKind;
  name: string;
  account_number: string;
  institution: NamedRef | null;
  branch: NamedRef | null;
  initial_balance: Money;
  balance: Money;
  is_default: boolean;
  is_verified: boolean;
  is_closed: boolean;
}

export interface Unassigned {
  kind: AccountKind;
  balance: Money;
  entries: number;
}

export interface Accounts {
  accounts: Account[];
  unassigned: Unassigned[];
  total_balance: Money;
}

export interface CashBookEntry {
  id: number;
  date: string;
  type: string;
  description: string;
  account: NamedRef | null;
  account_kind: AccountKind;
  money_in: Money | null;
  money_out: Money | null;
  balance: Money;
  deposit_id?: number;
  withdrawal_id?: number;
  account_transfer_id?: number;
  member: NamedRef | null;
}

export interface CashBook {
  from: string;
  to: string;
  account_id: number | null;
  opening_balance: Money;
  closing_balance: Money;
  total_in: Money;
  total_out: Money;
  entries: CashBookEntry[];
  truncated: boolean;
}

export type DepositKind =
  | "contribution"
  | "fine"
  | "misc"
  | "income"
  | "loan_repayment"
  | "bank_loan"
  | "stock_sale"
  | "money_market"
  | "asset_sale"
  | "funds_transfer"
  | "loan_processing_income"
  | "external_lending_processing_income"
  | "external_lending_repayment";

export const depositKindLabels: Record<DepositKind, string> = {
  contribution: "Contribution payment",
  fine: "Fine payment",
  misc: "Miscellaneous payment",
  income: "Income",
  loan_repayment: "Loan repayment",
  bank_loan: "Bank loan",
  stock_sale: "Stock sale",
  money_market: "Money market cash-in",
  asset_sale: "Asset sale",
  funds_transfer: "Funds transfer",
  loan_processing_income: "Loan processing income",
  external_lending_processing_income: "External lending income",
  external_lending_repayment: "External lending repayment",
};

/** Deposits an official can record by hand today. */
export const recordableKinds = ["contribution", "fine", "misc", "income"] as const;
export type RecordableKind = (typeof recordableKinds)[number];

export type PaymentMethod = "mpesa" | "cash" | "cheque" | "funds_transfer" | "equitel" | "standing_order";

export const methodLabels: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  cash: "Cash",
  cheque: "Cheque",
  funds_transfer: "Funds transfer",
  equitel: "Equitel",
  standing_order: "Standing order",
};

export interface Deposit {
  id: number;
  kind: DepositKind;
  method: PaymentMethod | null;
  amount: Money;
  date: string;
  description: string;
  account: NamedRef | null;
  account_kind: AccountKind;
  member: NamedRef | null;
  contribution: NamedRef | null;
  fine_category: NamedRef | null;
  income_category: NamedRef | null;
  depositor: NamedRef | null;
  created_at: string;
  voided_at: string | null;
}

export interface Deposits {
  deposits: Paged<Deposit>;
  totals_by_kind: Partial<Record<DepositKind, Money>>;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  amount?: Money;
  is_administrative?: boolean;
  is_hidden: boolean;
  is_active: boolean;
}

export type CategoryType = "fine" | "income" | "expense";

export interface Depositor {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  description: string;
  is_active: boolean;
}

export const moneyKeys = {
  accounts: (id: number) => ["group", id, "accounts"] as const,
  cashBook: (id: number, p: CashBookParams) => ["group", id, "cash-book", p] as const,
  deposits: (id: number, p: DepositParams) => ["group", id, "deposits", p] as const,
  categories: (id: number, t: CategoryType, all: boolean) => ["group", id, "categories", t, all] as const,
  depositors: (id: number) => ["group", id, "depositors"] as const,
};

function query(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function useAccounts(groupId: number) {
  return useQuery({ queryKey: moneyKeys.accounts(groupId), queryFn: () => api.get<Accounts>(g(groupId) + "/accounts") });
}

export interface AccountInput {
  kind?: AccountKind;
  name?: string;
  account_number?: string;
  institution_id?: number;
  branch_id?: number | null;
  initial_balance?: string;
  is_default?: boolean;
  is_closed?: boolean;
}

/** invalidateMoney refreshes everything a money write can change. */
function useInvalidateMoney(groupId: number) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["group", groupId] });
}

export function useSaveAccount(groupId: number, accountId?: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (input: AccountInput) =>
      accountId ? api.patch<Account>(`${g(groupId)}/accounts/${accountId}`, input) : api.post<Account>(g(groupId) + "/accounts", input),
    onSuccess: invalidate,
  });
}

export function useDeleteAccount(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (accountId: number) => api.delete<void>(`${g(groupId)}/accounts/${accountId}`),
    onSuccess: invalidate,
  });
}

export interface CashBookParams {
  from?: string;
  to?: string;
  account_id?: number;
}

export function useCashBook(groupId: number, params: CashBookParams) {
  return useQuery({
    queryKey: moneyKeys.cashBook(groupId, params),
    queryFn: () => api.get<CashBook>(`${g(groupId)}/cash-book${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export interface DepositParams {
  kind?: DepositKind;
  member_id?: number;
  account_id?: number;
  from?: string;
  to?: string;
  include_voided?: boolean;
  page?: number;
}

export function useDeposits(groupId: number, params: DepositParams) {
  return useQuery({
    queryKey: moneyKeys.deposits(groupId, params),
    queryFn: () => api.get<Deposits>(`${g(groupId)}/deposits${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export interface DepositInput {
  kind: RecordableKind;
  account_id: number;
  amount: string;
  date: string;
  method?: PaymentMethod;
  description?: string;
  member_id?: number;
  contribution_id?: number;
  fine_category_id?: number;
  income_category_id?: number;
  depositor_id?: number;
}

export function useRecordDeposit(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (input: DepositInput) => api.post<Deposit>(g(groupId) + "/deposits", input),
    onSuccess: invalidate,
  });
}

export function useVoidDeposit(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (depositId: number) => api.post<Deposit>(`${g(groupId)}/deposits/${depositId}/void`, {}),
    onSuccess: invalidate,
  });
}

export function useCategories(groupId: number, type: CategoryType, all = false) {
  return useQuery({
    queryKey: moneyKeys.categories(groupId, type, all),
    queryFn: () => api.get<{ categories: Category[] }>(`${g(groupId)}/${type}-categories${all ? "?all=true" : ""}`).then((r) => r.categories),
  });
}

export interface CategoryInput {
  name?: string;
  description?: string;
  amount?: string;
  is_hidden?: boolean;
  is_active?: boolean;
}

export function useSaveCategory(groupId: number, type: CategoryType) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: ({ id, ...input }: CategoryInput & { id?: number }) =>
      id ? api.patch<Category>(`${g(groupId)}/${type}-categories/${id}`, input) : api.post<Category>(`${g(groupId)}/${type}-categories`, input),
    onSuccess: invalidate,
  });
}

export function useDepositors(groupId: number) {
  return useQuery({
    queryKey: moneyKeys.depositors(groupId),
    queryFn: () => api.get<{ depositors: Depositor[] }>(g(groupId) + "/depositors").then((r) => r.depositors),
  });
}

export function useSaveDepositor(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<Omit<Depositor, "id">> & { id?: number }) =>
      id ? api.patch<Depositor>(`${g(groupId)}/depositors/${id}`, input) : api.post<Depositor>(g(groupId) + "/depositors", input),
    onSuccess: invalidate,
  });
}

/** Institutions an account can be held with, from /v1/reference. */
export function useInstitutions(kind: AccountKind) {
  const path = { bank: "banks", sacco: "saccos", mobile_money: "mobile-money-providers", petty_cash: "" }[kind];
  return useQuery({
    queryKey: ["reference", path],
    queryFn: () => api.get<NamedRef[]>(`/v1/reference/${path}`),
    enabled: !!path,
    staleTime: 10 * 60_000,
  });
}

export function useInstitutionBranches(kind: AccountKind, institutionId: number | null) {
  const path = kind === "bank" ? "banks" : kind === "sacco" ? "saccos" : "";
  return useQuery({
    queryKey: ["reference", path, institutionId, "branches"],
    queryFn: () => api.get<NamedRef[]>(`/v1/reference/${path}/${institutionId}/branches`),
    enabled: !!path && !!institutionId,
    staleTime: 10 * 60_000,
  });
}

// Money out: withdrawals, transfers and withdrawal requests (milestone 3, part 2).

export type WithdrawalKind =
  | "expense"
  | "asset_purchase"
  | "loan_disbursement"
  | "stock_purchase"
  | "money_market_investment"
  | "contribution_refund"
  | "bank_loan_repayment"
  | "funds_transfer"
  | "external_loan_disbursement"
  | "dividend";

export const withdrawalKindLabels: Record<WithdrawalKind, string> = {
  expense: "Expense",
  asset_purchase: "Asset purchase",
  loan_disbursement: "Loan disbursement",
  stock_purchase: "Stock purchase",
  money_market_investment: "Money market investment",
  contribution_refund: "Contribution refund",
  bank_loan_repayment: "Bank loan repayment",
  funds_transfer: "Funds transfer",
  external_loan_disbursement: "External loan",
  dividend: "Dividend",
};

/** Withdrawals an official can record by hand today. */
export const recordableWithdrawals = ["expense", "contribution_refund"] as const;
export type RecordableWithdrawal = (typeof recordableWithdrawals)[number];

export interface Withdrawal {
  id: number;
  kind: WithdrawalKind;
  method: PaymentMethod | null;
  amount: Money;
  date: string;
  description: string;
  account: NamedRef | null;
  account_kind: AccountKind;
  member: NamedRef | null;
  contribution: NamedRef | null;
  expense_category: NamedRef | null;
  created_at: string;
  voided_at: string | null;
}

export interface Withdrawals {
  withdrawals: Paged<Withdrawal>;
  totals_by_kind: Partial<Record<WithdrawalKind, Money>>;
}

export interface WithdrawalParams {
  kind?: WithdrawalKind;
  member_id?: number;
  account_id?: number;
  from?: string;
  to?: string;
  include_voided?: boolean;
  page?: number;
}

export interface WithdrawalInput {
  kind: RecordableWithdrawal;
  account_id: number;
  amount: string;
  date: string;
  method?: PaymentMethod;
  description?: string;
  member_id?: number;
  contribution_id?: number;
  expense_category_id?: number;
}

export function useWithdrawals(groupId: number, params: WithdrawalParams) {
  return useQuery({
    queryKey: ["group", groupId, "withdrawals", params],
    queryFn: () => api.get<Withdrawals>(`${g(groupId)}/withdrawals${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useRecordWithdrawal(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (input: WithdrawalInput) => api.post<Withdrawal>(g(groupId) + "/withdrawals", input),
    onSuccess: invalidate,
  });
}

export function useVoidWithdrawal(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (id: number) => api.post<Withdrawal>(`${g(groupId)}/withdrawals/${id}/void`, {}),
    onSuccess: invalidate,
  });
}

export interface Transfer {
  id: number;
  amount: Money;
  date: string;
  description: string;
  from_account: NamedRef | null;
  to_account: NamedRef | null;
  created_at: string;
  voided_at: string | null;
}

export interface TransferInput {
  from_account_id: number;
  to_account_id: number;
  amount: string;
  date: string;
  description?: string;
}

export function useTransfers(groupId: number, params: { include_voided?: boolean; page?: number }) {
  return useQuery({
    queryKey: ["group", groupId, "transfers", params],
    queryFn: () => api.get<{ transfers: Paged<Transfer> }>(`${g(groupId)}/transfers${query(params)}`).then((r) => r.transfers),
    placeholderData: keepPreviousData,
  });
}

export function useRecordTransfer(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (input: TransferInput) => api.post<Transfer>(g(groupId) + "/transfers", input),
    onSuccess: invalidate,
  });
}

export function useVoidTransfer(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (id: number) => api.post<Transfer>(`${g(groupId)}/transfers/${id}/void`, {}),
    onSuccess: invalidate,
  });
}

export type RequestStatus = "pending" | "approved" | "declined" | "cancelled" | "paid" | "failed";

export const requestStatusLabels: Record<RequestStatus, string> = {
  pending: "Waiting for approval",
  approved: "Approved, not paid",
  declined: "Declined",
  cancelled: "Cancelled",
  paid: "Paid",
  failed: "Payment failed",
};

export type Recipient =
  | { type: "mobile"; phone: string }
  | { type: "paybill"; paybill: string; account_number?: string }
  | { type: "bank"; bank_id: number; account_number: string; account_name: string };

export interface Approval {
  member_id: number;
  name: string;
  role: string | null;
  decision: "pending" | "approved" | "declined";
  decided_at: string | null;
  comment: string;
}

export interface WithdrawalRequest {
  id: number;
  reference_number: string;
  kind: WithdrawalKind;
  status: RequestStatus;
  amount: Money;
  description: string;
  account: NamedRef | null;
  to_account: NamedRef | null;
  expense_category: NamedRef | null;
  member: NamedRef | null;
  contribution: NamedRef | null;
  requested_by: NamedRef | null;
  recipient: Partial<Recipient> & { type?: string };
  approvals: number;
  signatories: number;
  decided_at: string | null;
  decline_reason: string;
  withdrawal_id: number | null;
  transfer_id: number | null;
  created_at: string;
}

export interface WithdrawalRequestDetail extends WithdrawalRequest {
  approval_list: Approval[];
  my_decision: Approval["decision"] | null;
}

/** Kinds that can go through a withdrawal request. */
export const requestKinds = ["expense", "contribution_refund", "funds_transfer"] as const;
export type RequestKind = (typeof requestKinds)[number];

export interface WithdrawalRequestInput {
  kind: RequestKind;
  account_id: number;
  amount: string;
  description?: string;
  to_account_id?: number;
  expense_category_id?: number;
  member_id?: number;
  contribution_id?: number;
  recipient?: Recipient;
}

export function useWithdrawalRequests(groupId: number, params: { status?: RequestStatus; awaiting?: "me"; page?: number }) {
  return useQuery({
    queryKey: ["group", groupId, "withdrawal-requests", params],
    queryFn: () =>
      api.get<{ requests: Paged<WithdrawalRequest> }>(`${g(groupId)}/withdrawal-requests${query(params)}`).then((r) => r.requests),
    placeholderData: keepPreviousData,
  });
}

export function useWithdrawalRequest(groupId: number, id: number | null) {
  return useQuery({
    queryKey: ["group", groupId, "withdrawal-request", id],
    queryFn: () => api.get<WithdrawalRequestDetail>(`${g(groupId)}/withdrawal-requests/${id}`),
    enabled: id != null,
  });
}

export function useCreateWithdrawalRequest(groupId: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: (input: WithdrawalRequestInput) => api.post<WithdrawalRequestDetail>(g(groupId) + "/withdrawal-requests", input),
    onSuccess: invalidate,
  });
}

export type RequestAction =
  | { action: "approve"; password: string }
  | { action: "decline"; password: string; reason: string }
  | { action: "cancel"; reason?: string }
  | { action: "pay"; date: string; method?: PaymentMethod };

export function useRequestAction(groupId: number, id: number) {
  const invalidate = useInvalidateMoney(groupId);
  return useMutation({
    mutationFn: ({ action, ...body }: RequestAction) =>
      api.post<WithdrawalRequestDetail>(`${g(groupId)}/withdrawal-requests/${id}/${action}`, body),
    onSuccess: invalidate,
  });
}
