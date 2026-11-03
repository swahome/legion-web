import { Link } from "react-router";
import { useAdminRoles } from "../../api/admin";
import { ErrorState, PageHeader, Spinner } from "../../components/ui";
import { tbody, td, Th, theadRow } from "./widgets";

/**
 * AdminRolesPage lists the platform roles (the old panel's "user groups").
 * The roles are fixed in code; give or take one from a user's page.
 */
export function AdminRolesPage() {
  const roles = useAdminRoles();
  return (
    <>
      <PageHeader title="User roles" subtitle="What each platform role can do. Give or take a role from the user's own page." />
      {roles.isPending ? (
        <Spinner label="Loading roles" />
      ) : roles.isError ? (
        <ErrorState error={roles.error} onRetry={() => roles.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className={theadRow}>
                <Th>Role</Th>
                <Th>Description</Th>
                <Th right>Users</Th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {roles.data.map((r) => (
                <tr key={r.role}>
                  <td className={`${td} font-medium`}>{r.name}</td>
                  <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.description}</td>
                  <td className={`${td} text-right`}>
                    <Link to={`/admin/users?role=${r.role}`} className="tabular-nums hover:underline">
                      {r.users.toLocaleString()}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
