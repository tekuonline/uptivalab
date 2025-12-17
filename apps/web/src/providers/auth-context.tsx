import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  setupNeeded: boolean | null;
  login: (value: { email: string; password: string }) => Promise<void>;
  register: (value: { email: string; password: string }) => Promise<void>;
  setup: (value: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  checkSetupNeeded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "uptivalab.token";
const API_BASE = import.meta.env.VITE_API_URL;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token]);

  // Check setup status on mount
  useEffect(() => {
    checkSetupNeeded();
  }, []);

  const checkSetupNeeded = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/setup-needed`);
      if (response.ok) {
        const data = await response.json();
        setSetupNeeded(data.setupNeeded);
      } else {
        // If API call fails, assume setup is needed for safety
        console.warn("Setup check failed, assuming setup needed:", response.status);
        setSetupNeeded(true);
      }
    } catch (error) {
      console.error("Failed to check setup status:", error);
      // If network error, assume setup is needed for safety
      setSetupNeeded(true);
    }
  }, []);

  const authenticate = useCallback(async (path: string, credentials: { email: string; password: string }) => {
    const response = await fetch(`${API_BASE}/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? "Authentication failed");
    }
    const data = (await response.json()) as { token: string };
    setToken(data.token);
    setSetupNeeded(false);
  }, []);

  const login = useCallback((value: { email: string; password: string }) => authenticate("login", value), [authenticate]);
  const register = useCallback((value: { email: string; password: string }) => authenticate("register", value), [authenticate]);
  const setup = useCallback((value: { email: string; password: string }) => authenticate("setup", value), [authenticate]);
  const logout = useCallback(() => setToken(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, isAuthenticated: Boolean(token), setupNeeded, login, register, setup, logout, checkSetupNeeded }),
    [login, logout, register, setup, token, setupNeeded, checkSetupNeeded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
