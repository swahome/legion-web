import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "../../auth/AuthProvider";
import { ForgotPasswordPage } from "../auth/ForgotPasswordPage";
import { JoinPage } from "../auth/JoinPage";
import { SignupPage } from "../auth/SignupPage";
import { SetupPage } from "./SetupPage";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const session = { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1, first_name: "Wanjiru" } };

type Handler = (path: string, init?: RequestInit) => Response | undefined;

function stub(handler: Handler, signedIn = false) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, "http://x").pathname;
      if (path === "/v1/auth/refresh") return signedIn ? json(200, session) : json(401, { error: { code: "invalid_refresh_token", message: "no" } });
      calls.push({ method: init?.method ?? "GET", path, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      return handler(path, init) ?? json(404, { error: { code: "not_found", message: path } });
    }),
  );
  return calls;
}

function renderAt(path: string, routes: { path: string; element: React.ReactNode }[]) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            {routes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("sign-up and passwords", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("signs up and goes on to confirm the phone", async () => {
    const calls = stub((path) => {
      if (path === "/v1/auth/signup") return json(201, session);
    });
    const user = userEvent.setup();
    renderAt("/signup", [
      { path: "/signup", element: <SignupPage /> },
      { path: "/verify-phone", element: <p>Verify</p> },
    ]);
    await user.type(await screen.findByLabelText(/first name/i), "Wanjiru");
    await user.type(screen.getByLabelText(/phone number/i), "0712345678");
    await user.type(screen.getByLabelText(/^password/i), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/use a password of at least 8 characters/i)).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await user.type(screen.getByLabelText(/^password/i), "-and-longer");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Verify")).toBeInTheDocument();
    expect(calls[0]!.body).toEqual({ first_name: "Wanjiru", last_name: "", phone: "0712345678", password: "short-and-longer" });
  });

  it("explains a phone number that already has an account", async () => {
    stub((path) => {
      if (path === "/v1/auth/signup") return json(409, { error: { code: "phone_taken", message: "taken" } });
    });
    const user = userEvent.setup();
    renderAt("/signup", [{ path: "/signup", element: <SignupPage /> }]);
    await user.type(await screen.findByLabelText(/first name/i), "Wanjiru");
    await user.type(screen.getByLabelText(/phone number/i), "0712345678");
    await user.type(screen.getByLabelText(/^password/i), "long-enough");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/already an account with this phone number/i)).toBeInTheDocument();
  });

  it("resets a password with the texted code", async () => {
    const calls = stub((path) => {
      if (path === "/v1/auth/forgot-password") return json(202, { status: "sent" });
      if (path === "/v1/auth/reset-password") return json(200, session);
    });
    const user = userEvent.setup();
    renderAt("/forgot-password", [
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/", element: <p>Home</p> },
    ]);
    await user.type(await screen.findByLabelText(/phone number or email/i), "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await user.type(await screen.findByLabelText(/^code/i), "123456");
    await user.type(screen.getByLabelText(/^new password/i), "brand-new-pw");
    await user.type(screen.getByLabelText(/confirm new password/i), "brand-new-pw");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(calls.map((c) => c.body)).toEqual([
      { identity: "0712345678" },
      { identity: "0712345678", code: "123456", password: "brand-new-pw" },
    ]);
  });

  it("accepts an invite by setting a password", async () => {
    const calls = stub((path, init) => {
      if (path === "/v1/auth/invites/tok" && init?.method === "GET") return json(200, { first_name: "Juma", group_name: "Umoja", invited_by: "Akinyi Otieno", needs_password: true });
      if (path === "/v1/auth/invites/tok") return json(200, session);
    });
    const user = userEvent.setup();
    renderAt("/join/tok", [
      { path: "/join/:token", element: <JoinPage /> },
      { path: "/", element: <p>Home</p> },
    ]);
    expect(await screen.findByText(/welcome, juma/i)).toBeInTheDocument();
    expect(screen.getByText("Umoja")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^password/i), "my-password");
    await user.type(screen.getByLabelText(/confirm password/i), "my-password");
    await user.click(screen.getByRole("button", { name: /set password/i }));
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(calls.at(-1)).toEqual({ method: "POST", path: "/v1/auth/invites/tok", body: { password: "my-password" } });
  });

  it("explains an expired invite", async () => {
    stub((path) => {
      if (path === "/v1/auth/invites/old") return json(410, { error: { code: "invite_expired", message: "expired" } });
    });
    renderAt("/join/old", [{ path: "/join/:token", element: <JoinPage /> }]);
    expect(await screen.findByText(/this invite has expired/i)).toBeInTheDocument();
  });
});

describe("setup wizard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reviews the group and makes it live", async () => {
    let live = false;
    const group = { id: 7, name: "Tujenge", slug: "tujenge", country_code: "KE", currency: "KES", email: null, phone: null, address: null, size: 10, type: "2", type_name: "Chama" };
    const calls = stub((path, init) => {
      if (path === "/v1/groups/7/setup")
        return json(200, {
          group: { ...group, status: live ? "active" : "setup" },
          steps: [
            { key: "details", done: true, count: 1 },
            { key: "members", done: true, count: 3 },
            { key: "contributions", done: true, count: 1 },
            { key: "fines", done: false, count: 0 },
            { key: "accounts", done: false, count: 0 },
            { key: "loan_types", done: false, count: 0 },
          ],
          members_to_invite: 2,
          completed_at: null,
        });
      if (path === "/v1/groups/7/setup/complete" && init?.method === "POST") {
        live = true;
        return json(200, { group: { ...group, status: "active" }, invites_sent: 2 });
      }
    }, true);
    const user = userEvent.setup();
    renderAt("/group/7/setup", [{ path: "/group/:groupId/setup", element: <SetupPage /> }]);
    await user.click(await screen.findByRole("button", { name: /review and finish/i }));
    expect(screen.getByText("3 members")).toBeInTheDocument();
    expect(screen.getByText(/2 members get an SMS invite/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /finish and text invites/i }));
    expect(await screen.findByText(/tujenge is live/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.path === "/v1/groups/7/setup/complete")).toBe(true);
  });
});
