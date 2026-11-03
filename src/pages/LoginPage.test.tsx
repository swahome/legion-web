import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "../auth/AuthProvider";
import { LoginPage, withCallingCode } from "./LoginPage";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderLogin() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>Home</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const options = {
  countries: [
    { code: "KE", name: "Kenya", calling_code: "254", is_default: true },
    { code: "UG", name: "Uganda", calling_code: "256", is_default: false },
  ],
  links: { terms: "https://example.com/terms" },
};

describe("withCallingCode", () => {
  it("adds the picked country's code to local numbers only", () => {
    expect(withCallingCode("0712 345 678", "254")).toBe("+254712345678");
    expect(withCallingCode("712345678", "256")).toBe("+256712345678");
    expect(withCallingCode("254712345678", "254")).toBe("+254712345678");
    expect(withCallingCode("+256772000111", "254")).toBe("+256772000111");
    expect(withCallingCode("me@example.com", "254")).toBe("me@example.com");
    expect(withCallingCode("0712345678", undefined)).toBe("0712345678");
  });
});

describe("LoginPage", () => {
  let logins: unknown[];
  let password: string;
  beforeEach(() => {
    logins = [];
    password = "right";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url, "http://x").pathname;
        if (path === "/v1/auth/refresh") return json(401, { error: { code: "unauthorized", message: "no session" } });
        if (path === "/v1/auth/options") return json(200, options);
        if (path === "/v1/auth/login") {
          const body = JSON.parse(String(init!.body));
          logins.push(body);
          if (body.password !== password) return json(401, { error: { code: "invalid_credentials", message: "bad" } });
          return json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1 } });
        }
        return json(404, { error: { code: "not_found", message: path } });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("explains a wrong password, then signs in with the picked country code", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/phone number or email/i), "0772000111");
    await user.selectOptions(await screen.findByLabelText("Country code"), "UG");
    await user.type(screen.getByLabelText(/^password/i), "wrong");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText(/don't match/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^password/i));
    await user.type(screen.getByLabelText(/^password/i), "right");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(logins.at(-1)).toEqual({ identity: "+256772000111", password: "right" });
  });

  it("hides the country picker for an email and shows the admin's links", async () => {
    const user = userEvent.setup();
    renderLogin();
    expect(await screen.findByRole("link", { name: "Terms and conditions" })).toHaveAttribute("href", "https://example.com/terms");
    await user.type(screen.getByLabelText(/phone number or email/i), "me@example.com");
    expect(screen.queryByLabelText("Country code")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^password/i), "right");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(logins.at(-1)).toEqual({ identity: "me@example.com", password: "right" });
  });
});
