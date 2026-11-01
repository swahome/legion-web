import { Link, Navigate, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useCreateGroup } from "../../api/account";
import { useMe } from "../../api/hooks";
import { ErrorState, Spinner } from "../../components/ui";
import { GroupDetailsForm } from "./GroupDetailsForm";

/** CreateGroupPage starts a group in setup, with the caller as Chair Person. */
export function CreateGroupPage() {
  const me = useMe();
  const create = useCreateGroup();
  const navigate = useNavigate();

  if (me.isPending) return <Spinner label="Loading" />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  if (!me.data.user.phone_verified) return <Navigate to="/verify-phone" state={{ next: "/groups/new" }} replace />;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Link to="/groups" className="btn-ghost -ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden /> Your groups
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Create a group</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        You'll be the group's Chair Person. Next you'll add members, contributions, accounts and loan types. Nobody is texted until you finish setting up.
      </p>
      <div className="card p-5">
        <GroupDetailsForm
          busy={create.isPending}
          error={create.error}
          submitLabel="Create group"
          onSubmit={(input) => create.mutate(input, { onSuccess: (r) => navigate(`/group/${r.group.id}/setup`) })}
        />
      </div>
    </div>
  );
}
