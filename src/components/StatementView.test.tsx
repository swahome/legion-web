import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Statement } from "../api/types";
import { StatementTable } from "./StatementView";

const statement: Statement = {
  member: { id: 7, user_id: 9, first_name: "Ann", middle_name: "", last_name: "Otieno", is_official: false, role_id: null, role_name: null, membership_number: "12", status: "active", joined_at: "2025-01-01T00:00:00Z" },
  currency: "KES",
  from: "2026-01-01",
  to: null,
  opening_balance: "500.00",
  closing_balance: "1500.00",
  entries: [
    { id: 1, date: "2026-01-05", type: "contribution_invoice", label: "Invoice", contribution_id: 3, contribution_name: "Monthly savings", description: "", debit: "2000.00", credit: null, balance: "2500.00", is_backdated: false },
    { id: 2, date: "2026-01-10", type: "contribution_payment", label: "Payment", contribution_id: 3, contribution_name: "Monthly savings", description: "M-Pesa", debit: null, credit: "1000.00", balance: "1500.00", is_backdated: true },
  ],
  totals: [],
};

describe("StatementTable", () => {
  it("shows the opening balance and a running balance per entry", () => {
    render(<StatementTable statement={statement} />);
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent(/opening balance/i);
    expect(rows[1]).toHaveTextContent("KES 500.00");
    const invoice = rows.find((r) => within(r).queryByText("Invoice"))!;
    expect(invoice).toHaveTextContent("KES 2,000.00");
    expect(invoice).toHaveTextContent("KES 2,500.00");
    expect(screen.getByText(/backdated/i)).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing to list", () => {
    render(<StatementTable statement={{ ...statement, opening_balance: "0.00", entries: [] }} />);
    expect(screen.getByText("No transactions")).toBeInTheDocument();
  });
});
