// Shapes returned by legion-api. Money is a two-decimal string ("4200.00"),
// dates are "YYYY-MM-DD" strings, timestamps are ISO strings.

export type Money = string;

export interface User {
  id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  last_login_at: string | null;
}

export interface Session {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: User;
}

export interface Membership {
  membership_id: number;
  group_id: number;
  group_name: string;
  group_slug: string;
  group_status: string;
  currency: string;
  is_official: boolean;
  role_name: string | null;
  status: string;
}

export interface Me {
  user: User;
  platform_roles: string[];
  memberships: Membership[];
}

export interface Group {
  id: number;
  name: string;
  slug: string;
  status: string;
  currency: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  my_membership_id: number | null;
  is_official: boolean;
  platform_admin: boolean;
  summary: {
    active_members: number;
    officials: number;
    active_contributions: number;
    total_contributions_paid: Money;
  };
}

export interface Role {
  id: number;
  name: string;
  description: string;
}

export type MembershipStatus = "active" | "suspended" | "removed";

export interface Member {
  id: number;
  user_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  is_official: boolean;
  role_id: number | null;
  role_name: string | null;
  membership_number: string | null;
  status: MembershipStatus;
  joined_at: string;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  physical_address?: string | null;
  postal_address?: string | null;
}

export type ContributionKind = "regular" | "one_time" | "non_scheduled";
export type ContributionCategory =
  | "share_capital"
  | "savings"
  | "welfare"
  | "membership_fee"
  | "investment"
  | "other";
export type Frequency =
  | "daily"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "twice_monthly"
  | "bimonthly"
  | "quarterly"
  | "biannually"
  | "annually";

export interface Schedule {
  frequency: Frequency | null;
  invoice_date: string | null;
  contribution_date: string | null;
  invoice_days_before?: number | null;
  invoicing_active: boolean | null;
  sms_notifications?: boolean;
  email_notifications?: boolean;
  fines_enabled: boolean | null;
  rule?: Record<string, string>;
}

export interface FineRule {
  id: number;
  kind: "fixed" | "percentage";
  fixed_amount: Money | null;
  percentage_rate: string | null;
  percentage_of: string | null;
  chargeable_on: string;
  mode: string | null;
  frequency: string | null;
  fine_limit: number | null;
  is_active: boolean;
}

export interface Contribution {
  id: number;
  name: string;
  kind: ContributionKind;
  category: ContributionCategory | null;
  amount: Money;
  is_active: boolean;
  is_hidden: boolean;
  is_closed: boolean;
  applies_to_all_members: boolean;
  schedule: Schedule | null;
  is_non_refundable?: boolean;
  is_equity?: boolean;
  member_ids?: number[];
  fine_rules?: FineRule[];
}

export interface StatementEntry {
  id: number;
  date: string;
  type: string;
  label: string;
  contribution_id: number | null;
  contribution_name: string | null;
  description: string;
  debit: Money | null;
  credit: Money | null;
  balance: Money;
  is_backdated: boolean;
  due_date?: string;
}

export interface ContributionTotals {
  contribution_id: number | null;
  contribution_name: string | null;
  payable: Money;
  paid: Money;
  balance: Money;
}

export interface Statement {
  member: Member;
  currency: string;
  from: string | null;
  to: string | null;
  opening_balance: Money;
  closing_balance: Money;
  entries: StatementEntry[];
  totals: ContributionTotals[];
}

export interface MemberBalance {
  membership_id: number;
  first_name: string;
  last_name: string;
  membership_number: string | null;
  payable: Money;
  paid: Money;
  balance: Money;
}
