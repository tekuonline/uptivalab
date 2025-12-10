import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
const AuthContext = createContext(undefined);
const STORAGE_KEY = "uptivalab.token";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
    useEffect(() => {
        if (token) {
            localStorage.setItem(STORAGE_KEY, token);
        }
        else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [token]);
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
    }, []);
    const login = useCallback((value) => authenticate("login", value), [authenticate]);
    const register = useCallback((value) => authenticate("register", value), [authenticate]);
    const logout = useCallback(() => setToken(null), []);
    const value = useMemo(() => ({ token, isAuthenticated: Boolean(token), login, register, logout }), [login, logout, register, token]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
};
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("useAuth must be used within AuthProvider");
    return ctx;
};
