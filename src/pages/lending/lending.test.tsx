import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { api } from "../../api/client";
import { borrowerName } from "../../api/loans";
import { RecordLoanDialog } from "../loans/LoansPage";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const tradeCredit = {
  id: 9, name: "TRADE CREDIT", interest_type: "fixed_balance", interest_rate: 5, rate_per: "term", reducing_method: "equal_installments",
  fixed_interest: "0.00", fixed_interest_rate: 0, frequency: "monthly", fixed_term: 2, min_term: null, max_term: null, grace_periods: 1,
  amount_basis: "range", min_amount: "1000.00", max_amount: "20000.00", savings_multiple: null, guarantors: "none", min_guarantors: null,
  max_guarantors: null, late_fine: null, balance_fine: null, processing_fee: null, fine_deferment: false, needs_approval: true, is_hidden: false,
  for_debtors: true,
};

const schedule = {
  amount: "10000.00", interest: "500.00", total: "10500.00", processing_fee: "0.00", ends_on: "2027-01-31",
  installments: [1, 2].map((n) => ({ number: n, due_on: `2026-1${n}-30`, principal: "5000.00", interest: "250.00", amount: "5250.00" })),
};

function stub() {
  const calls: { path: string; search: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url, "http://x");
      const path = u.pathname;
      if (path === "/v1/auth/refresh") return json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1 } });
      calls.push({ path, search: u.search, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      if (path === "/v1/groups/15/loans/preview") return json(200, schedule);
      if (init?.method === "POST") return json(201, { id: 31 });
      if (path === "/v1/groups/15/loan-types") return json(200, { loan_types: [tradeCredit] });
      if (path === "/v1/groups/15/members") return json(200, { members: [] });
      if (path === "/v1/groups/15/accounts") return json(200, { accounts: [{ id: 3, name: "Equity", kind: "bank", is_closed: false }] });
      return json(404, { error: { code: "not_found", message: path } });
    }),
  );
  return calls;
}

function wrap(children: ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("lending to debtors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("records a loan to a debtor with the debtor loan types", async () => {
    const calls = stub();
    await api.refresh();
    const onClose = vi.fn();
    render(wrap(<RecordLoanDialog groupId={15} currency="KES" debtor={{ id: 4, name: "Jo Traders" }} onClose={onClose} />));
    const user = userEvent.setup();
    expect(screen.getByRole("heading", { name: "Lend to Jo Traders" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Member")).toBeNull();
    await screen.findByRole("option", { name: "TRADE CREDIT" });
    expect(calls.find((c) => c.path === "/v1/groups/15/loan-types")?.search).toContain("for=debtors");
    await user.selectOptions(screen.getByLabelText("Loan type"), "9");
    await user.type(screen.getByLabelText("Amount (KES)"), "10000");
    await screen.findByRole("option", { name: "Equity" });
    await user.selectOptions(screen.getByLabelText("Paid from"), "3");
    expect(await screen.findByText("KES 10,500.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record loan" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const preview = calls.filter((c) => c.path === "/v1/groups/15/loans/preview").pop();
    expect(preview?.body).toMatchObject({ debtor_id: 4, loan_type_id: 9, amount: "10000", installments: 2 });
    const post = calls.find((c) => c.path === "/v1/groups/15/loans");
    expect(post?.body).toMatchObject({ debtor_id: 4, loan_type_id: 9, account_id: 3, amount: "10000", installments: 2 });
    expect(post?.body).not.toHaveProperty("member_id");
  });

  it("names a loan's borrower", () => {
    expect(borrowerName({ member: { id: 1, name: "Jane" }, debtor: null })).toBe("Jane");
    expect(borrowerName({ member: null, debtor: { id: 2, name: "Jo Traders" } })).toBe("Jo Traders");
  });
});
