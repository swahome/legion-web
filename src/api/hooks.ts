import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Contribution,
  Frequency,
  Group,
  Me,
  Member,
  MemberBalance,
  MembershipStatus,
  Role,
  Statement,
} from "./types";

const g = (groupId: number | string) => `/v1/groups/${groupId}`;

export const keys = {
  me: ["me"] as const,
  group: (id: number) => ["group", id] as const,
  roles: (id: number) => ["group", id, "roles"] as const,
  members: (id: number, status: string, q: string) => ["group", id, "members", status, q] as const,
  member: (id: number, mid: number) => ["group", id, "member", mid] as const,
  statement: (id: number, mid: number, params: StatementParams) => ["group", id, "statement", mid, params] as const,
  contributions: (id: number) => ["group", id, "contributions"] as const,
  contribution: (id: number, cid: number) => ["group", id, "contribution", cid] as const,
  balances: (id: number) => ["group", id, "balances"] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api.get<Me>("/v1/me") });
}

export function useGroup(groupId: number) {
  return useQuery({ queryKey: keys.group(groupId), queryFn: () => api.get<Group>(g(groupId) + "/") });
}

export function useRoles(groupId: number) {
  return useQuery({
    queryKey: keys.roles(groupId),
    queryFn: () => api.get<{ roles: Role[] }>(g(groupId) + "/roles").then((r) => r.roles),
  });
}

export function useMembers(groupId: number, status = "active", q = "") {
  return useQuery({
    queryKey: keys.members(groupId, status, q),
    queryFn: () => {
      const p = new URLSearchParams({ status });
      if (q) p.set("q", q);
      return api.get<{ members: Member[] }>(`${g(groupId)}/members?${p}`).then((r) => r.members);
    },
    placeholderData: (prev) => prev,
  });
}

export function useMember(groupId: number, memberId: number) {
  return useQuery({
    queryKey: keys.member(groupId, memberId),
    queryFn: () => api.get<Member>(`${g(groupId)}/members/${memberId}`),
  });
}

export interface StatementParams {
  from?: string;
  to?: string;
  contribution_id?: number;
}

export function useStatement(groupId: number, memberId: number, params: StatementParams) {
  return useQuery({
    queryKey: keys.statement(groupId, memberId, params),
    queryFn: () => {
      const p = new URLSearchParams();
      if (params.from) p.set("from", params.from);
      if (params.to) p.set("to", params.to);
      if (params.contribution_id) p.set("contribution_id", String(params.contribution_id));
      return api.get<Statement>(`${g(groupId)}/members/${memberId}/statement?${p}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function useContributions(groupId: number) {
  return useQuery({
    queryKey: keys.contributions(groupId),
    queryFn: () => api.get<{ contributions: Contribution[] }>(g(groupId) + "/contributions").then((r) => r.contributions),
  });
}

export function useContribution(groupId: number, contributionId: number, enabled = true) {
  return useQuery({
    queryKey: keys.contribution(groupId, contributionId),
    queryFn: () => api.get<Contribution>(`${g(groupId)}/contributions/${contributionId}`),
    enabled,
  });
}

export function useBalances(groupId: number) {
  return useQuery({
    queryKey: keys.balances(groupId),
    queryFn: () => api.get<{ currency: string; balances: MemberBalance[] }>(g(groupId) + "/contribution-balances"),
  });
}

export interface AddMemberInput {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  is_official: boolean;
  role_id: number | null;
  membership_number?: string;
}

export interface UpdateMemberInput {
  is_official?: boolean;
  role_id?: number | null;
  membership_number?: string;
  status?: MembershipStatus;
}

export function useAddMember(groupId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) => api.post<Member>(g(groupId) + "/members", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group", groupId] }),
  });
}

export function useUpdateMember(groupId: number, memberId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMemberInput) => api.patch<Member>(`${g(groupId)}/members/${memberId}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export interface ContributionInput {
  name?: string;
  kind?: Contribution["kind"];
  category?: Contribution["category"];
  amount?: string;
  is_active?: boolean;
  is_hidden?: boolean;
  applies_to_all_members?: boolean;
  member_ids?: number[];
  schedule?: {
    frequency: Frequency | null;
    invoice_date?: string | null;
    contribution_date: string;
    invoicing_active?: boolean;
    sms_notifications?: boolean;
    email_notifications?: boolean;
    fines_enabled?: boolean;
  };
}

export function useSaveContribution(groupId: number, contributionId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ContributionInput) =>
      contributionId
        ? api.patch<Contribution>(`${g(groupId)}/contributions/${contributionId}`, input)
        : api.post<Contribution>(g(groupId) + "/contributions", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group", groupId] }),
  });
}
