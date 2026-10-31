import { describe, expect, it } from "vitest";
import type { Dashboard } from "../api/dashboard";
import { niceMax } from "../components/MoneyChart";
import { monthPeriods, movementLabel, yearPeriods } from "./DashboardPage";

const zero = { contributions: "0.00", fines: "0.00", misc: "0.00", income: "0.00", expenses: "0.00" };

describe("dashboard", () => {
  it("labels months and fills quiet years", () => {
    const d = {
      months: [{ ...zero, month: "2025-12" }, { ...zero, month: "2026-01" }],
      years: [{ ...zero, year: 2019, contributions: "10.00" }, { ...zero, year: 2021, expenses: "5.00" }],
    } as unknown as Dashboard;
    expect(monthPeriods(d).map((p) => [p.label, p.title])).toEqual([["Dec", "December 2025"], ["Jan 26", "January 2026"]]);
    const years = yearPeriods(d);
    expect(years.map((y) => [y.label, y.contributions, y.expenses])).toEqual([
      ["2019", "10.00", "0.00"],
      ["2020", "0.00", "0.00"],
      ["2021", "0.00", "5.00"],
    ]);
  });

  it("rounds the chart scale to even quarters", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(620_000)).toBe(800_000);
    expect(niceMax(1_000)).toBe(1_000);
    expect(niceMax(1_100)).toBe(1_200);
  });

  it("names cash book movements", () => {
    const m = { id: 1, date: "2026-01-01", amount: "1.00", account: "", account_kind: "bank", member: "", description: "Legacy row" };
    expect(movementLabel({ ...m, direction: "in", kind: "contribution" })).toBe("Contribution payment");
    expect(movementLabel({ ...m, direction: "out", kind: "expense" })).toBe("Expense");
    expect(movementLabel({ ...m, direction: "out", kind: "transfer" })).toBe("Transfer out");
    expect(movementLabel({ ...m, direction: "in", kind: "" })).toBe("Legacy row");
  });
});
