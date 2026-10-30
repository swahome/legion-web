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

  it("opens the admin panel for platform admins", async () => {
    stub({
      "/v1/me": me({ platform_roles: ["admin"] }),
      "/v1/admin/stats": { groups: 85, active_groups: 80, users: 868, users_active_30d: 12, memberships: 790 },
      "/v1/admin/audit": [],
    });
    renderAt("/admin");
    expect(await screen.findByText("868")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin" })).toBeInTheDocument();
  });
});
