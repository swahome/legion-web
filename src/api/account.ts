import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { keys } from "./hooks";
import type { Country } from "./admin";
import type { Session } from "./types";

// Sign-up, phone verification, password reset, invites, creating a group and
// the setup wizard (legion-api milestone 5).

export interface SignupInput {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  password: string;
}

export function signup(input: SignupInput): Promise<Session> {
  return api.authenticate("/v1/auth/signup", input);
}

export function forgotPassword(identity: string): Promise<void> {
  return api.publicPost("/v1/auth/forgot-password", { identity });
}

export function resetPassword(identity: string, code: string, password: string): Promise<Session> {
  return api.authenticate("/v1/auth/reset-password", { identity, code, password });
}

export interface Invite {
  first_name: string;
  group_name: string;
  invited_by: string;
  needs_password: boolean;
}

export function useInvite(token: string) {
  return useQuery({ queryKey: ["invite", token], queryFn: () => api.publicGet<Invite>(`/v1/auth/invites/${encodeURIComponent(token)}`), retry: false });
}

export function acceptInvite(token: string, password: string): Promise<Session> {
  return api.authenticate(`/v1/auth/invites/${encodeURIComponent(token)}`, { password });
}

export function useVerifyPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<unknown>("/v1/auth/verify-phone", { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useResendPhoneCode() {
  return useMutation({ mutationFn: () => api.post<unknown>("/v1/auth/verify-phone/resend", {}) });
}

export interface GroupType {
  key: string;
  name: string;
}

export function useGroupTypes() {
  return useQuery({
    queryKey: ["group-types"],
    queryFn: () => api.get<GroupType[]>("/v1/group-types"),
    staleTime: Infinity,
  });
}

export interface GroupDetails {
  id: number;
  name: string;
  slug: string;
  status: string;
  country_code: string;
  currency: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  size: number | null;
  type: string | null;
  type_name: string | null;
}

export interface GroupDetailsInput {
  name?: string;
  country_code?: string;
  currency?: string;
  email?: string;
  phone?: string;
  address?: string;
  size?: number;
  type?: string;
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupDetailsInput) => api.post<{ group: GroupDetails; membership_id: number }>("/v1/groups", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export type SetupStepKey = "details" | "members" | "contributions" | "fines" | "accounts" | "loan_types";

export interface SetupState {
  group: GroupDetails;
  steps: { key: SetupStepKey; done: boolean; count: number }[];
  members_to_invite: number;
  completed_at: string | null;
}

const setupKey = (groupId: number) => ["group", groupId, "setup"] as const;

export function useSetup(groupId: number) {
  return useQuery({ queryKey: setupKey(groupId), queryFn: () => api.get<SetupState>(`/v1/groups/${groupId}/setup`) });
}

export function useUpdateGroup(groupId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupDetailsInput) => api.patch<GroupDetails>(`/v1/groups/${groupId}/`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useCompleteSetup(groupId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ group: GroupDetails; invites_sent: number }>(`/v1/groups/${groupId}/setup/complete`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useInviteMember(groupId: number) {
  return useMutation({ mutationFn: (memberId: number) => api.post<void>(`/v1/groups/${groupId}/members/${memberId}/invite`, {}) });
}

export interface SMSMessage {
  id: number;
  to: string;
  body: string;
  kind: string;
  user_id: number | null;
  group: { id: number; name: string } | null;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  provider_status: string | null;
  cost: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export const smsPageSize = 50;

export function useSMS(params: { status?: string; phone?: string; page: number }) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.phone) q.set("phone", params.phone);
  if (params.page > 1) q.set("page", String(params.page));
  const qs = q.toString();
  return useQuery({
    queryKey: ["admin", "sms", params],
    queryFn: () => api.get<{ messages: SMSMessage[] }>(`/v1/admin/sms${qs ? `?${qs}` : ""}`).then((r) => r.messages),
  });
}

/** useActiveCountries is the country picker for a new group. */
export function useActiveCountries() {
  return useQuery({ queryKey: ["reference", "countries"], queryFn: () => api.get<Country[]>("/v1/reference/countries"), staleTime: Infinity });
}
