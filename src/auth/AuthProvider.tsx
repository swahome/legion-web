import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { User } from "../api/types";

type Status = "loading" | "signed-in" | "signed-out";

interface AuthState {
  status: Status;
  user: User | null;
  login: (identity: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const off = api.onSession((s) => {
      setUser(s?.user ?? null);
      setStatus(s ? "signed-in" : "signed-out");
      if (!s) qc.clear();
    });
    // Restore the session from the refresh cookie, if there is one.
    api.refresh().catch(() => setStatus("signed-out"));
    return () => {
      off();
    };
  }, [qc]);

  const login = useCallback(async (identity: string, password: string) => {
    await api.login(identity, password);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
