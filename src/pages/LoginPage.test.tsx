import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "../auth/AuthProvider";
import { LoginPage } from "./LoginPage";

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

describe("LoginPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("explains a wrong password, then signs in", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "no session" } })) // restore on mount
      .mockResolvedValueOnce(json(401, { error: { code: "invalid_credentials", message: "bad" } }))
      .mockResolvedValueOnce(json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1 } }));
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/phone number or email/i), "0712345678");
    await user.type(screen.getByLabelText(/^password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText(/don't match/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^password/i));
    await user.type(screen.getByLabelText(/^password/i), "right");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[2]![1].body)).toEqual({ identity: "0712345678", password: "right" });
  });
});
