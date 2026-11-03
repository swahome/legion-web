import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { api } from "../../api/client";
import { AdminGroupPage } from "./AdminGroupPage";
import { AdminGroupsPage } from "./AdminGroupsPage";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const contact = { user_id: 7, name: "Wanjiru Kamau", phone: "+254700000007", email: "w@example.com" };
const listed = {
  id: 15, legacy_id: 15, name: "Jirani", slug: "jirani", status: "active", currency: "KES", country_code: "KE",
  email: null, phone: null, active_members: 35, registered_members: 20, last_seen_at: null, contact, created_at: "2024-01-01T00:00:00Z",
};
const detail = {
  ...listed, timezone: "Africa/Nairobi", address: null, updated_at: "2026-11-01T00:00:00Z", created_by_name: "Wanjiru Kamau",
  contributions: 2, accounts: 1, loans: 4, notifications_off: false,
};

function stub() {
  const calls: { method: string; path: string; search: string; body?: unknown }[] = [];
  let group = { ...detail };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url, "http://x");
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path: u.pathname, search: u.search, body });
      if (u.pathname === "/v1/auth/refresh") return json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1 } });
      if (u.pathname === "/v1/admin/groups") return json(200, { items: [listed], total: 1, page: 1, page_size: 50 });
      if (u.pathname === "/v1/admin/groups/15" && method === "PATCH") {
        group = { ...group, ...body };
        return json(200, group);
      }
      if (u.pathname === "/v1/admin/groups/15") return json(200, group);
      if (u.pathname === "/v1/groups/15/members")
        return json(200, {
          members: [{ id: 1, user_id: 7, first_name: "Wanjiru", middle_name: "", last_name: "Kamau", is_official: true, role_id: 1, role_name: "Chair", membership_number: null, status: "active", joined_at: "2024-01-01", phone: "+254700000007" }],
        });
      if (u.pathname === "/v1/groups/15/contributions") return json(200, { contributions: [] });
      if (u.pathname === "/v1/groups/15/accounts") return json(200, { accounts: [], unassigned: [], total_balance: "0.00" });
      return json(404, { error: { code: "not_found", message: u.pathname } });
    }),
  );
  return calls;
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/groups/locked" element={<AdminGroupsPage view="locked" />} />
          <Route path="/admin/groups/inactive" element={<AdminGroupsPage view="inactive" />} />
          <Route path="/admin/groups/:groupId" element={<AdminGroupPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("admin groups", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("each view asks for its own groups and shows the contact", async () => {
    const calls = stub();
    await api.refresh();
    renderAt("/admin/groups/locked");
    expect(await screen.findByRole("heading", { name: "Locked groups" })).toBeInTheDocument();
    expect(await screen.findByText("Wanjiru Kamau")).toBeInTheDocument();
    expect(screen.getByText("20 signed in")).toBeInTheDocument();
    expect(calls.find((c) => c.path === "/v1/admin/groups")?.search).toContain("status=suspended");
  });

  it("potential archives use the inactive view", async () => {
    const calls = stub();
    await api.refresh();
    renderAt("/admin/groups/inactive");
    expect(await screen.findByRole("heading", { name: "Potential archives" })).toBeInTheDocument();
    expect(calls.find((c) => c.path === "/v1/admin/groups")?.search).toContain("view=inactive");
  });

  it("shows a group's details and members, switches off its texts and locks it", async () => {
    const calls = stub();
    await api.refresh();
    renderAt("/admin/groups/15");
    const user = userEvent.setup();
    expect(await screen.findByRole("heading", { name: "Jirani" })).toBeInTheDocument();
    expect(await screen.findByText("Chair")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Switch off this group/ }));
    await vi.waitFor(() => expect(calls).toContainEqual(expect.objectContaining({ method: "PATCH", body: { notifications_off: true } })));
    expect(await screen.findByText("Notifications off")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lock" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Lock" }));
    await vi.waitFor(() => expect(calls).toContainEqual(expect.objectContaining({ method: "PATCH", body: { status: "suspended" } })));
  });
});
