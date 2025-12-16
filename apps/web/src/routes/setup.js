import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { useTranslation } from "../hooks/use-translation.js";
import { useAuth } from "../providers/auth-context.js";
const SetupForm = () => {
    const { t } = useTranslation();
    const { setup, isAuthenticated } = useAuth();
    const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    if (isAuthenticated) {
        return _jsx(Navigate, { to: "/dashboard", replace: true });
    }
    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }
        if (form.password.length < 8) {
            setError("Password must be at least 8 characters");
            setLoading(false);
            return;
        }
        try {
            await setup({ email: form.email, password: form.password });
            setSuccess(true);
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                window.location.href = "/dashboard";
            }, 2000);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t("error"));
        }
        finally {
            setLoading(false);
        }
    };
    if (success) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background text-foreground", children: _jsx("div", { className: "glass-panel w-full max-w-md space-y-6 rounded-3xl p-8 text-center", children: _jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center", children: _jsx("svg", { className: "w-8 h-8 text-green-600 dark:text-green-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("setupComplete") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400 mt-2", children: t("redirectingToDashboard") })] })] }) }) }));
    }
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background text-foreground", children: _jsxs("div", { className: "glass-panel w-full max-w-md space-y-6 rounded-3xl p-8", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.35em] text-slate-400", children: t("uptivalab") }), _jsx("h1", { className: "text-3xl font-semibold text-slate-900 dark:text-white", children: t("welcomeToUptivaLab") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("createFirstAdminAccount") })] }), _jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: t("email") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", type: "email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }), required: true, placeholder: "admin@example.com" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: t("password") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", type: "password", value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }), required: true, minLength: 8, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: t("confirmPassword") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", type: "password", value: form.confirmPassword, onChange: (e) => setForm({ ...form, confirmPassword: e.target.value }), required: true, minLength: 8, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), error && (_jsx("div", { className: "rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4", children: _jsx("p", { className: "text-sm text-red-600 dark:text-red-400", children: error }) })), _jsx(Button, { type: "submit", disabled: loading, className: "w-full rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 py-3 font-medium", children: loading ? t("creatingAccount") : t("createAdminAccount") })] })] }) }));
};
export const SetupRoute = () => _jsx(SetupForm, {});
