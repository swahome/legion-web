import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Money } from "./types";

// The group dashboard (milestone 3, part 4). See legion-api docs/api/groups.md ("Dashboard").

export interface Flows {
  contributions: Money;
  fines: Money;
  misc: Money;
  income: Money;
  expenses: Money;
}

export interface DashboardMovement {
  id: number;
  date: string;
  direction: "in" | "out";
  kind: string;
  amount: Money;
  description: string;
  account: string;
  account_kind: string;
  member: string;
}

export interface Dashboard {
  currency: string;
  as_of: string;
  cash: {
    at_bank: Money;
    at_hand: Money;
    total: Money;
    by_kind: Record<"bank" | "sacco" | "mobile_money" | "petty_cash", Money>;
    accounts: Record<"bank" | "sacco" | "mobile_money" | "petty_cash", number>;
  };
  totals: Flows;
  months: (Flows & { month: string })[];
  years: (Flows & { year: number })[];
  owed: Record<"contributions" | "fines" | "misc", { owed: Money; members: number }>;
  members_behind: number;
  recent?: DashboardMovement[];
  pending_withdrawal_requests?: number;
  loans?: { count: number; lent: Money; repaid: Money; balance: Money };
}

export function useDashboard(groupId: number) {
  return useQuery({
    queryKey: ["group", groupId, "dashboard"],
    queryFn: () => api.get<Dashboard>(`/v1/groups/${groupId}/dashboard`),
  });
}

/** moneyIn adds up everything that came in during a period. */
export function moneyIn(f: Flows): number {
  return Number(f.contributions) + Number(f.fines) + Number(f.misc) + Number(f.income);
}
