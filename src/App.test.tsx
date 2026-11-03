import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const user = { id: 7, first_name: "Wanjiku", middle_name: "", last_name: "Kamau", email: null, phone: "+254700000007", last_login_at: null };

function group(over: Record<string, unknown> = {}) {
  return {
    id: 15,
    name: "Jirani",
    slug: "jirani",
    status: "active",
    currency: "KES",
    my_membership_id: 3,
    is_official: false,
    platform_admin: false,
    summary: { active_members: 4, officials: 1, active_contributions: 0, total_contributions_paid: "0.00" },
    ...over,
  };
}

/** api answers fetch calls by path, like a tiny legion-api. */
function api(routes: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const path = new URL(url, "http://x").pathname;
    if (path === "/v1/auth/refresh") return json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user });
    if (path in routes) return json(200, routes[path]);
    return json(404, { error: { code: "not_found", message: `no fixture for ${path}` } });
  });
}

function me(over: Record<string, unknown> = {}) {
  return {
    user,
    platform_roles: [],
    memberships: [
      { membership_id: 3, group_id: 15, group_name: "Jirani", group_slug: "jirani", group_status: "active", currency: "KES", is_official: false, role_name: null, status: "active" },
    ],
    disabled_menus: [],
    ...over,
  };
}

function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
          <Where />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const path = () => screen.getByTestId("path").textContent;

describe("role sections", () => {
  let fetchMock: ReturnType<typeof api>;
  afterEach(() => vi.unstubAllGlobals());
  const stub = (routes: Record<string, unknown>) => {
    fetchMock = api(routes);
    vi.stubGlobal("fetch", fetchMock);
  };
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });

  it("sends a member from the officials' panel to the members' panel", async () => {
    stub({ "/v1/me": me(), "/v1/groups/15/": group(), "/v1/groups/15/contributions": { contributions: [] } });
    renderAt("/group/15");
    const nav = await screen.findByRole("navigation", { name: "Group" }, { timeout: 3000 });
    expect(path()).toBe("/member/15");
    expect(within(nav).queryByRole("link", { name: "Arrears" })).toBeNull();
    expect(within(nav).getByRole("link", { name: "My statement" })).toHaveAttribute("href", "/member/15/statement");
  });

  it("hides menu items an admin switched off", async () => {
    stub({
      "/v1/me": me({ disabled_menus: ["member.members"] }),
      "/v1/groups/15/": group(),
      "/v1/groups/15/contributions": { contributions: [] },
    });
    renderAt("/member/15/members");
    const nav = await screen.findByRole("navigation", { name: "Group" });
    expect(within(nav).queryByRole("link", { name: "Members" })).toBeNull();
    expect(path()).toBe("/member/15");
  });

  it("keeps old /g links working", async () => {
    stub({ "/v1/me": me(), "/v1/groups/15/": group({ is_official: true }), "/v1/groups/15/contributions": { contributions: [] } });
    renderAt("/g/15/contributions");
    await screen.findByRole("navigation", { name: "Group" });
    expect(path()).toBe("/group/15/contributions");
  });

  it("keeps non-admins out of the admin panel", async () => {
    stub({ "/v1/me": me() });
    renderAt("/admin/users");
    await screen.findByText(/your groups/i);
    expect(path()).toBe("/groups");
  });

  it("lets people with many groups search them on the check-in page", async () => {
    const names = ["Jirani", "Imani Sacco", "Pamoja", "Umoja Welfare", "Tujenge"];
    stub({
      "/v1/me": me({
        memberships: names.map((n, i) => ({
          membership_id: i + 1, group_id: i + 10, group_name: n, group_slug: n.toLowerCase(), group_status: "active", currency: "KES",
          is_official: i === 0, role_name: i === 0 ? "Chair" : null, status: "active",
        })),
      }),
    });
    renderAt("/groups");
    const search = await screen.findByLabelText("Search your groups");
    const { default: userEvent } = await import("@testing-library/user-event");
    const u = userEvent.setup();
    await u.type(search, "sacco");
    expect(screen.getByText("Imani Sacco")).toBeInTheDocument();
    expect(screen.queryByText("Pamoja")).not.toBeInTheDocument();
    await u.clear(search);
    await u.type(search, "nothing like it");
    expect(screen.getByText("No group matches")).toBeInTheDocument();
  });

  it("opens the admin panel for platform admins", async () => {
    stub({
      "/v1/me": me({ platform_roles: ["admin"] }),
      "/v1/admin/stats": {
        groups: 85, active_groups: 80, setup_groups: 3, suspended_groups: 1, closed_groups: 1, groups_today: 2,
        users: 868, users_today: 4, users_active_30d: 12, memberships: 790,
        sms_total: 50, sms_sent_today: 5, sms_queued: 0, sms_failed_7d: 1,
        transaction_alerts: 10, alerts_unassigned: 2, accounts_connected: 7, payments_paid: 9, payments_paid_amount: "4500.00",
        invoices_today: 30, fine_invoices_today: 0, open_withdrawal_requests: 3, audit_entries: 20,
      },
      "/v1/admin/audit": [],
    });
    renderAt("/admin");
    expect(await screen.findByText("868")).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Admin" }).length).toBeGreaterThan(0);
    // The dashboard links each count to its list, and failures stand out.
    expect(screen.getByRole("link", { name: /Failed texts\s*1/ })).toHaveAttribute("href", "/admin/sms");
    expect(screen.getByRole("button", { name: "Groups" })).toHaveAttribute("aria-expanded", "false");
  });
});
