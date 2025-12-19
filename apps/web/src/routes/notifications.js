import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { Trash2, Mail, Bell, Webhook, MessageSquare, Send, TestTube, CheckCircle, XCircle, Plus, X } from "lucide-react";
export const NotificationsRoute = () => {
    const { token } = useAuth();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: () => api.listNotifications(token),
        enabled: Boolean(token)
    });
    const [form, setForm] = useState({
        name: "",
        type: "email",
        config: {}
    });
    const [testStatus, setTestStatus] = useState(null);
    const [isTesting, setIsTesting] = useState(false);
    const [emailRecipients, setEmailRecipients] = useState([""]);
    const [errors, setErrors] = useState({});
    const [emailErrors, setEmailErrors] = useState({});
    // Get config fields based on notification type
    const getConfigFields = (type) => {
        switch (type) {
            case "email":
                return [
                    { key: "smtpHost", label: t("smtpHost"), placeholder: "smtp.gmail.com", type: "text" },
                    { key: "smtpPort", label: t("smtpPort"), placeholder: "587", type: "number" },
                    { key: "smtpUser", label: t("smtpUsername"), placeholder: t("smtpUserPlaceholder"), type: "text" },
                    { key: "smtpPass", label: `${t("password")} (SMTP)`, placeholder: "your-app-password", type: "password" },
                    { key: "smtpFrom", label: `From Email (${t("optional")})`, placeholder: "noreply@example.com", type: "email" },
                ];
            case "ntfy":
                return [{ key: "topic", label: t("ntfyTopic"), placeholder: "my-alerts", type: "text" }];
            case "webhook":
                return [{ key: "url", label: t("webhookUrl"), placeholder: "https://example.com/webhook", type: "url" }];
            case "discord":
                return [{ key: "webhookUrl", label: t("discordWebhook"), placeholder: "https://discord.com/api/webhooks/...", type: "url" }];
            case "slack":
                return [{ key: "webhookUrl", label: t("slackWebhook"), placeholder: "https://hooks.slack.com/services/...", type: "url" }];
            case "telegram":
                return [
                    { key: "botToken", label: t("telegramBotToken"), placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11", type: "text" },
                    { key: "chatId", label: t("telegramChatId"), placeholder: "-1001234567890", type: "text" }
                ];
            case "gotify":
                return [
                    { key: "serverUrl", label: t("gotifyServerUrl"), placeholder: "https://gotify.example.com", type: "url" },
                    { key: "appToken", label: t("gotifyAppToken"), placeholder: "AxaBcdEfGhIjKl", type: "text" }
                ];
            case "pushover":
                return [
                    { key: "userKey", label: t("pushoverUserKey"), placeholder: "azGDORePK8gMaC0QOYAMyEEuzJnyUi", type: "text" },
                    { key: "apiToken", label: t("pushoverApiToken"), placeholder: "azGDORePK8gMaC0QOYAMyEEuzJnyUi", type: "text" }
                ];
            case "apprise":
                return [{ key: "url", label: t("appriseUrl"), placeholder: "discord://webhook_id/webhook_token", type: "text" }];
            default:
                return [];
        }
    };
    const createMutation = useMutation({
        mutationFn: (payload) => api.createNotification(token, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            setForm({ name: "", type: "email", config: {} });
            setEmailRecipients([""]);
            setTestStatus(null);
            setErrors({});
            setEmailErrors({});
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => api.deleteNotification(token, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
    const handleDelete = (channel) => {
        if (confirm(`${t("delete")} "${channel.name}"?`)) {
            deleteMutation.mutate(channel.id);
        }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        // Validate form
        const newErrors = {};
        const newEmailErrors = {};
        if (!form.name.trim()) {
            newErrors.name = "Name is required";
        }
        const configFields = getConfigFields(form.type);
        configFields.forEach(field => {
            if (!field.label.includes("optional") && !form.config[field.key]?.trim()) {
                newErrors[field.key] = `${field.label} is required`;
            }
        });
        // Validate email recipients
        if (form.type === "email") {
            emailRecipients.forEach((email, index) => {
                if (index === 0 && !email.trim()) {
                    newEmailErrors[index] = "At least one email recipient is required";
                }
                else if (email.trim() && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                    newEmailErrors[index] = "Invalid email format";
                }
            });
        }
        if (Object.keys(newErrors).length > 0 || Object.keys(newEmailErrors).length > 0) {
            setErrors(newErrors);
            setEmailErrors(newEmailErrors);
            return;
        }
        setErrors({});
        setEmailErrors({});
        const config = {};
        configFields.forEach(field => {
            const value = form.config[field.key];
            if (value) {
                config[field.key] = value;
            }
        });
        // Add email recipients for email type
        if (form.type === "email") {
            const validEmails = emailRecipients.filter(email => email.trim() !== "");
            if (validEmails.length > 0) {
                config.emails = validEmails.join(",");
            }
        }
        createMutation.mutate({ ...form, config });
    };
    const handleTest = async () => {
        const configFields = getConfigFields(form.type);
        const config = {};
        configFields.forEach(field => {
            const value = form.config[field.key];
            if (value) {
                config[field.key] = value;
            }
        });
        // Add email recipients for email type
        if (form.type === "email") {
            const validEmails = emailRecipients.filter(email => email.trim() !== "");
            if (validEmails.length > 0) {
                config.emails = validEmails.join(",");
            }
        }
        setIsTesting(true);
        setTestStatus(null);
        try {
            const data = await api.testNotification(token, { name: form.name || "Test", type: form.type, config });
            if (data.success) {
                setTestStatus({ success: true, message: data.message });
            }
            else {
                setTestStatus({ success: false, message: data.message || t("testFailed") });
            }
        }
        catch (error) {
            setTestStatus({ success: false, message: error instanceof Error ? error.message : "Failed to send test" });
        }
        finally {
            setIsTesting(false);
        }
    };
    const getIcon = (type) => {
        switch (type) {
            case "email": return _jsx(Mail, { className: "h-5 w-5" });
            case "ntfy": return _jsx(Bell, { className: "h-5 w-5" });
            case "webhook": return _jsx(Webhook, { className: "h-5 w-5" });
            case "discord": return _jsx(MessageSquare, { className: "h-5 w-5" });
            case "slack": return _jsx(MessageSquare, { className: "h-5 w-5" });
            case "telegram": return _jsx(Send, { className: "h-5 w-5" });
            default: return _jsx(Bell, { className: "h-5 w-5" });
        }
    };
    if (isLoading)
        return _jsx("p", { className: "text-slate-400", children: t("loading") });
    const configFields = getConfigFields(form.type);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-white", children: t("createNotificationChannel") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("notificationChannelDescription") })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("name") }), _jsx("input", { className: `w-full rounded-2xl border px-4 py-3 text-sm ${errors.name
                                                    ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10 text-slate-900 dark:text-white'
                                                    : 'border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white'}`, placeholder: t("productionAlerts"), value: form.name, onChange: (e) => {
                                                    setForm((prev) => ({ ...prev, name: e.target.value }));
                                                    if (errors.name) {
                                                        setErrors((prev) => { const next = { ...prev }; delete next.name; return next; });
                                                    }
                                                }, required: true }), errors.name && (_jsx("p", { className: "mt-1 text-xs text-red-600 dark:text-red-400", children: errors.name }))] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("type") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: form.type, onChange: (e) => {
                                                    const newType = e.target.value;
                                                    setForm((prev) => ({ ...prev, type: newType, config: {} }));
                                                }, children: [_jsx("option", { value: "email", children: "Email (SMTP)" }), _jsx("option", { value: "ntfy", children: "ntfy.sh" }), _jsx("option", { value: "webhook", children: "Webhook" }), _jsx("option", { value: "discord", children: "Discord" }), _jsx("option", { value: "slack", children: "Slack" }), _jsx("option", { value: "telegram", children: "Telegram" }), _jsx("option", { value: "gotify", children: "Gotify" }), _jsx("option", { value: "pushover", children: "Pushover" }), _jsx("option", { value: "apprise", children: "Apprise" })] })] })] }), form.type === "email" && (_jsxs("div", { className: "rounded-lg bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20 p-4", children: [_jsxs("p", { className: "text-sm text-blue-700 dark:text-blue-200 mb-2 font-semibold", children: ["\uD83D\uDCE7 SMTP ", t("configuration")] }), _jsx("p", { className: "text-xs text-blue-600 dark:text-blue-300/70", children: t("smtpHelpText") }), _jsxs("ul", { className: "text-xs text-blue-600 dark:text-blue-300/70 mt-2 ml-4 space-y-1", children: [_jsxs("li", { children: ["\u2022 Port 587 (TLS/STARTTLS) - ", t("recommended")] }), _jsxs("li", { children: ["\u2022 Port 465 (SSL) - ", t("secureConnection")] }), _jsxs("li", { children: ["\u2022 Port 25 (", t("unencrypted"), ") - ", t("notRecommended")] })] }), _jsxs("p", { className: "text-xs text-blue-600 dark:text-blue-300/70 mt-2", children: ["\uD83D\uDCA1 ", t("gmailNote"), ": ", t("usePort587"), " ", _jsx("a", { href: "https://support.google.com/accounts/answer/185833", target: "_blank", className: "underline hover:text-blue-800 dark:hover:text-blue-200", children: t("appPasswordLink") }), "."] })] })), configFields.map((field) => (_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: field.label }), _jsx("input", { type: field.type, className: `w-full rounded-2xl border px-4 py-3 text-sm ${errors[field.key]
                                            ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10 text-slate-900 dark:text-white'
                                            : 'border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white'}`, placeholder: field.placeholder, value: form.config[field.key] || "", onChange: (e) => {
                                            setForm((prev) => ({
                                                ...prev,
                                                config: { ...prev.config, [field.key]: e.target.value }
                                            }));
                                            if (errors[field.key]) {
                                                setErrors((prev) => { const next = { ...prev }; delete next[field.key]; return next; });
                                            }
                                        }, required: !field.label.includes(t("optional")) }), errors[field.key] && (_jsx("p", { className: "mt-1 text-xs text-red-600 dark:text-red-400", children: errors[field.key] }))] }, field.key))), form.type === "email" && (_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: "Email Recipients" }), _jsxs("div", { className: "space-y-2", children: [emailRecipients.map((email, index) => (_jsx("div", { children: _jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "flex-1", children: [_jsx("input", { type: "email", className: `w-full rounded-2xl border px-4 py-3 text-sm ${emailErrors[index]
                                                                        ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10 text-slate-900 dark:text-white'
                                                                        : 'border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white'}`, placeholder: "recipient@example.com", value: email, onChange: (e) => {
                                                                        const newRecipients = [...emailRecipients];
                                                                        newRecipients[index] = e.target.value;
                                                                        setEmailRecipients(newRecipients);
                                                                        if (emailErrors[index]) {
                                                                            setEmailErrors((prev) => { const next = { ...prev }; delete next[index]; return next; });
                                                                        }
                                                                    }, required: index === 0 }), emailErrors[index] && (_jsx("p", { className: "mt-1 text-xs text-red-600 dark:text-red-400", children: emailErrors[index] }))] }), emailRecipients.length > 1 && (_jsx("button", { type: "button", onClick: () => {
                                                                setEmailRecipients(emailRecipients.filter((_, i) => i !== index));
                                                                setEmailErrors((prev) => { const next = { ...prev }; delete next[index]; return next; });
                                                            }, className: "p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors", children: _jsx(X, { className: "h-4 w-4" }) }))] }) }, index))), _jsxs("button", { type: "button", onClick: () => setEmailRecipients([...emailRecipients, ""]), className: "flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-colors", children: [_jsx(Plus, { className: "h-4 w-4" }), "Add Email Recipient"] })] })] })), testStatus && (_jsxs("div", { className: `rounded-lg p-4 ${testStatus.success
                                    ? 'bg-green-500/10 border border-green-500/30 dark:border-green-500/20'
                                    : 'bg-red-500/10 border border-red-500/30 dark:border-red-500/20'}`, children: [_jsx("div", { className: "flex items-center gap-2", children: testStatus.success ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-600 dark:text-green-400" }), _jsx("p", { className: "text-sm font-semibold text-green-700 dark:text-green-200", children: "Test Successful!" })] })) : (_jsxs(_Fragment, { children: [_jsx(XCircle, { className: "h-5 w-5 text-red-600 dark:text-red-400" }), _jsx("p", { className: "text-sm font-semibold text-red-700 dark:text-red-200", children: "Test Failed" })] })) }), _jsx("p", { className: "text-xs mt-1 text-slate-600 dark:text-slate-400", children: testStatus.message })] })), _jsxs("div", { className: "flex gap-3", children: [_jsxs(Button, { type: "button", variant: "outline", onClick: handleTest, disabled: isTesting || !form.name, className: "gap-2", children: [_jsx(TestTube, { className: "h-4 w-4" }), isTesting ? t("testing") : t("testNotification")] }), _jsx(Button, { type: "submit", disabled: createMutation.isPending, className: "gap-2", children: createMutation.isPending ? t("loading") : t("createNotificationChannel") })] })] })] }), _jsxs(Card, { children: [_jsx("h3", { className: "mb-4 text-xl font-semibold text-slate-900 dark:text-white", children: t("notificationChannels") }), _jsxs("div", { className: "space-y-3", children: [data?.map((channel) => (_jsxs("div", { className: "flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-slate-400", children: getIcon(channel.type) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm uppercase tracking-[0.2em] text-slate-500", children: channel.type }), _jsx("p", { className: "text-lg font-medium text-slate-900 dark:text-white", children: channel.name }), channel.config && Object.keys(channel.config).length > 0 && (_jsx("p", { className: "text-xs text-slate-400", children: Object.entries(channel.config).map(([k, v]) => k === 'botToken' || k === 'apiToken' || k === 'userKey' || k === 'appToken' || k === 'smtpPass'
                                                            ? `${k}: ***`
                                                            : `${k}: ${v}`).join(', ') }))] })] }), _jsx(Button, { variant: "ghost", className: "px-3 py-2 text-xs text-red-400 hover:bg-red-500/10", onClick: () => handleDelete(channel), disabled: deleteMutation.isPending, children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, channel.id))), (data?.length ?? 0) === 0 && _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("noNotifications") })] })] })] }));
};
