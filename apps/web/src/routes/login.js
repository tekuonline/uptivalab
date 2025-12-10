import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context.js";
import { Button } from "../components/ui/button.js";
const AuthForm = ({ mode }) => {
    const { login, register, isAuthenticated } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    if (isAuthenticated) {
        return _jsx(Navigate, { to: "/dashboard", replace: true });
    }
    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (mode === "login") {
                await login(form);
            }
            else {
                await register(form);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Unexpected error");
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background text-foreground", children: _jsxs("div", { className: "glass-panel w-full max-w-md space-y-6 rounded-3xl p-8", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.35em] text-slate-400", children: "UptivaLab" }), _jsx("h1", { className: "text-3xl font-semibold text-white", children: mode === "login" ? "Welcome back" : "Create account" }), _jsx("p", { className: "text-sm text-slate-400", children: mode === "login" ? "Use your email + password to continue." : "Provision your operator credentials." })] }), _jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: "Email" }), _jsx("input", { className: "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white", type: "email", value: form.email, onChange: (e) => setForm((prev) => ({ ...prev, email: e.target.value })), required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: "Password" }), _jsx("input", { className: "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white", type: "password", value: form.password, onChange: (e) => setForm((prev) => ({ ...prev, password: e.target.value })), required: true })] }), error && _jsx("p", { className: "text-sm text-danger", children: error }), _jsx(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? "Working…" : mode === "login" ? "Sign in" : "Register" })] }), _jsx("p", { className: "text-center text-sm text-slate-400", children: mode === "login" ? (_jsxs(_Fragment, { children: ["Need an account? ", _jsx(Link, { className: "text-primary", to: "/register", children: "Register" })] })) : (_jsxs(_Fragment, { children: ["Already onboard? ", _jsx(Link, { className: "text-primary", to: "/login", children: "Sign in" })] })) })] }) }));
};
export const LoginRoute = () => _jsx(AuthForm, { mode: "login" });
export const RegisterRoute = () => _jsx(AuthForm, { mode: "register" });
