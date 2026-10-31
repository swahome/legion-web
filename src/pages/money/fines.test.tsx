import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { api } from "../../api/client";
import type { Fine } from "../../api/fines";
import { FineMembersDialog, fineDetail, fineFor } from "./FinesPage";
import { describeFineRule, describeRule, fromDraft, newDraft } from "../ContributionRules";
import { summaryText } from "../admin/AdminJobsPage";
import { todayISO } from "./shared";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const routes: Record<string, unknown> = {
  "/v1/groups/15/members": {
    members: [
      { id: 40, first_name: "Jane", last_name: "Wanjiru", status: "active" },
      { id: 41, first_name: "Otieno", last_name: "Ouma", status: "active" },
    ],
  },
  "/v1/groups/15/fine-categories": { categories: [{ id: 3, name: "Lateness", amount: "200.00", is_hidden: false, is_active: true }] },
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
        return json(201, { fine_ids: [1, 2] });
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

describe("fines", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fines several members with the category's amount", async () => {
    const posted = stub();
    await api.refresh();
    const onClose = vi.fn();
    render(wrap(<FineMembersDialog groupId={15} currency="KES" onClose={onClose} />));
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "Lateness" });
    await user.selectOptions(screen.getByLabelText("Fine for"), "3");
    expect(screen.getByLabelText("Amount (KES)")).toHaveValue("200.00");
    await screen.findByText("Otieno Ouma");
    await user.click(screen.getByRole("button", { name: "Choose all" }));
    await user.click(screen.getByRole("button", { name: "Fine 2 members" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted).toEqual([
      { path: "/v1/groups/15/fines", body: { member_ids: [40, 41], fine_category_id: 3, amount: "200.00", date: todayISO() } },
    ]);
  });

  it("describes fines", () => {
    const base: Fine = {
      id: 1, kind: "contribution_fine", member: { id: 41, name: "Otieno Ouma" }, amount: "100.00", date: "2026-11-06",
      description: "Late payment fine: Welfare", fine_category: null, contribution: { id: 9, name: "Welfare" },
      invoice_due_date: "2026-11-05", automatic: true, created_at: "", voided_at: null,
    };
    expect(fineFor(base)).toBe("Late payment: Welfare");
    expect(fineDetail(base)).toBe("invoice due 5 Nov 2026 · charged automatically");
    expect(fineFor({ ...base, kind: "fine", fine_category: { id: 3, name: "Lateness" } })).toBe("Lateness");
  });

  it("describes schedules and fine rules", () => {
    expect(describeRule("monthly", { month_day_monthly: "5" })).toBe("The 5th of the month");
    expect(describeRule("monthly", { month_day_monthly: "2", week_day_monthly: "3" })).toBe("The 2nd Tuesday of the month");
    expect(describeRule("monthly", { month_day_monthly: "32", week_day_monthly: "6" })).toBe("The last Friday of the month");
    expect(describeRule("quarterly", { month_day_multiple: "1", start_month_multiple: "2" })).toBe("The 1st, starting in February");
    expect(describeRule("weekly", { week_day_weekly: "7" })).toBe("Every Saturday");
    expect(
      describeFineRule(
        { id: 1, kind: "fixed", fixed_amount: "100.00", percentage_rate: null, percentage_of: null, chargeable_on: "1", mode: "1", frequency: "0", fine_limit: 2, is_active: true, next_fine_date: "2026-12-06" },
        "KES",
      ),
    ).toBe("KES 100.00, charged 1 day after the contribution date, for each unpaid invoice, at most 2 per invoice. Next on 6 Dec 2026");
    expect(fromDraft({ ...newDraft(), kind: "percentage", percentage_rate: "2.5", percentage_of: "2" })).toEqual({
      kind: "percentage", percentage_rate: "2.5", percentage_of: "2", chargeable_on: "1", mode: "1", frequency: "0", fine_limit: 0, is_active: true,
    });
  });

  it("summarises billing runs", () => {
    expect(summaryText({ invoices_raised: 1, fines_raised: 3, schedules_skipped: 2 })).toBe("1 invoice, 3 fines, 2 out-of-date settings moved on");
  });
});
