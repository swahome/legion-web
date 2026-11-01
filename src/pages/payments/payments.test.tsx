import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { api } from "../../api/client";
import type { OwedItem } from "../../api/payments";
import { PayPage, linesFor } from "./PayPage";
import { ReconciliationPage, toLine } from "./ReconciliationPage";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const group = { id: 15, name: "Jirani", currency: "KES", my_membership_id: 41, is_official: true, platform_admin: false, summary: {} };
const owed: OwedItem[] = [
  { kind: "contribution", contribution_id: 9, name: "Monthly savings", owed: "800.00", since: "2026-10-05" },
  { kind: "fine", fine_category_id: 3, name: "Lateness", owed: "200.00" },
];

function stub(routes: Record<string, unknown>, onPost?: (path: string, body: unknown) => unknown) {
  const posted: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, "http://x").pathname;
      if (path === "/v1/auth/refresh") return json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1 } });
      if (init?.method === "POST" || init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        posted.push({ path, body });
        return json(init.method === "POST" ? 201 : 200, onPost?.(path, body) ?? {});
      }
      if (path in routes) return json(200, routes[path]);
      return json(404, { error: { code: "not_found", message: path } });
    }),
  );
  return posted;
}

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/member/:groupId/pay" element={element} />
          <Route path="/group/:groupId/reconciliation" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const empty = { items: [], total: 0, page: 1, page_size: 50 };

describe("payments", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns typed amounts into payment lines", () => {
    expect(linesFor(owed, { "contribution-9--": "500", "fine--3-": "abc" })).toEqual([{ kind: "contribution", amount: "500", contribution_id: 9 }]);
  });

  it("builds reconcile lines and refuses incomplete ones", () => {
    const base = { amount: "100", member_id: "41", item: "", depositor_id: "", description: "" };
    expect(toLine({ ...base, kind: "fine", item: "c-9" })).toEqual({ kind: "fine", amount: "100", member_id: 41, contribution_id: 9 });
    expect(toLine({ ...base, kind: "fine", item: "f-3" })).toEqual({ kind: "fine", amount: "100", member_id: 41, fine_category_id: 3 });
    expect(toLine({ ...base, kind: "contribution" })).toBeNull();
    expect(toLine({ ...base, kind: "misc", member_id: "" })).toBeNull();
    expect(toLine({ ...base, kind: "expense", member_id: "", item: "7" })).toEqual({ kind: "expense", amount: "100", expense_category_id: 7 });
  });

  it("sends an MPesa prompt for the chosen items and shows the result", async () => {
    const payment = { id: 5, status: "paid", amount: "1000.00", phone: "+254711222333", receipt: "QJK1", lines: [], message: "", created_at: "" };
    const posted = stub(
      {
        "/v1/groups/15/": group,
        "/v1/groups/15/pay/options": { enabled: true, account: { id: 1, account_number: "0110" }, phone: "+254711222333", owed, contributions: [], currency: "KES" },
        "/v1/groups/15/payments": empty,
        "/v1/groups/15/payments/5": payment,
      },
      () => ({ ...payment, status: "sent" }),
    );
    await api.refresh();
    renderAt("/member/15/pay", <PayPage />);
    const user = userEvent.setup();
    expect(await screen.findByLabelText("Amount for Monthly savings")).toHaveValue("800.00");
    await user.click(screen.getByRole("button", { name: /Send MPesa prompt/ }));
    expect(await screen.findByText("Payment received")).toBeInTheDocument();
    expect(posted).toEqual([
      {
        path: "/v1/groups/15/payments",
        body: {
          phone: "+254711222333",
          lines: [
            { kind: "contribution", amount: "800.00", contribution_id: 9 },
            { kind: "fine", amount: "200.00", fine_category_id: 3 },
          ],
        },
      },
    ]);
  });

  it("reconciles a bank deposit from the suggestion", async () => {
    const alert = {
      id: 7, source: "equity", provider_ref: "EQ1", bank: null, account_number: "0110", group: { id: 15, name: "Jirani" },
      account: { id: 1, name: "Equity main" }, direction: "in", amount: "1000.00", currency: "KES", transaction_at: "2026-10-20T07:15:00Z",
      reference: "", particulars: "CASH DEP 0711222333", phone: null, payer_name: "", status: "unreconciled", auto_reconciled: false,
      reconciled_at: null, note: "", created_at: "",
    };
    const posted = stub(
      {
        "/v1/groups/15/": group,
        "/v1/groups/15/transaction-alerts": { ...empty, items: [alert], total: 1 },
        "/v1/groups/15/transaction-alerts/summary": { in: { count: 1, amount: "1000.00" }, out: { count: 0, amount: "0.00" } },
        "/v1/groups/15/reconciliation-settings": { auto_reconcile_payments: true, auto_reconcile_bank_alerts: false },
        "/v1/groups/15/transaction-alerts/7": {
          ...alert, reconciled_by: "", deposits: [], withdrawals: [],
          suggestion: { member_id: 41, lines: [{ kind: "contribution", member_id: 41, contribution_id: 9, amount: "1000.00" }] },
        },
        "/v1/groups/15/members": { members: [{ id: 41, first_name: "Otieno", last_name: "Ouma", status: "active" }] },
        "/v1/groups/15/contributions": { contributions: [{ id: 9, name: "Monthly savings" }] },
        "/v1/groups/15/fine-categories": { categories: [] },
        "/v1/groups/15/income-categories": { categories: [] },
        "/v1/groups/15/expense-categories": { categories: [] },
        "/v1/groups/15/depositors": { depositors: [] },
        "/v1/groups/15/loans": { loans: empty },
      },
      (path) => (path.endsWith("/reconcile") ? { ...alert, status: "reconciled", reconciled_by: "Jane", deposits: [], withdrawals: [], suggestion: null } : {}),
    );
    await api.refresh();
    renderAt("/group/15/reconciliation", <ReconciliationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "CASH DEP 0711222333" }));
    await screen.findByRole("option", { name: "Monthly savings" });
    expect(screen.getByText("Adds up")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save to the books" }));
    await vi.waitFor(() => expect(posted.map((p) => p.path)).toContain("/v1/groups/15/transaction-alerts/7/reconcile"));
    expect(posted.find((p) => p.path.endsWith("/reconcile"))?.body).toEqual({
      lines: [{ kind: "contribution", amount: "1000.00", member_id: 41, contribution_id: 9 }],
    });
  });
});
