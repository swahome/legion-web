import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, fullName, initials, isNegative, isZero } from "./format";

describe("format", () => {
  it("formats money strings with the currency code", () => {
    expect(formatMoney("4200.5")).toBe("KES 4,200.50");
    expect(formatMoney("-1249.50", "KES")).toBe("-KES 1,249.50");
    expect(formatMoney(null)).toBe("—");
  });

  it("reads signs and zero from money strings", () => {
    expect(isNegative("-0.01")).toBe(true);
    expect(isNegative("10.00")).toBe(false);
    expect(isZero("0.00")).toBe(true);
    expect(isZero("0.01")).toBe(false);
  });

  it("formats calendar dates without shifting the day", () => {
    expect(formatDate("2026-01-05")).toBe("5 Jan 2026");
    expect(formatDate(null)).toBe("—");
  });

  it("builds names and initials", () => {
    expect(fullName({ first_name: "Wanjiku", middle_name: "", last_name: "Kamau" })).toBe("Wanjiku Kamau");
    expect(initials({ first_name: "wanjiku", last_name: "kamau" })).toBe("WK");
  });
});
