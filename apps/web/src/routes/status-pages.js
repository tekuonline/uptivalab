import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { Trash2, ExternalLink, Edit } from "lucide-react";
export const StatusPagesRoute = () => {
    const { token } = useAuth();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        name: "",
        slug: "",
        heroMessage: "",
        monitorIds: [],
        showIncidents: true,
        showMaintenance: true,
        theme: "system",
    });
    const { data, isLoading } = useQuery({
        queryKey: ["status-pages"],
        queryFn: () => api.listStatusPages(token),
        enabled: Boolean(token)
    });
    const { data: monitors } = useQuery({
        queryKey: ["monitors"],
        queryFn: () => api.listMonitors(token),
        enabled: Boolean(token),
    });
    const createMutation = useMutation({
        mutationFn: (payload) => api.createStatusPage(token, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["status-pages"] });
            setForm({ name: "", slug: "", heroMessage: "", monitorIds: [], showIncidents: true, showMaintenance: true, theme: "system" });
            setShowForm(false);
            setEditingId(null);
        },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, payload }) => api.updateStatusPage(token, id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["status-pages"] });
            setForm({ name: "", slug: "", heroMessage: "", monitorIds: [], showIncidents: true, showMaintenance: true, theme: "system" });
            setShowForm(false);
            setEditingId(null);
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => api.deleteStatusPage(token, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["status-pages"] });
        },
    });
    const handleCreate = () => {
        if (editingId) {
            updateMutation.mutate({
                id: editingId,
                payload: {
                    name: form.name,
                    slug: form.slug,
                    heroMessage: form.heroMessage || undefined,
                    monitorIds: form.monitorIds.length > 0 ? form.monitorIds : undefined,
                    showIncidents: form.showIncidents,
                    showMaintenance: form.showMaintenance,
                    theme: form.theme,
                },
            });
        }
        else {
            createMutation.mutate({
                name: form.name,
                slug: form.slug,
                heroMessage: form.heroMessage || undefined,
                monitorIds: form.monitorIds.length > 0 ? form.monitorIds : undefined,
                showIncidents: form.showIncidents,
                showMaintenance: form.showMaintenance,
                theme: form.theme,
            });
        }
    };
    const handleEdit = (page) => {
        // Fetch the full status page with monitors
        api.getStatusPage(token, page.id).then((fullPage) => {
            setEditingId(page.id);
            setForm({
                name: fullPage.name,
                slug: fullPage.slug,
                heroMessage: fullPage.heroMessage || "",
                monitorIds: fullPage.monitors?.map((m) => m.id) || [],
                showIncidents: fullPage.showIncidents ?? true,
                showMaintenance: fullPage.showMaintenance ?? true,
                theme: fullPage.theme || "system",
            });
            setShowForm(true);
        });
    };
    const handleCancel = () => {
        setShowForm(false);
        setEditingId(null);
        setForm({ name: "", slug: "", heroMessage: "", monitorIds: [], showIncidents: true, showMaintenance: true, theme: "system" });
    };
    const handleDelete = (page) => {
        if (confirm(`${t("delete")} "${page.name}"?`)) {
            deleteMutation.mutate(page.id);
        }
    };
    const toggleMonitor = (monitorId) => {
        setForm(prev => ({
            ...prev,
            monitorIds: prev.monitorIds.includes(monitorId)
                ? prev.monitorIds.filter(id => id !== monitorId)
                : [...prev.monitorIds, monitorId]
        }));
    };
    if (isLoading) {
        return _jsx("p", { className: "text-slate-400", children: t("loading") });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(Card, { children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.35em] text-slate-400", children: t("externalFacing") }), _jsx("h3", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("statusPages") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("publishTransparency") })] }), _jsx(Button, { variant: "secondary", onClick: () => {
                                if (showForm) {
                                    handleCancel();
                                }
                                else {
                                    setShowForm(true);
                                }
                            }, children: showForm ? t("cancel") : t("newPage") })] }) }), showForm && (_jsxs(Card, { className: "space-y-4", children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-white", children: editingId ? t("editStatusPage") : t("createStatusPage") }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("pageName") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("pageNamePlaceholder"), value: form.name, onChange: (e) => setForm((prev) => ({ ...prev, name: e.target.value })), required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("slug") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("slugPlaceholder"), value: form.slug, onChange: (e) => setForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })), pattern: "^[a-z0-9-]+$", required: true }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [t("slugDescription"), ": /status/", form.slug || 'your-slug'] })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: [t("heroMessage"), " (", t("optional"), ")"] }), _jsx("textarea", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("heroMessagePlaceholder"), value: form.heroMessage, onChange: (e) => setForm((prev) => ({ ...prev, heroMessage: e.target.value })), maxLength: 280, rows: 2 })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("monitorsToInclude") }), _jsxs("div", { className: "space-y-2", children: [monitors?.map((monitor) => (_jsxs("label", { className: "flex items-center gap-3 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10", children: [_jsx("input", { type: "checkbox", checked: form.monitorIds.includes(monitor.id), onChange: () => toggleMonitor(monitor.id), className: "rounded" }), _jsx("span", { className: "text-sm text-slate-900 dark:text-white", children: monitor.name })] }, monitor.id))), (!monitors || monitors.length === 0) && (_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-500", children: t("noMonitorsAvailable") }))] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block", children: t("displayOptions") }), _jsxs("label", { className: "flex items-center gap-3 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10", children: [_jsx("input", { type: "checkbox", checked: form.showIncidents, onChange: (e) => setForm((prev) => ({ ...prev, showIncidents: e.target.checked })), className: "rounded" }), _jsxs("div", { children: [_jsx("span", { className: "text-sm font-medium text-slate-900 dark:text-white", children: t("showIncidents") }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-500", children: t("showIncidentsDescription") })] })] }), _jsxs("label", { className: "flex items-center gap-3 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10", children: [_jsx("input", { type: "checkbox", checked: form.showMaintenance, onChange: (e) => setForm((prev) => ({ ...prev, showMaintenance: e.target.checked })), className: "rounded" }), _jsxs("div", { children: [_jsx("span", { className: "text-sm font-medium text-slate-900 dark:text-white", children: t("showUpcomingMaintenance") }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-500", children: t("showMaintenanceDescription") })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("theme") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]", value: form.theme, onChange: (e) => setForm((prev) => ({ ...prev, theme: e.target.value })), children: [_jsx("option", { value: "light", children: "Light" }), _jsx("option", { value: "dark", children: "Dark" }), _jsx("option", { value: "system", children: "System" })] }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-500 mt-1", children: "Choose the theme for your public status page" })] }), _jsx(Button, { onClick: handleCreate, disabled: createMutation.isPending || updateMutation.isPending || !form.name || !form.slug, children: (createMutation.isPending || updateMutation.isPending)
                                    ? (editingId ? t("updating") : t("loading"))
                                    : (editingId ? t("updateStatusPage") : t("createStatusPage")) })] })] })), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [data?.map((page) => (_jsxs(Card, { className: "space-y-2", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.4em] text-slate-500", children: page.slug }), _jsx("h4", { className: "text-xl font-semibold text-slate-900 dark:text-white", children: page.name })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => handleEdit(page), disabled: deleteMutation.isPending, children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx(Button, { variant: "ghost", onClick: () => handleDelete(page), disabled: deleteMutation.isPending, children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }), page.heroMessage && _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: page.heroMessage }), _jsx("div", { className: "flex gap-2", children: _jsx(Button, { asChild: true, variant: "ghost", className: "px-0 text-primary", children: _jsxs("a", { href: `/status/${page.slug}`, target: "_blank", rel: "noreferrer", children: [_jsx(ExternalLink, { className: "h-4 w-4 mr-2" }), t("viewPublicPage")] }) }) })] }, page.id))), (data?.length ?? 0) === 0 && !showForm && (_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("noStatusPages") }))] })] }));
};
