import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context.js";
import { Button } from "../components/ui/button.js";
import { useTranslation } from "../hooks/use-translation.js";
const AuthForm = ({ mode }) => {
    const { t } = useTranslation();
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
            setError(err instanceof Error ? err.message : t("error"));
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background text-foreground", children: _jsxs("div", { className: "glass-panel w-full max-w-md space-y-6 rounded-3xl p-8", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.35em] text-slate-400", children: t("uptivalab") }), _jsx("h1", { className: "text-3xl font-semibold text-slate-900 dark:text-white", children: mode === "login" ? t("welcomeBack") : t("createAccount") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: mode === "login" ? t("useEmailPassword") : t("provisionCredentials") })] }), _jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: t("email") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", type: "email", value: form.email, onChange: (e) => setForm((prev) => ({ ...prev, email: e.target.value })), required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: t("password") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", type: "password", value: form.password, onChange: (e) => setForm((prev) => ({ ...prev, password: e.target.value })), required: true })] }), error && _jsx("p", { className: "text-sm text-danger", children: error }), _jsx(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? t("working") : mode === "login" ? t("signIn") : t("register") })] }), mode === "login" && (_jsx("p", { className: "text-center text-sm text-slate-600 dark:text-slate-400", children: "Need an account? Contact your administrator." }))] }) }));
};
export const LoginRoute = () => _jsx(AuthForm, { mode: "login" });
