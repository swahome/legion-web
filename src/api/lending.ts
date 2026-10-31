import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { NamedRef, PaymentMethod } from "./money";
import type { Money } from "./types";

// Milestone 4b: bank loans (money the group borrowed) and debtors (people
// outside the group who borrow from it). Loans to debtors use the loan
// hooks in ./loans with debtor_id. See legion-api docs/api/groups.md.

const g = (groupId: number) => `/v1/groups/${groupId}`;

export type BankLoanStatus = "active" | "paid" | "voided";

export interface BankLoan {
  id: number;
  description: string;
  amount: Money;
  total_payable: Money;
  opening_balance: Money;
  repaid: Money;
  balance: Money;
  starts_on: string;
  ends_on: string;
  account: NamedRef | null;
  status: BankLoanStatus;
  created_at: string;
  voided_at: string | null;
}

export interface BankLoanRepayment {
  id: number;
  account: NamedRef | null;
  method: PaymentMethod | null;
  amount: Money;
  paid_on: string;
  description: string;
  voided_at: string | null;
}

export interface BankLoanTotals {
  loans: number;
  received: Money;
  repaid: Money;
  balance: Money;
}

export interface BankLoanInput {
  description: string;
  amount: string;
  total_payable: string;
  balance?: string;
  starts_on: string;
  ends_on: string;
  account_id: number;
  method?: PaymentMethod;
}

export const bankLoanStatusLabels: Record<BankLoanStatus, string> = { active: "Repaying", paid: "Paid off", voided: "Voided" };
export const bankLoanStatusTones: Record<BankLoanStatus, "brand" | "neutral"> = { active: "brand", paid: "neutral", voided: "neutral" };

function useInvalidate(groupId: number) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["group", groupId] });
}

export function useBankLoans(groupId: number, status: "" | "open" | "paid" | "voided" = "") {
  return useQuery({
    queryKey: ["group", groupId, "bank-loans", status],
    queryFn: () => api.get<{ bank_loans: BankLoan[]; totals: BankLoanTotals }>(`${g(groupId)}/bank-loans${status ? `?status=${status}` : ""}`),
  });
}

export function useBankLoan(groupId: number, id: number) {
  return useQuery({
    queryKey: ["group", groupId, "bank-loan", id],
    queryFn: () => api.get<{ bank_loan: BankLoan; repayments: BankLoanRepayment[] }>(`${g(groupId)}/bank-loans/${id}`),
  });
}

export function useRecordBankLoan(groupId: number) {
  const invalidate = useInvalidate(groupId);
  return useMutation({
    mutationFn: (input: BankLoanInput) => api.post<{ bank_loan: BankLoan }>(`${g(groupId)}/bank-loans`, input),
    onSuccess: invalidate,
  });
}

export type BankLoanAction =
  | { action: "void" }
  | { action: "update"; description: string; total_payable: string; balance: string; ends_on: string }
  | { action: "repay"; account_id: number; amount: string; paid_on: string; method?: PaymentMethod; description?: string }
  | { action: "void_repayment"; id: number };

export function useBankLoanAction(groupId: number, id: number) {
  const invalidate = useInvalidate(groupId);
  const base = `${g(groupId)}/bank-loans/${id}`;
  return useMutation({
    mutationFn: (a: BankLoanAction) => {
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
      }
    },
    onSuccess: invalidate,
  });
}

// ---- Debtors ----

export interface Debtor {
  id: number;
  name: string;
  phone: string;
  email: string;
  id_number: string;
  description: string;
  is_active: boolean;
  loans: number;
  lent: Money;
  balance: Money;
  created_at: string;
}

export type DebtorInput = Pick<Debtor, "name" | "phone" | "email" | "id_number" | "description">;

export function useDebtors(groupId: number, includeInactive = false, enabled = true) {
  return useQuery({
    queryKey: ["group", groupId, "debtors", includeInactive],
    queryFn: () => api.get<{ debtors: Debtor[] }>(`${g(groupId)}/debtors${includeInactive ? "?include_inactive=true" : ""}`).then((r) => r.debtors),
    enabled,
  });
}

export function useDebtor(groupId: number, id: number) {
  return useQuery({
    queryKey: ["group", groupId, "debtor", id],
    queryFn: () => api.get<Debtor>(`${g(groupId)}/debtors/${id}`),
  });
}

export function useSaveDebtor(groupId: number, id?: number) {
  const invalidate = useInvalidate(groupId);
  return useMutation({
    mutationFn: (input: DebtorInput) => (id ? api.patch<Debtor>(`${g(groupId)}/debtors/${id}`, input) : api.post<Debtor>(`${g(groupId)}/debtors`, input)),
    onSuccess: invalidate,
  });
}

export function useDebtorAction(groupId: number, id: number) {
  const invalidate = useInvalidate(groupId);
  return useMutation({
    mutationFn: (action: "suspend" | "activate" | "delete") =>
      action === "delete" ? api.delete<unknown>(`${g(groupId)}/debtors/${id}`) : api.post<unknown>(`${g(groupId)}/debtors/${id}/${action}`, {}),
    onSuccess: invalidate,
  });
}
