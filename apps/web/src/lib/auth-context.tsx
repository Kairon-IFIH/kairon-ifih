import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setTokens, getAccessToken, onSessionExpired } from "./api-client";
import { login as loginRequest } from "./endpoints";

interface AuthContextValue {
  isAuthenticated: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // api-client reads any sessionStorage-persisted token at module load, so a
  // refresh has one already in memory here before this component even mounts.
  const [isAuthenticated, setIsAuthenticated] = useState(() => getAccessToken() !== null);

  useEffect(() => {
    onSessionExpired(() => setIsAuthenticated(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      async login(email: string, password: string) {
        const tokens = await loginRequest(email, password);
        setTokens(tokens);
        setIsAuthenticated(true);
      },
      logout() {
        setTokens(null);
        setIsAuthenticated(false);
      },
    }),
    [isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
