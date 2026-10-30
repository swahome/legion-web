import type { Session } from "./types";

// ApiError carries the API's {"error": {"code", "message"}} body.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type SessionListener = (session: Session | null) => void;

/**
 * Client holds the access token in memory only. The refresh token lives in
 * an HttpOnly cookie the browser sends to /v1/auth/*, so a page reload
 * restores the session through refresh() without any token in storage.
 */
export class Client {
  private accessToken: string | null = null;
  private refreshing: Promise<Session | null> | null = null;
  private listeners = new Set<SessionListener>();

  constructor(private readonly base = "") {}

  onSession(fn: SessionListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setSession(s: Session | null) {
    this.accessToken = s?.access_token ?? null;
    for (const fn of this.listeners) fn(s);
  }

  async login(identity: string, password: string): Promise<Session> {
    const s = await this.raw<Session>("POST", "/v1/auth/login", { identity, password });
    this.setSession(s);
    return s;
  }

  async logout(): Promise<void> {
    try {
      await this.raw("POST", "/v1/auth/logout");
    } finally {
      this.setSession(null);
    }
  }

  /**
   * refresh exchanges the refresh cookie for a new access token. Concurrent
   * callers share one request, because the API rotates the cookie on every
   * use and treats a replayed one as theft.
   */
  refresh(): Promise<Session | null> {
    if (!this.refreshing) {
      this.refreshing = this.raw<Session>("POST", "/v1/auth/refresh")
        .then((s) => {
          this.setSession(s);
          return s;
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            this.setSession(null);
            return null;
          }
          throw err;
        })
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  /** request sends an authenticated call, refreshing once on an expired token. */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.accessToken) await this.refresh();
    try {
      return await this.raw<T>(method, path, body, this.accessToken);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
      const s = await this.refresh();
      if (!s) throw err;
      return this.raw<T>(method, path, body, s.access_token);
    }
  }

  private async raw<T>(method: string, path: string, body?: unknown, token?: string | null): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const e = data?.error;
      const retry = Number(res.headers.get("Retry-After")) || undefined;
      throw new ApiError(res.status, e?.code ?? "http_error", e?.message ?? `Request failed (${res.status})`, retry);
    }
    return data as T;
  }
}

export const api = new Client();
