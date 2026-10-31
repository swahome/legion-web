import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { api } from "../../api/client";
import { feeText, fineText, interestText, termText, type LoanType } from "../../api/loans";
import { ApplyDialog } from "./LoanApplicationsPage";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const emergency: LoanType = {
  id: 7, name: "EMERGENCY", interest_type: "fixed_balance", interest_rate: 10, rate_per: "term", reducing_method: "equal_installments",
  fixed_interest: "0.00", fixed_interest_rate: 0, frequency: "monthly", fixed_term: null, min_term: 1, max_term: 6, grace_periods: 1,
  amount_basis: "range", min_amount: "1000.00", max_amount: "50000.00", savings_multiple: null, guarantors: "always", min_guarantors: 1,
  max_guarantors: 3, late_fine: { kind: "fixed", amount: "100.00", frequency: "once", scope: "installment" }, balance_fine: null,
  processing_fee: { kind: "percentage", rate: 2, on: "amount" }, fine_deferment: false, needs_approval: true, is_hidden: false,
};

const schedule = {
  amount: "4000.00", interest: "400.00", total: "4400.00", processing_fee: "80.00", ends_on: "2027-02-28",
  installments: [1, 2].map((n) => ({ number: n, due_on: `2026-1${n}-30`, principal: "2000.00", interest: "200.00", amount: "2200.00" })),
};

function stub() {
  const posted: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, "http://x").pathname;
      if (path === "/v1/auth/refresh") return json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1 } });
      if (path === "/v1/groups/15/loans/preview") return json(200, schedule);
      if (init?.method === "POST") {
        posted.push({ path, body: JSON.parse(String(init.body)) });
        return json(201, { id: 31 });
      }
      if (path === "/v1/groups/15/loan-types") return json(200, { loan_types: [emergency] });
      if (path === "/v1/groups/15/members")
        return json(200, {
          members: [
            { id: 40, first_name: "Jane", last_name: "Wanjiru", status: "active" },
            { id: 41, first_name: "Otieno", last_name: "Ouma", status: "active" },
          ],
        });
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

describe("loans", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("applies for a loan with a guarantor and shows the schedule", async () => {
    const posted = stub();
    await api.refresh();
    const onDone = vi.fn();
    render(wrap(<ApplyDialog groupId={15} currency="KES" me={40} onClose={() => {}} onDone={onDone} />));
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "EMERGENCY" });
    await user.selectOptions(screen.getByLabelText("Loan"), "7");
    expect(screen.getByText(/Needs 1 or more guarantors/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Amount (KES)"), "4000");
    await user.type(screen.getByLabelText("Repay over (months)"), "2");
    await user.click(screen.getByRole("button", { name: "+ Add a guarantor" }));
    const pick = screen.getByLabelText("Guarantor 1");
    expect(screen.queryByRole("option", { name: "Jane Wanjiru" })).toBeNull(); // not yourself
    await user.selectOptions(pick, "41");
    await user.type(screen.getByLabelText("Amount guaranteed by guarantor 1 (KES)"), "2000");
    expect(await screen.findByText("KES 4,400.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(31));
    expect(posted).toEqual([
      { path: "/v1/groups/15/loan-applications", body: { loan_type_id: 7, amount: "4000", installments: 2, guarantors: [{ member_id: 41, amount: "2000" }] } },
    ]);
  });

  it("describes loan terms", () => {
    expect(interestText(emergency)).toBe("10% for the whole term, flat rate");
    expect(termText(emergency)).toBe("1 to 6 months");
    expect(termText({ ...emergency, fixed_term: 12 })).toBe("12 months");
    expect(fineText(emergency.late_fine, "KES")).toBe("KES 100.00, once");
    expect(fineText({ kind: "percentage", rate: 5, rate_on: "unpaid_balance", frequency: "monthly" }, "KES")).toBe("5% of the unpaid loan balance, every month");
    expect(feeText(emergency.processing_fee, "KES")).toBe("2% of the amount");
    expect(fineText(null, "KES")).toBe("None");
  });
});
