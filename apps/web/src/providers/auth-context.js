import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
const AuthContext = createContext(undefined);
const STORAGE_KEY = "uptivalab.token";
const API_BASE = import.meta.env.VITE_API_URL;
export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
    const [setupNeeded, setSetupNeeded] = useState(null);
    useEffect(() => {
        if (token) {
            localStorage.setItem(STORAGE_KEY, token);
        }
        else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [token]);
    const checkSetupNeeded = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/setup-needed`);
            if (response.ok) {
                const data = await response.json();
                setSetupNeeded(data.setupNeeded);
            }
        }
        catch (error) {
            console.error("Failed to check setup status:", error);
        }
    }, []);
    const authenticate = useCallback(async (path, credentials) => {
        const response = await fetch(`${API_BASE}/api/auth/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials),
        });
        if (!response.ok) {
            const body = (await response.json().catch(() => ({})));
            throw new Error(body.message ?? "Authentication failed");
        }
        const data = (await response.json());
        setToken(data.token);
        setSetupNeeded(false);
    }, []);
    const login = useCallback((value) => authenticate("login", value), [authenticate]);
    const register = useCallback((value) => authenticate("register", value), [authenticate]);
    const setup = useCallback((value) => authenticate("setup", value), [authenticate]);
    const logout = useCallback(() => setToken(null), []);
    const value = useMemo(() => ({ token, isAuthenticated: Boolean(token), setupNeeded, login, register, setup, logout, checkSetupNeeded }), [login, logout, register, setup, token, setupNeeded, checkSetupNeeded]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
};
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("useAuth must be used within AuthProvider");
    return ctx;
};
