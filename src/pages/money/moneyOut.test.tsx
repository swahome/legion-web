import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { api } from "../../api/client";
import { RecordWithdrawalDialog } from "./WithdrawalsPage";
import { RequestDialog, recipientText } from "./WithdrawalRequestsPage";
import { todayISO } from "./shared";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const request = {
  id: 8,
  reference_number: "K7Q2M9XW3A",
  kind: "expense",
  status: "pending",
  amount: "1500.00",
  description: "Hall rent",
  account: { id: 2, name: "Equity" },
  to_account: null,
  expense_category: { id: 4, name: "Rent" },
  member: null,
  contribution: null,
  requested_by: { id: 40, name: "Jane Wanjiru" },
  recipient: { type: "mobile", phone: "0722000111" },
  approvals: 1,
  signatories: 2,
  decided_at: null,
  decline_reason: "",
  withdrawal_id: null,
  transfer_id: null,
  created_at: "2026-10-30T08:00:00Z",
  approval_list: [
    { member_id: 40, name: "Jane Wanjiru", role: "Treasurer", decision: "approved", decided_at: "2026-10-30T08:00:00Z", comment: "" },
    { member_id: 41, name: "Otieno Ouma", role: "Secretary", decision: "pending", decided_at: null, comment: "" },
  ],
  my_decision: "pending",
};

const routes: Record<string, unknown> = {
  "/v1/groups/15/accounts": {
    accounts: [
      { id: 1, kind: "bank", name: "Old", is_closed: true, is_default: false, balance: "0.00" },
      { id: 2, kind: "bank", name: "Equity", is_closed: false, is_default: true, balance: "5000.00" },
    ],
    unassigned: [],
    total_balance: "5000.00",
  },
  "/v1/groups/15/members": { members: [] },
  "/v1/groups/15/contributions": { contributions: [] },
  "/v1/groups/15/expense-categories": { categories: [{ id: 4, name: "Rent", is_hidden: false, is_active: true }] },
  "/v1/groups/15/withdrawal-requests/8": request,
};

function stub() {
  const posted: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, "http://x").pathname;
      if (path === "/v1/auth/refresh") return json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1 } });
      if (init?.method === "POST") {
        posted.push({ path, body: JSON.parse(String(init.body)) });
        if (path.endsWith("/approve")) return json(200, { ...request, status: "approved", approvals: 2, my_decision: "approved" });
        return json(201, { id: 77 });
      }
      if (path in routes) return json(200, routes[path]);
      return json(404, { error: { code: "not_found", message: path } });
    }),
  );
  return posted;
}

function wrap(children: ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("money out", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("records an expense from the default account", async () => {
    const posted = stub();
    await api.refresh();
    const onClose = vi.fn();
    render(wrap(<RecordWithdrawalDialog groupId={15} currency="KES" onClose={onClose} />));
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "Equity (KES 5,000.00)" });
    expect(screen.queryByRole("option", { name: /^Old/ })).toBeNull();
    await screen.findByRole("option", { name: "Rent" });
    await user.selectOptions(screen.getByLabelText("Expense category"), "4");
    await user.type(screen.getByLabelText("Amount (KES)"), "1200");
    await user.click(screen.getByRole("button", { name: "Record withdrawal" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted).toEqual([
      { path: "/v1/groups/15/withdrawals", body: { kind: "expense", account_id: 2, amount: "1200", date: todayISO(), expense_category_id: 4 } },
    ]);
  });

  it("lets a signatory approve with their password", async () => {
    const posted = stub();
    await api.refresh();
    render(wrap(<RequestDialog groupId={15} id={8} currency="KES" managing={false} onClose={() => {}} />));
    const user = userEvent.setup();
    expect(await screen.findByText("Mobile money 0722000111")).toBeInTheDocument();
    expect(screen.getByText("Signatories (1 of 2 approved)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    await user.type(screen.getByLabelText("Your password"), "secret");
    await user.click(approve);
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({ path: "/v1/groups/15/withdrawal-requests/8/approve", body: { password: "secret" } });
  });

  it("describes recipients", () => {
    expect(recipientText({ type: "paybill", paybill: "888880", account_number: "J-2" })).toBe("Paybill 888880, account J-2");
    expect(recipientText({ type: "bank", bank_id: 1, account_number: "0123", account_name: "Jirani" })).toBe("Bank account 0123 (Jirani)");
  });
});
