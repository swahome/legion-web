import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, CheckCircle2, Circle, PartyPopper, Send, UserPlus } from "lucide-react";
import { useCompleteSetup, useSetup, useUpdateGroup, type SetupStepKey } from "../../api/account";
import { useMembers } from "../../api/hooks";
import { useGroupBase, useGroupId } from "../../components/AppShell";
import { Badge, ErrorState, InlineError, PageHeader, Spinner, cx } from "../../components/ui";
import { fullName } from "../../lib/format";
import { AddMemberDialog } from "../MembersPage";
import { GroupDetailsForm } from "./GroupDetailsForm";

type StepKey = SetupStepKey | "review";

const stepInfo: Record<StepKey, { title: string; blurb: string }> = {
  details: { title: "Group details", blurb: "Name, kind of group, country and currency." },
  members: { title: "Members and offices", blurb: "Add members by phone and give officials their offices." },
  contributions: { title: "Contributions", blurb: "What members pay, how much and how often." },
  fines: { title: "Fines", blurb: "Late-payment fines on contributions." },
  accounts: { title: "Accounts", blurb: "Where the group keeps its money." },
  loan_types: { title: "Loan types", blurb: "The loans members can apply for. Optional." },
  review: { title: "Review and finish", blurb: "Check everything, then make the group live." },
};

const order: StepKey[] = ["details", "members", "contributions", "fines", "accounts", "loan_types", "review"];

/**
 * SetupPage is the new-group wizard. Each step saves as it goes; nothing is
 * texted until the last step makes the group live and invites the members.
 */
export function SetupPage() {
  const groupId = useGroupId();
  const base = useGroupBase();
  const setup = useSetup(groupId);
  const [open, setOpen] = useState<StepKey>("details");

  if (setup.isPending) return <Spinner label="Loading setup" />;
  if (setup.isError) return <ErrorState error={setup.error} onRetry={() => setup.refetch()} />;
  const s = setup.data;
  const live = s.group.status !== "setup";
  const step = (k: SetupStepKey) => s.steps.find((x) => x.key === k) ?? { key: k, done: false, count: 0 };
  const next = (k: StepKey) => setOpen(order[Math.min(order.indexOf(k) + 1, order.length - 1)]!);

  if (live) {
    return (
      <>
        <PageHeader title="Group setup" />
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <PartyPopper className="size-10 text-brand-600" aria-hidden />
          <h2 className="text-lg font-semibold">{s.group.name} is live</h2>
          <p className="max-w-md text-sm text-slate-500">Members have been texted their invites. You can change anything from the menu.</p>
          <Link to={base} className="btn-primary mt-2">
            Go to the dashboard <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Set up ${s.group.name}`} subtitle="Work through the steps in any order. Everything saves as you go, and nobody is texted until you finish." />
      <ol className="space-y-3">
        {order.map((k, i) => {
          const done = k === "review" ? false : step(k).done;
          return (
            <li key={k} className="card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                aria-expanded={open === k}
                onClick={() => setOpen(k)}
              >
                <span
                  className={cx(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    done ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                  )}
                >
                  {done ? <Check className="size-4" aria-label="Done" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{stepInfo[k].title}</span>
                  <span className="block text-sm text-slate-500">{stepInfo[k].blurb}</span>
                </span>
                {k !== "review" && k !== "details" && <Badge tone={done ? "brand" : "neutral"}>{step(k).count}</Badge>}
              </button>
              {open === k && (
                <div className="border-t border-slate-200 px-5 py-5 dark:border-slate-800">
                  <StepBody k={k} groupId={groupId} base={base} onNext={() => next(k)} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function StepBody({ k, groupId, base, onNext }: { k: StepKey; groupId: number; base: string; onNext: () => void }) {
  switch (k) {
    case "details":
      return <DetailsStep groupId={groupId} onNext={onNext} />;
    case "members":
      return <MembersStep groupId={groupId} onNext={onNext} />;
    case "contributions":
      return (
        <LinkStep to={`${base}/contributions`} label="Open contributions" onNext={onNext}>
          Add each contribution with its amount and schedule, like a monthly saving due on the 5th. Pick which members pay it if it isn't everyone.
        </LinkStep>
      );
    case "fines":
      return (
        <LinkStep to={`${base}/contributions`} label="Open contributions" onNext={onNext}>
          Late-payment fines belong to a regular contribution: open the contribution and add its fine rules, a fixed amount or a percentage of what's unpaid. Other fines, like lateness to meetings, use the fine categories, which come filled in.
        </LinkStep>
      );
    case "accounts":
      return (
        <LinkStep to={`${base}/accounts`} label="Open accounts" onNext={onNext}>
          The group starts with a petty cash account, "Cash at Hand". Add the group's bank, sacco and mobile money accounts so deposits and withdrawals can be recorded against them.
        </LinkStep>
      );
    case "loan_types":
      return (
        <LinkStep to={`${base}/loan-types`} label="Open loan types" onNext={onNext}>
          If the group lends to members, add its loan types: interest, repayment period, guarantors and fines. You can skip this and add them later.
        </LinkStep>
      );
    case "review":
      return <ReviewStep groupId={groupId} />;
  }
}

function DetailsStep({ groupId, onNext }: { groupId: number; onNext: () => void }) {
  const setup = useSetup(groupId);
  const update = useUpdateGroup(groupId);
  if (!setup.data) return null;
  return (
    <GroupDetailsForm
      initial={setup.data.group}
      busy={update.isPending}
      error={update.error}
      submitLabel="Save and continue"
      onSubmit={(input) =>
        update.mutate(input, {
          onSuccess: () => {
            setup.refetch();
            onNext();
          },
        })
      }
    />
  );
}

function MembersStep({ groupId, onNext }: { groupId: number; onNext: () => void }) {
  const members = useMembers(groupId);
  const setup = useSetup(groupId);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      {members.isPending ? (
        <Spinner label="Loading members" />
      ) : members.isError ? (
        <InlineError error={members.error} />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {members.data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 font-medium">{fullName(m)}</span>
              {m.phone && <span className="text-slate-500">{m.phone}</span>}
              {m.role_name ? <Badge tone="brand">{m.role_name}</Badge> : m.is_official && <Badge tone="brand">Official</Badge>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-slate-500">
        To change someone's office, open them from <span className="font-medium">Members</span> in the menu.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
          <UserPlus className="size-4" aria-hidden /> Add member
        </button>
        <button type="button" className="btn-primary" onClick={onNext}>
          Continue
        </button>
      </div>
      <AddMemberDialog groupId={groupId} open={adding} onClose={() => setAdding(false)} onAdded={() => setup.refetch()} />
    </div>
  );
}

function LinkStep({ to, label, onNext, children }: { to: string; label: string; onNext: () => void; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">{children}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Link to={to} className="btn-secondary">
          {label} <ArrowRight className="size-4" aria-hidden />
        </Link>
        <button type="button" className="btn-primary" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  );
}

const reviewLines: { key: SetupStepKey; one: string; many: string; required?: boolean }[] = [
  { key: "members", one: "member", many: "members", required: true },
  { key: "contributions", one: "contribution", many: "contributions" },
  { key: "fines", one: "late-payment fine rule", many: "late-payment fine rules" },
  { key: "accounts", one: "bank, sacco or mobile money account", many: "bank, sacco or mobile money accounts" },
  { key: "loan_types", one: "loan type", many: "loan types" },
];

function ReviewStep({ groupId }: { groupId: number }) {
  const setup = useSetup(groupId);
  const complete = useCompleteSetup(groupId);
  if (!setup.data) return null;
  const s = setup.data;
  const g = s.group;
  const count = (k: SetupStepKey) => s.steps.find((x) => x.key === k)?.count ?? 0;
  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Group</dt>
          <dd className="font-medium">{g.name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Kind</dt>
          <dd className="font-medium">{g.type_name ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Country and currency</dt>
          <dd className="font-medium">
            {g.country_code} · {g.currency}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Contacts</dt>
          <dd className="font-medium">{[g.phone, g.email].filter(Boolean).join(" · ") || "None"}</dd>
        </div>
      </dl>
      <ul className="space-y-2 text-sm">
        {reviewLines.map((l) => {
          const n = count(l.key);
          return (
            <li key={l.key} className="flex items-center gap-2">
              {n > 0 ? <CheckCircle2 className="size-4 text-brand-600" aria-hidden /> : <Circle className="size-4 text-slate-300" aria-hidden />}
              <span>
                {n} {n === 1 ? l.one : l.many}
                {n === 0 && !l.required && <span className="text-slate-500"> (you can add these later)</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        Finishing makes the group live. {s.members_to_invite === 0 ? "There's nobody to text yet: members you add later are texted when you add them." : `${s.members_to_invite} ${s.members_to_invite === 1 ? "member gets" : "members get"} an SMS invite with a link to set their password.`} Contribution invoices and fines start once the group is live. The country and currency can't change after this.
      </p>
      <InlineError error={complete.error} />
      <div className="flex justify-end">
        <button type="button" className="btn-primary" disabled={complete.isPending} onClick={() => complete.mutate(undefined, { onSuccess: () => setup.refetch() })}>
          <Send className="size-4" aria-hidden /> {complete.isPending ? "Finishing…" : s.members_to_invite > 0 ? "Finish and text invites" : "Finish setup"}
        </button>
      </div>
    </div>
  );
}
