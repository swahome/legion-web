import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { api } from "../../api/client";
import { typeLabel } from "./CashBookPage";
import { RecordDepositDialog } from "./DepositsPage";
import { monthsAgoISO, todayISO } from "./shared";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const account = (over: Record<string, unknown>) => ({
  kind: "bank",
  account_number: "",
  institution: null,
  branch: null,
  initial_balance: "0.00",
  balance: "0.00",
  is_default: false,
  is_verified: false,
  is_closed: false,
  ...over,
});

const routes: Record<string, unknown> = {
  "/v1/groups/15/accounts": {
    accounts: [
      account({ id: 1, name: "Old box", is_closed: true }),
      account({ id: 2, name: "Equity", is_default: true }),
      account({ id: 3, name: "M-Pesa till", kind: "mobile_money" }),
    ],
    unassigned: [],
    total_balance: "0.00",
  },
  "/v1/groups/15/members": {
    members: [{ id: 41, first_name: "Otieno", middle_name: "", last_name: "Ouma", membership_number: "J-2" }],
  },
  "/v1/groups/15/contributions": {
    contributions: [{ id: 9, name: "Monthly savings", schedule: { fines_enabled: true } }],
  },
  "/v1/groups/15/fine-categories": { categories: [{ id: 5, name: "Lateness", amount: "200.00", is_hidden: false, is_active: true }] },
  "/v1/groups/15/income-categories": { categories: [] },
  "/v1/groups/15/depositors": { depositors: [] },
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
        return json(201, { id: 77 });
      }
      if (path in routes) return json(200, routes[path]);
      return json(404, { error: { code: "not_found", message: path } });
    }),
  );
  return posted;
}

describe("record deposit", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to the default open account and posts a contribution payment", async () => {
    const posted = stub();
    await api.refresh();
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <RecordDepositDialog groupId={15} currency="KES" onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    const accountSelect = await screen.findByLabelText("Into account");
    await screen.findByRole("option", { name: "Equity" });
    expect(accountSelect).toHaveValue("2");
    expect(screen.queryByRole("option", { name: "Old box" })).toBeNull();

    await screen.findByRole("option", { name: "Otieno Ouma (No. J-2)" });
    await user.selectOptions(screen.getByLabelText("Member"), "41");
    await screen.findByRole("option", { name: "Monthly savings" });
    await user.selectOptions(screen.getByLabelText("Contribution"), "9");
    await user.type(screen.getByLabelText("Amount (KES)"), "1500.50");
    await user.selectOptions(screen.getByLabelText("Method"), "mpesa");
    await user.click(screen.getByRole("button", { name: "Record deposit" }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted).toEqual([
      {
        path: "/v1/groups/15/deposits",
        body: { kind: "contribution", account_id: 2, amount: "1500.50", date: todayISO(), method: "mpesa", member_id: 41, contribution_id: 9 },
      },
    ]);
  });

  it("sends a contribution's late fine as contribution_id", async () => {
    const posted = stub();
    await api.refresh();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <RecordDepositDialog groupId={15} currency="KES" onClose={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Payment for"), "fine");
    await screen.findByRole("option", { name: "Otieno Ouma (No. J-2)" });
    await user.selectOptions(screen.getByLabelText("Member"), "41");
    await screen.findByRole("option", { name: "Late payment: Monthly savings" });
    await user.selectOptions(screen.getByLabelText("Fine"), "contribution:9");
    await user.type(screen.getByLabelText("Amount (KES)"), "200");
    await user.click(screen.getByRole("button", { name: "Record deposit" }));
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.body).toMatchObject({ kind: "fine", contribution_id: 9, member_id: 41 });
    expect(posted[0]?.body).not.toHaveProperty("fine_category_id");
  });
});

describe("helpers", () => {
  it("names cash book rows", () => {
    expect(typeLabel("deposit.contribution")).toBe("Contribution payment");
    expect(typeLabel("withdrawal.expense")).toBe("Expense");
    expect(typeLabel("transfer.in")).toBe("Transfer in");
  });

  it("works out dates in Nairobi", () => {
    // 22:30 UTC on 31 Dec is already 1 Jan in Nairobi.
    const now = new Date("2026-12-31T22:30:00Z");
    expect(todayISO(now)).toBe("2027-01-01");
    expect(monthsAgoISO(3, now)).toBe("2026-10-01");
  });
});
