import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, Client } from "./client";

const session = (token: string) => ({ access_token: token, token_type: "Bearer", expires_in: 900, user: { id: 1, first_name: "Ann" } });

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("Client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refreshes once and retries when the access token has expired", async () => {
    const c = new Client();
    fetchMock
      .mockResolvedValueOnce(json(200, session("old"))) // login
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "expired" } }))
      .mockResolvedValueOnce(json(200, session("new"))) // refresh
      .mockResolvedValueOnce(json(200, { ok: true }));
    await c.login("0712345678", "pw");
    await expect(c.get("/v1/me")).resolves.toEqual({ ok: true });

    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init.headers.Authorization]);
    expect(calls).toEqual([
      ["/v1/auth/login", undefined],
      ["/v1/me", "Bearer old"],
      ["/v1/auth/refresh", undefined],
      ["/v1/me", "Bearer new"],
    ]);
  });

  it("shares one refresh between concurrent callers", async () => {
    const c = new Client();
    fetchMock.mockImplementation(async (url: string) => (url === "/v1/auth/refresh" ? json(200, session("t")) : json(200, { url })));
    await Promise.all([c.get("/v1/a"), c.get("/v1/b"), c.get("/v1/c")]);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/v1/auth/refresh")).toHaveLength(1);
  });

  it("signs out when the refresh cookie is rejected", async () => {
    const c = new Client();
    const seen: unknown[] = [];
    c.onSession((s) => seen.push(s));
    fetchMock.mockResolvedValue(json(401, { error: { code: "invalid_refresh_token", message: "nope" } }));
    await expect(c.refresh()).resolves.toBeNull();
    expect(seen).toEqual([null]);
  });

  it("surfaces API error codes and Retry-After", async () => {
    const c = new Client();
    fetchMock.mockResolvedValue(json(429, { error: { code: "too_many_attempts", message: "slow down" } }, { "Retry-After": "540" }));
    const err = await c.login("a@b.co", "x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: "too_many_attempts", retryAfter: 540 });
  });
});
