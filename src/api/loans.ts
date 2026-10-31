import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Paged } from "./admin";
import { api } from "./client";
import type { Approval, NamedRef, PaymentMethod } from "./money";
import type { Money } from "./types";

// Loans (milestone 4). See legion-api docs/api/groups.md ("Loans") and
// docs/schema/loans.md.

const g = (groupId: number) => `/v1/groups/${groupId}`;

function query(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type InterestType = "fixed_balance" | "reducing_balance" | "fixed_amount";
export type RatePer = "day" | "week" | "month" | "year" | "term";
export type Frequency = "daily" | "weekly" | "monthly";

export const interestTypeLabels: Record<InterestType, string> = {
  fixed_balance: "Flat rate",
  reducing_balance: "Reducing balance",
  fixed_amount: "Fixed interest",
};

export const ratePerLabels: Record<RatePer, string> = {
  day: "a day",
  week: "a week",
  month: "a month",
  year: "a year",
  term: "for the whole term",
};

export const frequencyLabels: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const periodWords: Record<Frequency, string> = { daily: "days", weekly: "weeks", monthly: "months" };

export interface FineRule {
  kind: "fixed" | "percentage";
  amount?: string;
  rate?: number;
  rate_on?: "installment_balance" | "loan_amount" | "unpaid_balance" | "installment_interest";
  frequency: "once" | "daily" | "weekly" | "monthly" | "yearly";
  scope?: "installment" | "loan";
}

export const fineFrequencyLabels: Record<FineRule["frequency"], string> = {
  once: "Once",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};

export const rateOnLabels: Record<NonNullable<FineRule["rate_on"]>, string> = {
  installment_balance: "the unpaid installment",
  loan_amount: "the loan amount",
  unpaid_balance: "the unpaid loan balance",
  installment_interest: "the installment's interest",
};

export interface ProcessingFee {
  kind: "fixed" | "percentage";
  amount?: string;
  rate?: number;
  on?: "amount" | "amount_plus_interest";
}

export interface LoanType {
  id: number;
  name: string;
  interest_type: InterestType;
  interest_rate: number;
  rate_per: RatePer;
  reducing_method: string;
  fixed_interest: Money;
  fixed_interest_rate: number;
  frequency: Frequency;
  fixed_term: number | null;
  min_term: number | null;
  max_term: number | null;
  grace_periods: number;
  amount_basis: "range" | "savings";
  min_amount: Money | null;
  max_amount: Money | null;
  savings_multiple: Money | null;
  guarantors: "none" | "always" | "over_max";
  min_guarantors: number | null;
  max_guarantors: number | null;
  late_fine: FineRule | null;
  balance_fine: FineRule | null;
  processing_fee: ProcessingFee | null;
  fine_deferment: boolean;
  needs_approval: boolean;
  is_hidden: boolean;
  /** Offered to debtors (people outside the group), not members. Fixed when the type is made. */
  for_debtors: boolean;
}

export type LoanTypeInput = Omit<LoanType, "id" | "fixed_interest" | "min_amount" | "max_amount" | "savings_multiple"> & {
  fixed_interest?: string;
  min_amount?: string | null;
  max_amount?: string | null;
  savings_multiple?: string | null;
};

export type LoanStatus = "active" | "arrears" | "paid" | "bad_debt" | "voided";

export interface LoanSummary {
  id: number;
  /** The borrower: a member, or a debtor. */
  member: NamedRef | null;
  debtor: NamedRef | null;
  loan_type: NamedRef | null;
  amount: Money;
  disbursed_on: string;
  ends_on: string;
  interest_type: InterestType;
  interest_rate: string;
  rate_per: RatePer;
  frequency: Frequency;
  installments: number;
  payable: Money;
  interest: Money;
  fines: Money;
  paid: Money;
  balance: Money;
  overdue: Money;
  status: LoanStatus;
  description: string;
  created_at: string;
  voided_at: string | null;
}

export interface LoanTotals {
  loans: number;
  lent: Money;
  payable: Money;
  repaid: Money;
  balance: Money;
}

export interface LoanCharge {
  id: number;
  kind: "installment" | "late_fine" | "balance_fine" | "transfer_out" | string;
  number: number | null;
  invoice_on: string;
  due_on: string;
  next_fine_on: string | null;
  principal: Money;
  interest: Money;
  amount: Money;
  paid: Money;
  balance: Money;
  status: string;
  parent_id: number | null;
  voided_at: string | null;
}

export interface LoanRepayment {
  id: number;
  deposit_id: number | null;
  account: NamedRef | null;
  method: PaymentMethod | null;
  amount: Money;
  paid_on: string;
  source: string;
  description: string;
  voided_at: string | null;
}

export interface StatementLine {
  date: string;
  kind: string;
  ref: number;
  debit: Money;
  credit: Money;
  balance: Money;
  note: string;
}

export interface LoanDetail {
  id: number;
  member: NamedRef | null;
  debtor: NamedRef | null;
  loan_type: NamedRef | null;
  account: NamedRef | null;
  amount: Money;
  disbursed_on: string;
  ends_on: string;
  interest_type: InterestType;
  interest_rate: string;
  rate_per: RatePer;
  frequency: Frequency;
  installments: number;
  grace_periods: number;
  first_due_on: string | null;
  late_fine: FineRule | null;
  balance_fine: FineRule | null;
  processing_fee: ProcessingFee | null;
  fine_deferment: boolean;
  is_bad_debt: boolean;
  description: string;
  created_at: string;
  voided_at: string | null;
  status: LoanStatus;
  totals: { payable: Money; principal: Money; interest: Money; fines: Money; paid: Money; balance: Money; overdue: Money; overpaid: Money };
  next_due: { id: number; due_on: string; amount: Money } | null;
  charges: LoanCharge[];
  repayments: LoanRepayment[];
  guarantors: { id: number; member: NamedRef; amount: Money | null; comment: string }[];
  statement: StatementLine[];
}

export interface GuarantorInput {
  member_id: number;
  amount?: string;
  comment?: string;
}

export interface NewLoanInput {
  member_id?: number;
  debtor_id?: number;
  loan_type_id?: number;
  account_id: number;
  amount: string;
  disbursed_on: string;
  installments?: number;
  method?: PaymentMethod;
  first_due_on?: string;
  description?: string;
  guarantors?: GuarantorInput[];
  skip_processing_fee?: boolean;
  // Custom terms, without a loan type.
  interest_type?: InterestType;
  interest_rate?: number;
  rate_per?: RatePer;
  frequency?: Frequency;
  grace_periods?: number;
}

export interface Schedule {
  amount: Money;
  interest: Money;
  total: Money;
  processing_fee: Money;
  ends_on: string;
  installments: { number: number; due_on: string; principal: Money; interest: Money; amount: Money }[];
}

export interface PreviewInput {
  loan_type_id?: number;
  member_id?: number;
  debtor_id?: number;
  for_debtors?: boolean;
  amount: string;
  installments?: number;
  disbursed_on?: string;
  interest_type?: InterestType;
  interest_rate?: number;
  rate_per?: RatePer;
  frequency?: Frequency;
  grace_periods?: number;
}

export type ApplicationStatus = "pending_guarantors" | "pending_approval" | "approved" | "disbursed" | "declined" | "cancelled";

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  pending_guarantors: "With guarantors",
  pending_approval: "With signatories",
  approved: "Approved",
  disbursed: "Paid out",
  declined: "Declined",
  cancelled: "Cancelled",
};

export interface LoanApplication {
  id: number;
  member: NamedRef;
  loan_type: NamedRef;
  amount: Money;
  installments: number;
  description: string;
  status: ApplicationStatus;
  decline_reason: string;
  decided_at: string | null;
  loan_id: number | null;
  created_at: string;
  awaiting_my_guarantee: boolean;
  awaiting_my_approval: boolean;
}

export interface ApplicationGuarantor {
  member_id: number;
  name: string;
  amount: Money | null;
  comment: string;
  decision: Approval["decision"];
  decided_at: string | null;
  reason: string;
}

export interface LoanApplicationDetail extends Omit<LoanApplication, "awaiting_my_guarantee" | "awaiting_my_approval"> {
  guarantors: ApplicationGuarantor[];
  approval_list: Approval[];
  my_guarantee: Approval["decision"] | null;
  my_decision: Approval["decision"] | null;
  can_cancel: boolean;
  can_disburse: boolean;
  schedule?: Schedule;
  schedule_problem?: string;
}

export interface ApplicationInput {
  loan_type_id: number;
  amount: string;
  installments?: number;
  description?: string;
  member_id?: number;
  guarantors: GuarantorInput[];
}

export type ApplicationAction =
  | { action: "guarantee"; approve: boolean; reason?: string }
  | { action: "approve"; password: string }
  | { action: "decline"; password: string; reason: string }
  | { action: "cancel"; reason?: string }
  | { action: "disburse"; account_id: number; disbursed_on: string; method?: PaymentMethod; description?: string; skip_processing_fee?: boolean };

function useInvalidate(groupId: number) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["group", groupId] });
}

export function useLoanTypes(groupId: number, includeHidden = false, forDebtors = false) {
  return useQuery({
    queryKey: ["group", groupId, "loan-types", includeHidden, forDebtors],
    queryFn: () =>
      api
        .get<{ loan_types: LoanType[] }>(`${g(groupId)}/loan-types${query({ include_hidden: includeHidden, for: forDebtors ? "debtors" : "" })}`)
        .then((r) => r.loan_types),
  });
}

export function useSaveLoanType(groupId: number, id?: number) {
  const invalidate = useInvalidate(groupId);
  return useMutation({
    mutationFn: (input: LoanTypeInput) =>
      id ? api.patch<LoanType>(`${g(groupId)}/loan-types/${id}`, input) : api.post<LoanType>(`${g(groupId)}/loan-types`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteLoanType(groupId: number) {
  const invalidate = useInvalidate(groupId);
  return useMutation({
    mutationFn: (id: number) => api.delete<unknown>(`${g(groupId)}/loan-types/${id}`),
    onSuccess: invalidate,
  });
}

export interface LoanParams {
  status?: "" | "open" | "paid" | "voided";
  member_id?: number;
  debtor_id?: number;
  /** "debtors" lists loans to debtors instead of members (officials). */
  borrower?: "debtors";
  loan_type_id?: number;
  page?: number;
}

export function useLoans(groupId: number, params: LoanParams) {
  return useQuery({
    queryKey: ["group", groupId, "loans", params],
    queryFn: () => api.get<{ loans: Paged<LoanSummary>; totals?: LoanTotals }>(`${g(groupId)}/loans${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useLoan(groupId: number, id: number) {
  return useQuery({
    queryKey: ["group", groupId, "loan", id],
    queryFn: () => api.get<LoanDetail>(`${g(groupId)}/loans/${id}`),
  });
}

export function usePreviewLoan(groupId: number, input: PreviewInput | null) {
  return useQuery({
    queryKey: ["group", groupId, "loan-preview", input],
    queryFn: () => api.post<Schedule>(`${g(groupId)}/loans/preview`, input),
    enabled: input != null,
    retry: false,
  });
}

export function useRecordLoan(groupId: number) {
  const invalidate = useInvalidate(groupId);
  return useMutation({
    mutationFn: (input: NewLoanInput) => api.post<LoanDetail>(`${g(groupId)}/loans`, input),
    onSuccess: invalidate,
  });
}

export type LoanAction =
  | { action: "void" }
  | { action: "update"; description?: string; is_bad_debt?: boolean }
  | { action: "repay"; account_id: number; amount: string; paid_on: string; method?: PaymentMethod; description?: string }
  | { action: "void_repayment"; id: number }
  | { action: "waive_fine"; id: number };

export function useLoanAction(groupId: number, loanId: number) {
  const invalidate = useInvalidate(groupId);
  const base = `${g(groupId)}/loans/${loanId}`;
  return useMutation({
    mutationFn: (a: LoanAction) => {
      switch (a.action) {
        case "void":
          return api.post<unknown>(`${base}/void`, {});
        case "update": {
          const { action: _, ...body } = a;
          return api.patch<unknown>(base, body);
        }
        case "repay": {
          const { action: _, ...body } = a;
          return api.post<unknown>(`${base}/repayments`, body);
        }
        case "void_repayment":
          return api.post<unknown>(`${base}/repayments/${a.id}/void`, {});
        case "waive_fine":
          return api.post<unknown>(`${base}/fines/${a.id}/void`, {});
      }
    },
    onSuccess: invalidate,
  });
}

export function useLoanApplications(groupId: number, params: { status?: string; awaiting?: "me"; member_id?: number; page?: number }) {
  return useQuery({
    queryKey: ["group", groupId, "loan-applications", params],
    queryFn: () =>
      api.get<{ loan_applications: Paged<LoanApplication> }>(`${g(groupId)}/loan-applications${query(params)}`).then((r) => r.loan_applications),
    placeholderData: keepPreviousData,
  });
}

export function useLoanApplication(groupId: number, id: number | null) {
  return useQuery({
    queryKey: ["group", groupId, "loan-application", id],
    queryFn: () => api.get<LoanApplicationDetail>(`${g(groupId)}/loan-applications/${id}`),
    enabled: id != null,
  });
}

export function useApplyForLoan(groupId: number) {
  const invalidate = useInvalidate(groupId);
  return useMutation({
    mutationFn: (input: ApplicationInput) => api.post<LoanApplicationDetail>(`${g(groupId)}/loan-applications`, input),
    onSuccess: invalidate,
  });
}

export function useApplicationAction(groupId: number, id: number) {
  const invalidate = useInvalidate(groupId);
  return useMutation({
    mutationFn: ({ action, ...body }: ApplicationAction) =>
      api.post<LoanApplicationDetail>(`${g(groupId)}/loan-applications/${id}/${action}`, body),
    onSuccess: invalidate,
  });
}

// ---- wording ----

/** borrowerName is who a loan went to. */
export function borrowerName(l: { member: NamedRef | null; debtor: NamedRef | null }): string {
  return l.member?.name ?? l.debtor?.name ?? "";
}

export function interestText(t: { interest_type: InterestType; interest_rate: number | string; rate_per: RatePer; fixed_interest?: string }): string {
  if (t.interest_type === "fixed_amount") return "Fixed interest";
  return `${Number(t.interest_rate)}% ${ratePerLabels[t.rate_per]}, ${interestTypeLabels[t.interest_type].toLowerCase()}`;
}

export function termText(t: Pick<LoanType, "fixed_term" | "min_term" | "max_term" | "frequency">): string {
  const w = periodWords[t.frequency];
  if (t.fixed_term) return `${t.fixed_term} ${w}`;
  if (t.min_term || t.max_term) return `${t.min_term ?? 1} to ${t.max_term ?? "any number of"} ${w}`;
  return "Any term";
}

export function fineText(f: FineRule | null, currency: string): string {
  if (!f) return "None";
  const what = f.kind === "fixed" ? `${currency} ${f.amount}` : `${f.rate}% of ${rateOnLabels[f.rate_on ?? "installment_balance"]}`;
  return `${what}, ${fineFrequencyLabels[f.frequency].toLowerCase()}`;
}

export function feeText(f: ProcessingFee | null, currency: string): string {
  if (!f) return "None";
  if (f.kind === "fixed") return `${currency} ${f.amount}`;
  return `${f.rate}% of the ${f.on === "amount_plus_interest" ? "amount plus interest" : "amount"}`;
}

export const loanStatusTones: Record<LoanStatus, "brand" | "warn" | "danger" | "neutral"> = {
  active: "brand",
  arrears: "warn",
  paid: "neutral",
  bad_debt: "danger",
  voided: "neutral",
};

export const loanStatusLabels: Record<LoanStatus, string> = {
  active: "Running",
  arrears: "In arrears",
  paid: "Paid off",
  bad_debt: "Bad debt",
  voided: "Voided",
};
