import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Money } from "./types";

// Platform admin endpoints (/v1/admin). See legion-api docs/api/admin.md.

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminStats {
  groups: number;
  active_groups: number;
  users: number;
  users_active_30d: number;
  memberships: number;
}

export type GroupStatus = "setup" | "active" | "suspended" | "closed";

export interface AdminGroup {
  id: number;
  legacy_id: number | null;
  name: string;
  slug: string;
  status: GroupStatus;
  currency: string;
  country_code: string;
  active_members: number;
  created_at: string;
}

export const platformRoles = [
  "admin",
  "group_account_manager",
  "banker",
  "partner",
  "sales",
  "diocese_admin",
  "deanery_admin",
  "parish_admin",
  "sub_parish_admin",
] as const;
export type PlatformRole = (typeof platformRoles)[number];

export interface AdminUserMembership {
  membership_id: number;
  group_id: number;
  group_name: string;
  is_official: boolean;
  role_name: string | null;
  status: string;
  joined_at: string;
}

export interface AdminUser {
  id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  id_number?: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  platform_roles: PlatformRole[];
  groups?: number;
  memberships?: AdminUserMembership[];
}

export interface AdminTransaction {
  id: number;
  group_id: number;
  group_name: string;
  membership_id: number | null;
  member_name: string;
  type: string;
  label: string;
  amount: Money;
  date: string;
  contribution_id: number | null;
  contribution_name: string | null;
  description: string;
  voided_at: string | null;
}

export interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: number | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface Country {
  id: number;
  name: string;
  code: string;
  currency_code: string;
  currency_name: string;
  calling_code: string;
  is_default: boolean;
  is_active: boolean;
}

export interface County {
  id: number;
  country_id: number;
  name: string;
  code: number | null;
  capital: string;
  is_active: boolean;
}

export interface Bank {
  id: number;
  name: string;
  slug: string;
  code: number | null;
  short_code: string;
  logo: string;
  branding: Record<string, string>;
  is_partner: boolean;
  is_default: boolean;
  is_active: boolean;
  branch_count?: number;
}

export interface Branch {
  id: number;
  bank_id: number;
  name: string;
  code: number | null;
  is_active: boolean;
}

export type Settings = Record<string, unknown>;

/** query builds a query string, leaving out empty values. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

const a = "/v1/admin";

export function useAdminStats() {
  return useQuery({ queryKey: ["admin", "stats"], queryFn: () => api.get<AdminStats>(`${a}/stats`) });
}

export function useAdminGroups(params: { q?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: ["admin", "groups", params],
    queryFn: () => api.get<Paged<AdminGroup>>(`${a}/groups${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useSetGroupStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: GroupStatus }) => api.patch<unknown>(`${a}/groups/${id}`, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["group", id] });
    },
  });
}

export function useAdminUsers(params: { q?: string; role?: string; active?: string; page?: number }) {
  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => api.get<Paged<AdminUser>>(`${a}/users${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: number) {
  return useQuery({ queryKey: ["admin", "user", id], queryFn: () => api.get<AdminUser>(`${a}/users/${id}`) });
}

export interface AdminUserInput {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  phone?: string | null;
  email?: string | null;
  id_number?: string | null;
  is_active?: boolean;
  platform_roles?: PlatformRole[];
  password?: string;
}

export function useSaveUser(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminUserInput) =>
      id ? api.patch<AdminUser>(`${a}/users/${id}`, input) : api.post<AdminUser>(`${a}/users`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useSetPassword(id: number) {
  return useMutation({
    mutationFn: (input: { password: string; require_change: boolean }) => api.post<void>(`${a}/users/${id}/password`, input),
  });
}

export function useAdminTransactions(params: { group_id?: string; type?: string; from?: string; to?: string; include_voided?: boolean; page?: number }) {
  return useQuery({
    queryKey: ["admin", "transactions", params],
    queryFn: () => api.get<Paged<AdminTransaction>>(`${a}/transactions${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useAudit() {
  return useQuery({ queryKey: ["admin", "audit"], queryFn: () => api.get<AuditEntry[]>(`${a}/audit`) });
}

export function useSettings() {
  return useQuery({ queryKey: ["admin", "settings"], queryFn: () => api.get<Settings>(`${a}/settings`) });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: Settings) => api.patch<Settings>(`${a}/settings`, changes),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "settings"], data);
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}

// Reference data. Admin lists include inactive rows.

export function useCountries() {
  return useQuery({ queryKey: ["admin", "countries"], queryFn: () => api.get<Country[]>(`${a}/countries?all=true`) });
}

export function useCounties(countryId?: number) {
  return useQuery({
    queryKey: ["admin", "counties", countryId],
    queryFn: () => api.get<County[]>(`${a}/counties${query({ all: true, country_id: countryId })}`),
  });
}

export function useBanks(q = "") {
  return useQuery({
    queryKey: ["admin", "banks", q],
    queryFn: () => api.get<Bank[]>(`${a}/banks${query({ all: true, q })}`),
    placeholderData: keepPreviousData,
  });
}

export function useBranches(bankId: number) {
  return useQuery({
    queryKey: ["admin", "branches", bankId],
    queryFn: () => api.get<Branch[]>(`${a}/banks/${bankId}/branches?all=true`),
  });
}

/** useSaveRef creates (no id) or updates a reference row under /v1/admin. */
export function useSaveRef<T>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: number } & Record<string, unknown>) =>
      id ? api.patch<T>(`${a}/${path}/${id}`, body) : api.post<T>(`${a}/${path}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}
