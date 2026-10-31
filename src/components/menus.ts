import { ArrowDownToLine, Banknote, FileSignature, Percent, ArrowLeftRight, ArrowUpFromLine, BookOpen, ClipboardCheck, FileText, Gavel, HandCoins, Landmark, LayoutDashboard, ShieldCheck, Tags, Users } from "lucide-react";
import type { Group } from "../api/types";
import type { Section } from "./AppShell";
import type { NavItem } from "./Shell";

/**
 * Group menus are fixed in code. Platform admins can switch items off
 * (the menus.disabled setting); the overview can't be switched off.
 */
export interface MenuDef {
  id: string;
  section: Section;
  path: string;
  label: string;
  icon: NavItem["icon"];
  /** Only shown when the viewer is a member of the group. */
  needsMembership?: boolean;
  /** Only shown to signatories (members who answer withdrawal requests). */
  needsSignatory?: boolean;
  locked?: boolean;
}

export const groupMenus: MenuDef[] = [
  { id: "group.overview", section: "group", path: "", label: "Overview", icon: LayoutDashboard, locked: true },
  { id: "group.statement", section: "group", path: "statement", label: "My statement", icon: FileText, needsMembership: true },
  { id: "group.contributions", section: "group", path: "contributions", label: "Contributions", icon: HandCoins },
  { id: "group.members", section: "group", path: "members", label: "Members", icon: Users },
  { id: "group.arrears", section: "group", path: "arrears", label: "Arrears", icon: ShieldCheck },
  { id: "group.fines", section: "group", path: "fines", label: "Fines", icon: Gavel },
  { id: "group.loans", section: "group", path: "loans", label: "Loans", icon: Banknote },
  { id: "group.loan_applications", section: "group", path: "loan-applications", label: "Loan applications", icon: FileSignature },
  { id: "group.loan_types", section: "group", path: "loan-types", label: "Loan types", icon: Percent },
  { id: "group.deposits", section: "group", path: "deposits", label: "Deposits", icon: ArrowDownToLine },
  { id: "group.withdrawals", section: "group", path: "withdrawals", label: "Withdrawals", icon: ArrowUpFromLine },
  { id: "group.withdrawal_requests", section: "group", path: "withdrawal-requests", label: "Withdrawal requests", icon: ClipboardCheck },
  { id: "group.transfers", section: "group", path: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { id: "group.accounts", section: "group", path: "accounts", label: "Accounts", icon: Landmark },
  { id: "group.cash_book", section: "group", path: "cash-book", label: "Cash book", icon: BookOpen },
  { id: "group.categories", section: "group", path: "categories", label: "Categories", icon: Tags },
  { id: "member.overview", section: "member", path: "", label: "Overview", icon: LayoutDashboard, locked: true },
  { id: "member.statement", section: "member", path: "statement", label: "My statement", icon: FileText, needsMembership: true },
  { id: "member.contributions", section: "member", path: "contributions", label: "Contributions", icon: HandCoins },
  { id: "member.members", section: "member", path: "members", label: "Members", icon: Users },
  { id: "member.fines", section: "member", path: "fines", label: "My fines", icon: Gavel, needsMembership: true },
  { id: "member.loans", section: "member", path: "loans", label: "My loans", icon: Banknote, needsMembership: true },
  { id: "member.loan_applications", section: "member", path: "loan-applications", label: "Loan applications", icon: FileSignature, needsMembership: true },
  { id: "member.withdrawal_requests", section: "member", path: "withdrawal-requests", label: "Approvals", icon: ClipboardCheck, needsSignatory: true },
];

export function menuNav(section: Section, base: string, g: Group, disabled: string[]): NavItem[] {
  return groupMenus
    .filter((m) => m.section === section && (m.locked || !disabled.includes(m.id)))
    .filter((m) => !m.needsMembership || g.my_membership_id != null)
    .filter((m) => !m.needsSignatory || !!g.is_signatory)
    .map((m) => ({ to: m.path ? `${base}/${m.path}` : base, label: m.label, icon: m.icon, end: !m.path }));
}

/** isMenuOff tells a page whether its menu item was switched off. */
export function isMenuOff(section: Section, path: string, disabled: string[]): boolean {
  const m = groupMenus.find((x) => x.section === section && x.path === path);
  return !!m && !m.locked && disabled.includes(m.id);
}
