import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/ui";
import { ArrearsPage } from "./pages/ArrearsPage";
import { ContributionPage } from "./pages/ContributionPage";
import { ContributionsPage } from "./pages/ContributionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GroupPickerPage } from "./pages/GroupPickerPage";
import { LoginPage } from "./pages/LoginPage";
import { MemberPage, MyStatementPage } from "./pages/MemberPage";
import { MembersPage } from "./pages/MembersPage";
import { LoanApplicationsPage } from "./pages/loans/LoanApplicationsPage";
import { LoanPage } from "./pages/loans/LoanPage";
import { LoansPage } from "./pages/loans/LoansPage";
import { LoanTypesPage } from "./pages/loans/LoanTypesPage";
import { AccountsPage } from "./pages/money/AccountsPage";
import { CashBookPage } from "./pages/money/CashBookPage";
import { CategoriesPage } from "./pages/money/CategoriesPage";
import { DepositsPage } from "./pages/money/DepositsPage";
import { FinesPage } from "./pages/money/FinesPage";
import { TransfersPage } from "./pages/money/TransfersPage";
import { WithdrawalRequestsPage } from "./pages/money/WithdrawalRequestsPage";
import { WithdrawalsPage } from "./pages/money/WithdrawalsPage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";
import { AdminJobsPage } from "./pages/admin/AdminJobsPage";
import { AdminBankPage, AdminBanksPage } from "./pages/admin/AdminBanksPage";
import { AdminGroupsPage } from "./pages/admin/AdminGroupsPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminPlacesPage } from "./pages/admin/AdminPlacesPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminShell } from "./pages/admin/AdminShell";
import { AdminTransactionsPage } from "./pages/admin/AdminTransactionsPage";
import { AdminUserPage } from "./pages/admin/AdminUserPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><GroupPickerPage autoEnter /></RequireAuth>} />
      <Route path="/groups" element={<RequireAuth><GroupPickerPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth><AdminShell /></RequireAuth>}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="groups" element={<AdminGroupsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:userId" element={<AdminUserPage />} />
        <Route path="transactions" element={<AdminTransactionsPage />} />
        <Route path="banks" element={<AdminBanksPage />} />
        <Route path="banks/:bankId" element={<AdminBankPage />} />
        <Route path="places" element={<AdminPlacesPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="jobs" element={<AdminJobsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/group/:groupId" element={<RequireAuth><AppShell section="group" /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="statement" element={<MyStatementPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/:memberId" element={<MemberPage />} />
        <Route path="contributions" element={<ContributionsPage />} />
        <Route path="contributions/:contributionId" element={<ContributionPage />} />
        <Route path="arrears" element={<ArrearsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="cash-book" element={<CashBookPage />} />
        <Route path="deposits" element={<DepositsPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route path="withdrawal-requests" element={<WithdrawalRequestsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="fines" element={<FinesPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/:loanId" element={<LoanPage />} />
        <Route path="loan-applications" element={<LoanApplicationsPage />} />
        <Route path="loan-types" element={<LoanTypesPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/member/:groupId" element={<RequireAuth><AppShell section="member" /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="statement" element={<MyStatementPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/:memberId" element={<MemberPage />} />
        <Route path="contributions" element={<ContributionsPage />} />
        <Route path="contributions/:contributionId" element={<ContributionPage />} />
        <Route path="withdrawal-requests" element={<WithdrawalRequestsPage />} />
        <Route path="fines" element={<FinesPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/:loanId" element={<LoanPage />} />
        <Route path="loan-applications" element={<LoanApplicationsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* Links from before the sections split. AppShell moves members on to /member. */}
      <Route path="/g/:groupId/*" element={<OldGroupLink />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** RequireAuth waits for the session restore, then sends signed-out users to /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Spinner label="Signing you in" />;
  if (status === "signed-out") {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return children;
}

function OldGroupLink() {
  const { groupId, "*": rest } = useParams();
  return <Navigate to={`/group/${groupId}${rest ? `/${rest}` : ""}`} replace />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you were looking for doesn't exist or has moved.</p>
      <Link to="/" className="btn-primary mt-6">
        Back to Legion
      </Link>
    </div>
  );
}
