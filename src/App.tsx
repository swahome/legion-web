import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
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

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><GroupPickerPage autoEnter /></RequireAuth>} />
      <Route path="/groups" element={<RequireAuth><GroupPickerPage /></RequireAuth>} />
      <Route path="/g/:groupId" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="statement" element={<MyStatementPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/:memberId" element={<MemberPage />} />
        <Route path="contributions" element={<ContributionsPage />} />
        <Route path="contributions/:contributionId" element={<ContributionPage />} />
        <Route path="arrears" element={<ArrearsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
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
