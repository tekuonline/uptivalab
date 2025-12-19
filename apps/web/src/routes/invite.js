import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { useTranslation } from "../lib/i18n.js";
import { useAuth } from "../providers/auth-context.js";
import { api } from "../lib/api.js";
export const InviteAcceptRoute = () => {
    const { t } = useTranslation();
    const { token } = useParams();
    const { isAuthenticated } = useAuth();
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [inviteInfo, setInviteInfo] = useState(null);
    const [accepted, setAccepted] = useState(false);
    useEffect(() => {
        // Verify invitation token
        const verifyInvitation = async () => {
            try {
                const data = await api.verifyInvitation(token);
                setInviteInfo(data);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : "Invalid or expired invitation");
            }
        };
        if (token && !isAuthenticated) {
            verifyInvitation();
        }
    }, [token, isAuthenticated]);
    if (isAuthenticated) {
        return _jsx(Navigate, { to: "/dashboard", replace: true });
    }
    if (accepted) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    const handleAccept = async (event) => {
        event.preventDefault();
        if (password !== repeatPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await api.acceptInvitation({ token: token, password });
            localStorage.setItem("uptivalab.token", data.token);
            setAccepted(true);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to accept invitation");
        }
        finally {
            setLoading(false);
        }
    };
    if (!inviteInfo && !error) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background text-foreground", children: _jsx("div", { className: "glass-panel w-full max-w-md space-y-6 rounded-3xl p-8", children: _jsx("p", { className: "text-center text-slate-400", children: "Verifying invitation..." }) }) }));
    }
    if (error && !inviteInfo) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background text-foreground", children: _jsxs("div", { className: "glass-panel w-full max-w-md space-y-6 rounded-3xl p-8", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.35em] text-slate-400", children: "UPTIVALAB" }), _jsx("h1", { className: "text-3xl font-semibold text-slate-900 dark:text-white", children: "Invalid Invitation" })] }), _jsx("p", { className: "text-red-400", children: error }), _jsx(Button, { onClick: () => window.location.href = "/login", className: "w-full", children: "Go to Login" })] }) }));
    }
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-background text-foreground", children: _jsxs("div", { className: "glass-panel w-full max-w-md space-y-6 rounded-3xl p-8", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.35em] text-slate-400", children: "UPTIVALAB" }), _jsx("h1", { className: "text-3xl font-semibold text-slate-900 dark:text-white", children: "Accept Invitation" }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: ["You've been invited to join as a ", inviteInfo?.role.toLowerCase()] })] }), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Email" }), _jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: inviteInfo?.email })] }), _jsxs("form", { className: "space-y-4", onSubmit: handleAccept, children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: "Password" }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", type: "password", placeholder: "Minimum 8 characters", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 8 })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-[0.4em] text-slate-400", children: "Repeat Password" }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", type: "password", placeholder: t("repeatYourPassword"), value: repeatPassword, onChange: (e) => setRepeatPassword(e.target.value), required: true, minLength: 8 })] }), error && _jsx("p", { className: "text-sm text-red-400", children: error }), _jsx(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? t("creatingAccount") : t("acceptInvitation") })] }), _jsxs("p", { className: "text-center text-xs text-slate-600 dark:text-slate-400", children: ["This invitation expires on ", inviteInfo && new Date(inviteInfo.expiresAt).toLocaleDateString()] })] }) }));
};
