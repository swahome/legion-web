import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { api } from "../../api/client";
import { screenText } from "../../api/channels";
import { AdminChannelsPage } from "./AdminChannelsPage";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const status = {
  configured: true,
  ussd_enabled: true,
  whatsapp_enabled: true,
  whatsapp_signed: false,
  last_7_days: { ussd_sessions: 12, whatsapp_sessions: 3, callers: 9 },
};
const session = {
  id: 4, channel: "ussd", phone: "+254700000002", user: { id: 2, name: "Otieno Ouma" }, group: { id: 15, name: "Jirani" },
  screen: "main", inputs: 3, errors: 1, ended_at: null, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:01:00Z",
};

function stub() {
  const posted: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, "http://x").pathname;
      if (path === "/v1/auth/refresh") return json(200, { access_token: "t", token_type: "Bearer", expires_in: 900, user: { id: 1 } });
      if (init?.method === "POST" || init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        posted.push({ path, body });
        if (path === "/v1/admin/channels/try") {
          const b = body as { input: string };
          if (!b.input) return json(200, { session: "try-1", text: "CON Jirani. Choose:\n1. My account\n0 Exit", end: false });
          return json(200, { session: "try-1", text: "END Thank you for using Legion.", end: true });
        }
        return json(200, {});
      }
      if (path === "/v1/admin/channels") return json(200, status);
      if (path === "/v1/admin/channel-sessions") return json(200, { items: [session], total: 1, page: 1, page_size: 50 });
      if (path === "/v1/admin/channel-sessions/4")
        return json(200, {
          ...session, service_code: "*384*1#", expires_at: "", messages: [
            { id: 1, input: "", response: "CON Welcome", error: "", created_at: "2026-11-01T10:00:00Z" },
            { id: 2, input: "2", response: "END Sorry", error: "boom", created_at: "2026-11-01T10:00:05Z" },
          ],
        });
      return json(404, { error: { code: "not_found", message: path } });
    }),
  );
  return posted;
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AdminChannelsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("USSD and WhatsApp admin", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("strips the USSD prefix", () => {
    expect(screenText("CON Hello")).toBe("Hello");
    expect(screenText("END Bye")).toBe("Bye");
    expect(screenText("Hi there")).toBe("Hi there");
  });

  it("switches a channel off, runs the test phone and shows a transcript", async () => {
    const posted = stub();
    await api.refresh();
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Set LEGION_TWILIO_AUTH_TOKEN on the server so only Twilio can post messages.")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/USSD is on/));
    await vi.waitFor(() => expect(posted).toContainEqual({ path: "/v1/admin/settings", body: { "channels.ussd.enabled": false } }));

    await user.click(screen.getByRole("button", { name: "Dial" }));
    const phone = screen.getByTestId("test-phone-screen");
    expect(await within(phone).findByText(/Jirani\. Choose:/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reply"), "0");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await within(phone).findByText("Thank you for using Legion.")).toBeInTheDocument();
    expect(within(phone).getByText("Session ended")).toBeInTheDocument();
    expect(posted.filter((p) => p.path === "/v1/admin/channels/try").map((p) => p.body)).toEqual([
      { format: "ussd", session: "", input: "" },
      { format: "ussd", session: "try-1", input: "0" },
    ]);

    await user.click(await screen.findByRole("button", { name: "Transcript" }));
    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.getByText("END Sorry")).toBeInTheDocument();
  });
});
