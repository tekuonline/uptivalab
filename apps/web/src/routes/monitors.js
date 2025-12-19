import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { StatusBadge } from "../components/status-badge.js";
import { UptimeBar } from "../components/uptime-bar.js";
import { Eye, Trash2, ChevronDown, ChevronUp, RefreshCw, Copy, Edit, X } from "lucide-react";
export const MonitorsRoute = () => {
    const { token } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { data } = useQuery({ queryKey: ["monitors"], queryFn: () => api.listMonitors(token), enabled: Boolean(token) });
    const { data: notifications } = useQuery({ queryKey: ["notifications"], queryFn: () => api.listNotifications(token), enabled: Boolean(token) });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showHttpOptions, setShowHttpOptions] = useState(false);
    const [editingId, setEditingId] = useState(null);
    // Docker state
    const [dockerHosts, setDockerHosts] = useState([]);
    const [selectedDockerHost, setSelectedDockerHost] = useState("");
    const [dockerResources, setDockerResources] = useState(null);
    const [loadingDockerResources, setLoadingDockerResources] = useState(false);
    const [form, setForm] = useState({
        name: "",
        kind: "http",
        interval: 60,
        timeout: 48,
        retries: 0,
        retryInterval: 60,
        description: "",
        groupId: "",
        tagIds: [],
        notificationIds: [],
        // Advanced options
        ignoreTls: false,
        upsideDown: false,
        maxRedirects: 10,
        acceptedStatusCodes: "200-299",
        // HTTP options
        method: "GET",
        headers: "",
        body: "",
        bodyEncoding: "json",
        authMethod: "none",
        authUsername: "",
        authPassword: "",
        // Type-specific fields
        url: "", // http
        host: "", // tcp, ping, certificate
        port: "", // tcp, certificate
        record: "", // dns
        recordType: "A", // dns
        containerName: "", // docker
        connectionString: "", // database
        variant: "postgres", // database
        target: "", // grpc
        heartbeatSeconds: "300", // push
        dockerHostId: "", // docker - selected host
        // Synthetic monitor fields
        browser: "chromium", // synthetic - browser type
        useLocalBrowser: false, // synthetic - use local vs remote
        steps: "", // synthetic - JSON string of steps array
    });
    const buildConfig = (formData) => {
        const baseConfig = {};
        // Add HTTP-specific options if applicable
        if (formData.kind === "http") {
            baseConfig.url = formData.url;
            baseConfig.method = formData.method;
            baseConfig.ignoreTls = formData.ignoreTls;
            baseConfig.maxRedirects = formData.maxRedirects;
            baseConfig.acceptedStatusCodes = formData.acceptedStatusCodes;
            if (formData.headers) {
                try {
                    baseConfig.headers = JSON.parse(formData.headers);
                }
                catch {
                    // Invalid JSON, skip headers
                }
            }
            if (formData.body && (formData.method === "POST" || formData.method === "PUT" || formData.method === "PATCH")) {
                baseConfig.body = formData.body;
                baseConfig.bodyEncoding = formData.bodyEncoding;
            }
            if (formData.authMethod !== "none") {
                baseConfig.authMethod = formData.authMethod;
                baseConfig.authUsername = formData.authUsername;
                baseConfig.authPassword = formData.authPassword;
            }
            baseConfig.upsideDown = formData.upsideDown;
            return baseConfig;
        }
        switch (formData.kind) {
            case "tcp":
                return { host: formData.host, port: parseInt(formData.port, 10) };
            case "ping":
                return { host: formData.host };
            case "dns":
                return { record: formData.record, type: formData.recordType };
            case "docker":
                return { containerName: formData.containerName };
            case "certificate":
                return { host: formData.host, port: parseInt(formData.port, 10) || 443, ignoreTls: formData.ignoreTls };
            case "database":
                return { variant: formData.variant, connectionString: formData.connectionString };
            case "grpc":
                return { target: formData.target };
            case "push":
                return { heartbeatSeconds: parseInt(formData.heartbeatSeconds, 10) };
            case "synthetic":
                try {
                    const steps = JSON.parse(formData.steps || '[]');
                    return {
                        browser: formData.browser || 'chromium',
                        useLocalBrowser: formData.useLocalBrowser,
                        baseUrl: formData.url || undefined,
                        steps,
                    };
                }
                catch (error) {
                    console.error('Failed to parse synthetic steps:', error);
                    alert('Invalid JSON in steps field. Please check your syntax.');
                    return { steps: [] };
                }
            default:
                return baseConfig;
        }
    };
    const resetForm = () => {
        setForm({
            name: "",
            kind: "http",
            interval: 60,
            timeout: 48,
            retries: 0,
            retryInterval: 60,
            description: "",
            groupId: "",
            tagIds: [],
            notificationIds: [],
            ignoreTls: false,
            upsideDown: false,
            maxRedirects: 10,
            acceptedStatusCodes: "200-299",
            method: "GET",
            headers: "",
            body: "",
            bodyEncoding: "json",
            authMethod: "none",
            authUsername: "",
            authPassword: "",
            url: "",
            host: "",
            port: "",
            record: "",
            recordType: "A",
            containerName: "",
            connectionString: "",
            variant: "postgres",
            target: "",
            heartbeatSeconds: "300",
            dockerHostId: "",
            browser: "chromium",
            useLocalBrowser: false,
            steps: "",
        });
    };
    const mutation = useMutation({
        mutationFn: () => {
            const config = buildConfig(form);
            // Ensure interval is at least 15 seconds for synthetic monitors
            let intervalSeconds = form.interval;
            if (form.kind === 'synthetic' && intervalSeconds < 15) {
                intervalSeconds = 15;
                console.warn('Synthetic monitor interval adjusted to minimum 15 seconds');
            }
            const payload = {
                name: form.name,
                interval: intervalSeconds * 1000,
                timeout: form.timeout * 1000,
                kind: form.kind,
                config,
                notificationIds: form.notificationIds,
            };
            if (editingId) {
                return api.updateMonitor(token, editingId, payload);
            }
            else {
                return api.createMonitor(token, payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["monitors"] });
            resetForm();
            setEditingId(null);
        },
    });
    // Load Docker hosts on mount
    useEffect(() => {
        loadDockerHosts();
    }, [token]);
    // Handle edit from location state (when navigating from detail page)
    useEffect(() => {
        const state = location.state;
        if (state?.editMonitor) {
            handleEdit(state.editMonitor);
            // Clear the state to avoid re-triggering on re-render
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state]);
    const loadDockerHosts = async () => {
        try {
            const hosts = await api.listDockerHosts(token);
            setDockerHosts(hosts);
        }
        catch (error) {
            console.error("Failed to load Docker hosts:", error);
        }
    };
    const loadDockerResources = async (dockerHostId) => {
        if (!dockerHostId)
            return;
        setLoadingDockerResources(true);
        try {
            const data = await api.getDockerHostResources(token, dockerHostId);
            setDockerResources(data);
            console.log("Docker resources loaded:", data);
        }
        catch (error) {
            console.error("Failed to load Docker resources:", error);
            alert(`Failed to load Docker resources: ${error instanceof Error ? error.message : error}\n\nCheck:\n- Docker host settings in Settings → Docker Hosts\n- Browser console for detailed errors\n- Docker daemon configuration`);
            setDockerResources(null);
        }
        finally {
            setLoadingDockerResources(false);
        }
    };
    const handleDockerHostChange = (hostId) => {
        setSelectedDockerHost(hostId);
        setForm((prev) => ({ ...prev, dockerHostId: hostId, containerName: "" }));
        if (hostId) {
            loadDockerResources(hostId);
        }
        else {
            setDockerResources(null);
        }
    };
    const deleteMutation = useMutation({
        mutationFn: (id) => api.deleteMonitor(token, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["monitors"] });
        },
    });
    const handleDelete = (monitor) => {
        const confirmMessage = `${t("confirmDelete")} "${monitor.name}"?`;
        if (window.confirm(confirmMessage)) {
            deleteMutation.mutate(monitor.id);
        }
    };
    const handleClone = (monitor) => {
        // Parse config back to form fields
        const config = monitor.config;
        setForm({
            name: `${t("clonedFrom")} ${monitor.name}`,
            kind: monitor.kind,
            interval: Math.round(monitor.interval / 1000),
            timeout: monitor.timeout ? Math.round(monitor.timeout / 1000) : 48,
            retries: monitor.retries ?? 0,
            retryInterval: monitor.retryInterval ? Math.round(monitor.retryInterval / 1000) : 60,
            description: monitor.description || "",
            groupId: "",
            tagIds: [],
            notificationIds: [],
            // Advanced options
            ignoreTls: config?.ignoreTls ?? false,
            upsideDown: config?.upsideDown ?? false,
            maxRedirects: config?.maxRedirects ?? 10,
            acceptedStatusCodes: config?.acceptedStatusCodes ?? "200-299",
            // HTTP options
            method: config?.method ?? "GET",
            headers: config?.headers ? JSON.stringify(config.headers, null, 2) : "",
            body: config?.body ?? "",
            bodyEncoding: config?.bodyEncoding ?? "json",
            authMethod: config?.authMethod ?? "none",
            authUsername: config?.authUsername ?? "",
            authPassword: config?.authPassword ?? "",
            // Type-specific fields
            url: config?.url ?? "",
            host: config?.host ?? "",
            port: config?.port?.toString() ?? "",
            record: config?.record ?? "",
            recordType: config?.recordType ?? "A",
            containerName: config?.containerName ?? "",
            connectionString: config?.connectionString ?? "",
            variant: config?.variant ?? "postgres",
            target: config?.target ?? "",
            heartbeatSeconds: config?.heartbeatSeconds?.toString() ?? "300",
            dockerHostId: config?.dockerHostId ?? "",
            // Synthetic monitor fields
            browser: config?.browser ?? "chromium",
            useLocalBrowser: config?.useLocalBrowser ?? false,
            steps: config?.steps ? JSON.stringify(config.steps, null, 2) : "",
        });
        // Scroll to form
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const handleEdit = (monitor) => {
        setEditingId(monitor.id);
        const config = monitor.config;
        console.log("Editing monitor:", monitor.id);
        console.log("Monitor notificationIds:", monitor.notificationIds);
        console.log("Is array?", Array.isArray(monitor.notificationIds));
        setForm({
            name: monitor.name,
            kind: monitor.kind,
            interval: Math.round(monitor.interval / 1000),
            timeout: monitor.timeout ? Math.round(monitor.timeout / 1000) : 48,
            retries: monitor.retries ?? 0,
            retryInterval: monitor.retryInterval ? Math.round(monitor.retryInterval / 1000) : 60,
            description: monitor.description || "",
            groupId: "",
            tagIds: [],
            notificationIds: Array.isArray(monitor.notificationIds) ? monitor.notificationIds : [],
            // Advanced options
            ignoreTls: config?.ignoreTls ?? false,
            upsideDown: config?.upsideDown ?? false,
            maxRedirects: config?.maxRedirects ?? 10,
            acceptedStatusCodes: config?.acceptedStatusCodes ?? "200-299",
            // HTTP options
            method: config?.method ?? "GET",
            headers: config?.headers ? JSON.stringify(config.headers, null, 2) : "",
            body: config?.body ?? "",
            bodyEncoding: config?.bodyEncoding ?? "json",
            authMethod: config?.authMethod ?? "none",
            authUsername: config?.authUsername ?? "",
            authPassword: config?.authPassword ?? "",
            // Type-specific fields
            url: config?.url ?? "",
            host: config?.host ?? "",
            port: config?.port?.toString() ?? "",
            record: config?.record ?? "",
            recordType: config?.recordType ?? "A",
            containerName: config?.containerName ?? "",
            connectionString: config?.connectionString ?? "",
            variant: config?.variant ?? "postgres",
            target: config?.target ?? "",
            heartbeatSeconds: config?.heartbeatSeconds?.toString() ?? "300",
            dockerHostId: config?.dockerHostId ?? "",
            // Synthetic monitor fields
            browser: config?.browser ?? "chromium",
            useLocalBrowser: config?.useLocalBrowser ?? false,
            steps: config?.steps ? JSON.stringify(config.steps, null, 2) : "",
        });
        // Scroll to form
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const handleCancelEdit = () => {
        setEditingId(null);
        resetForm();
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-white", children: editingId ? t("editMonitor") : t("createNewMonitor") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("createMonitorDescription") })] }), editingId && (_jsxs(Button, { variant: "ghost", onClick: handleCancelEdit, className: "flex items-center gap-2", children: [_jsx(X, { className: "h-4 w-4" }), t("cancel")] }))] }), _jsxs("form", { className: "space-y-6", onSubmit: (event) => {
                            event.preventDefault();
                            mutation.mutate();
                        }, children: [_jsxs("div", { className: "space-y-4", children: [_jsx("h4", { className: "text-sm font-semibold text-slate-900 dark:text-slate-900 dark:text-white uppercase tracking-wider", children: t("general") }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("monitorType") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: form.kind, onChange: (e) => setForm((prev) => ({ ...prev, kind: e.target.value })), children: [_jsx("option", { value: "http", children: "HTTP(s) - HTTP/HTTPS" }), _jsx("option", { value: "tcp", children: "TCP Port" }), _jsx("option", { value: "ping", children: "Ping" }), _jsx("option", { value: "dns", children: "DNS" }), _jsx("option", { value: "docker", children: "Docker Container" }), _jsx("option", { value: "certificate", children: "SSL Certificate" }), _jsx("option", { value: "database", children: "Database" }), _jsx("option", { value: "synthetic", children: "Synthetic Journey" }), _jsx("option", { value: "grpc", children: "gRPC" }), _jsx("option", { value: "push", children: "Push" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("friendlyName") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("monitorNamePlaceholder"), value: form.name, onChange: (e) => setForm((prev) => ({ ...prev, name: e.target.value })), required: true })] })] }), form.kind === "http" && (_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("url") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("urlPlaceholder"), value: form.url, onChange: (e) => setForm((prev) => ({ ...prev, url: e.target.value })), required: true })] })), form.kind === "tcp" && (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("hostname") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("hostInputPlaceholder"), value: form.host, onChange: (e) => setForm((prev) => ({ ...prev, host: e.target.value })), required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("port") }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("portInputPlaceholder"), value: form.port, onChange: (e) => setForm((prev) => ({ ...prev, port: e.target.value })), min: "1", max: "65535", required: true })] })] })), form.kind === "ping" && (_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("hostname") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("dnsHostPlaceholder"), value: form.host, onChange: (e) => setForm((prev) => ({ ...prev, host: e.target.value })), required: true })] })), form.kind === "dns" && (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("hostname") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("hostInputPlaceholder"), value: form.record, onChange: (e) => setForm((prev) => ({ ...prev, record: e.target.value })), required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("dnsRecordType") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: form.recordType, onChange: (e) => setForm((prev) => ({ ...prev, recordType: e.target.value })), children: [_jsx("option", { value: "A", children: "A" }), _jsx("option", { value: "AAAA", children: "AAAA" }), _jsx("option", { value: "CNAME", children: "CNAME" }), _jsx("option", { value: "MX", children: "MX" }), _jsx("option", { value: "TXT", children: "TXT" })] })] })] })), form.kind === "docker" && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: [t("dockerHost"), " ", dockerHosts.length === 0 && _jsxs("span", { className: "text-red-600 dark:text-red-400", children: ["(", t("noHostsConfigured"), ")"] })] }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]", value: form.dockerHostId, onChange: (e) => handleDockerHostChange(e.target.value), required: true, children: [_jsx("option", { value: "", children: t("selectDockerHost") }), dockerHosts.map((host) => (_jsxs("option", { value: host.id, children: [host.name, " (", host.url, ")"] }, host.id)))] }), dockerHosts.length === 0 && (_jsxs("p", { className: "mt-2 text-xs text-yellow-600 dark:text-yellow-400", children: ["\u26A0\uFE0F ", t("addDockerHostWarning")] }))] }), loadingDockerResources && (_jsx("div", { className: "rounded-lg bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20 p-3", children: _jsxs("p", { className: "text-sm text-blue-600 dark:text-blue-400", children: [_jsx(RefreshCw, { className: "inline h-4 w-4 animate-spin mr-2" }), t("loadingDockerResources")] }) })), dockerResources && (_jsxs("div", { className: "rounded-lg bg-green-500/10 border border-green-500/30 dark:border-green-500/20 p-3 space-y-2", children: [_jsxs("p", { className: "text-xs font-semibold text-green-700 dark:text-green-300", children: ["\u2713 ", t("connectedToDocker").replace("{version}", dockerResources.serverVersion)] }), _jsx("p", { className: "text-xs text-green-600 dark:text-green-400", children: t("foundDockerResources").replace("{containers}", String(dockerResources.containers.length)).replace("{networks}", String(dockerResources.networks.length)).replace("{volumes}", String(dockerResources.volumes.length)) })] })), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("containerNameIdLabel") }), dockerResources && dockerResources.containers.length > 0 ? (_jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]", value: form.containerName, onChange: (e) => setForm((prev) => ({ ...prev, containerName: e.target.value })), required: true, children: [_jsx("option", { value: "", children: t("selectContainer") }), dockerResources.containers.map((container) => (_jsxs("option", { value: container.name, children: [container.name, " (", container.image, ") - ", container.state] }, container.id)))] })) : (_jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: "my-container or container-id", value: form.containerName, onChange: (e) => setForm((prev) => ({ ...prev, containerName: e.target.value })), required: true })), _jsx("p", { className: "mt-1 text-xs text-slate-600 dark:text-slate-400", children: dockerResources ? t("selectFromRunningContainers") : t("enterContainerManually") })] })] })), form.kind === "certificate" && (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("hostname") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("certHostPlaceholder"), value: form.host, onChange: (e) => setForm((prev) => ({ ...prev, host: e.target.value })), required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("port") }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("certPortPlaceholder"), value: form.port, onChange: (e) => setForm((prev) => ({ ...prev, port: e.target.value })), min: "1", max: "65535" })] })] })), form.kind === "database" && (_jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("databaseType") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: form.variant, onChange: (e) => setForm((prev) => ({ ...prev, variant: e.target.value })), children: [_jsx("option", { value: "postgres", children: t("postgresqlDb") }), _jsx("option", { value: "mysql", children: t("mysqlDb") }), _jsx("option", { value: "mongodb", children: t("mongodbDb") })] })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("connectionString") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("dbConnectionString"), value: form.connectionString, onChange: (e) => setForm((prev) => ({ ...prev, connectionString: e.target.value })), required: true })] })] })), form.kind === "grpc" && (_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("hostPort") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("grpcTargetPlaceholder"), value: form.target, onChange: (e) => setForm((prev) => ({ ...prev, target: e.target.value })), required: true })] })), form.kind === "push" && (_jsxs(_Fragment, { children: [_jsx("div", { className: "rounded-lg bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20 p-4", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx("div", { className: "text-blue-600 dark:text-blue-400 mt-0.5", children: "\u2139\uFE0F" }), _jsxs("div", { className: "flex-1 text-sm text-slate-600 dark:text-slate-300", children: [_jsx("p", { className: "font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-1", children: t("pushHeartbeatTitle") }), _jsx("p", { className: "mb-2", children: t("pushHeartbeatDescription") }), _jsxs("p", { className: "text-xs text-slate-400", children: ["\uD83D\uDCA1 ", t("pushHeartbeatUseCase")] })] })] }) }), _jsxs("div", { children: [_jsxs("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: [t("heartbeatInterval"), " (", t("seconds"), ")"] }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: "300", value: form.heartbeatSeconds, onChange: (e) => setForm((prev) => ({ ...prev, heartbeatSeconds: e.target.value })), min: "60", required: true }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: t("heartbeatIntervalHelp") })] })] })), form.kind === "synthetic" && (_jsxs(_Fragment, { children: [_jsx("div", { className: "rounded-lg bg-purple-500/10 border border-purple-500/30 dark:border-purple-500/20 p-4", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx("div", { className: "text-purple-600 dark:text-purple-400 mt-0.5", children: "\uD83C\uDFAD" }), _jsxs("div", { className: "flex-1 text-sm text-slate-600 dark:text-slate-300", children: [_jsx("p", { className: "font-semibold text-slate-900 dark:text-white mb-1", children: "Synthetic Journey Monitoring" }), _jsx("p", { className: "mb-2", children: "Create multi-step browser automation tests to monitor complex user flows like login sequences, form submissions, and e-commerce checkouts." }), _jsxs("p", { className: "text-xs text-slate-400", children: ["\uD83D\uDCA1 Uses Playwright to simulate real user interactions. See ", _jsx("a", { href: "https://github.com/tekuonline/uptivaLab/blob/main/SYNTHETIC_MONITORING.md", target: "_blank", rel: "noopener", className: "text-purple-500 hover:underline", children: "SYNTHETIC_MONITORING.md" }), " for examples."] })] })] }) }), _jsx("div", { className: "flex justify-center", children: _jsx("button", { type: "button", onClick: () => navigate('/synthetic-recorder'), className: "inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors", children: "\uD83C\uDFAC Open Visual Step Builder" }) }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: "Base URL (Optional)" }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: "https://example.com", value: form.url, onChange: (e) => setForm((prev) => ({ ...prev, url: e.target.value })) }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "Base URL for relative paths in steps (e.g., /login becomes https://example.com/login)" })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: "Browser Type" }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]", value: form.browser || 'chromium', onChange: (e) => setForm((prev) => ({ ...prev, browser: e.target.value })), children: [_jsx("option", { value: "chromium", children: t("chromium") }), _jsx("option", { value: "firefox", children: t("firefox") }), _jsx("option", { value: "webkit", children: t("webkit") })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: "Browser Mode" }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]", value: form.useLocalBrowser ? 'local' : 'remote', onChange: (e) => setForm((prev) => ({ ...prev, useLocalBrowser: e.target.value === 'local' })), children: [_jsx("option", { value: "remote", children: t("remoteBrowserRecommended") }), _jsx("option", { value: "local", children: t("localBrowser") })] }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: t("remoteUsesPlaywright") })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: ["Journey Steps", _jsx("span", { className: "ml-2 text-slate-500", children: "(JSON Array)" })] }), _jsx("textarea", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white font-mono", placeholder: `[\n  {"action": "goto", "url": "https://example.com/login"},\n  {"action": "fill", "selector": "#email", "value": "test@example.com"},\n  {"action": "fill", "selector": "#password", "value": "secret"},\n  {"action": "click", "selector": "button[type=submit]"},\n  {"action": "waitForSelector", "selector": ".dashboard"}\n]`, value: form.steps || '', onChange: (e) => setForm((prev) => ({ ...prev, steps: e.target.value })), rows: 10, required: true }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["Available actions: goto, click, fill, waitForSelector, screenshot, wait. See ", _jsx("a", { href: "https://github.com/tekuonline/uptivaLab/blob/main/SYNTHETIC_MONITORING.md#available-step-actions", target: "_blank", rel: "noopener", className: "text-purple-500 hover:underline", children: "documentation" }), " for details."] })] }), _jsxs("div", { className: "rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2", children: t("quickExamples") }), _jsxs("div", { className: "space-y-2 text-xs text-slate-600 dark:text-slate-400 font-mono", children: [_jsxs("div", { children: [_jsxs("strong", { children: [t("loginTest"), ":"] }), " goto \u2192 fill(email) \u2192 fill(password) \u2192 click(submit) \u2192 waitForSelector(.dashboard)"] }), _jsxs("div", { children: [_jsxs("strong", { children: [t("searchTest"), ":"] }), " goto \u2192 fill(searchBox) \u2192 click(searchButton) \u2192 waitForSelector(.results)"] }), _jsxs("div", { children: [_jsxs("strong", { children: [t("formTest"), ":"] }), " goto \u2192 fill(name) \u2192 fill(email) \u2192 click(submit) \u2192 waitForSelector(.success)"] })] })] })] })), _jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { children: [_jsxs("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: [t("heartbeatInterval"), _jsxs("span", { className: "ml-2 text-slate-500", children: ["(", t("checkEvery"), " ", form.interval, " ", t("seconds"), ")"] })] }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: form.interval, onChange: (e) => setForm((prev) => ({ ...prev, interval: Number(e.target.value) })), min: "30", max: "86400", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("retries") }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("heartbeatSecondsPlaceholder").replace('300', '0'), value: form.retries, onChange: (e) => setForm((prev) => ({ ...prev, retries: Number(e.target.value) })), min: "0", max: "5" }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: t("retriesHelp") })] }), _jsxs("div", { children: [_jsxs("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: [t("requestTimeout"), _jsxs("span", { className: "ml-2 text-slate-500", children: ["(", t("timeoutAfter"), " ", form.timeout, " ", t("seconds"), ")"] })] }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: form.timeout, onChange: (e) => setForm((prev) => ({ ...prev, timeout: Number(e.target.value) })), min: "1", max: "300", required: true })] })] })] }), form.kind === "http" && (_jsxs("div", { className: "space-y-4", children: [_jsxs("button", { type: "button", onClick: () => setShowAdvanced(!showAdvanced), className: "flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-900 dark:text-white uppercase tracking-wider hover:text-slate-300 transition", children: [showAdvanced ? _jsx(ChevronUp, { className: "h-4 w-4" }) : _jsx(ChevronDown, { className: "h-4 w-4" }), t("advancedOptions")] }), showAdvanced && (_jsxs("div", { className: "space-y-4 border-l-2 border-white/10 pl-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.ignoreTls, onChange: (e) => setForm((prev) => ({ ...prev, ignoreTls: e.target.checked })), className: "h-4 w-4 rounded border-white/20 bg-white/10 text-blue-500" }), _jsx("span", { className: "text-sm text-slate-900 dark:text-white", children: t("ignoreTls") })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.upsideDown, onChange: (e) => setForm((prev) => ({ ...prev, upsideDown: e.target.checked })), className: "h-4 w-4 rounded border-white/20 bg-white/10 text-blue-500" }), _jsx("span", { className: "text-sm text-slate-900 dark:text-white", children: t("upsideDownMode") }), _jsxs("span", { className: "text-xs text-slate-400", children: ["(", t("upsideDownHelp"), ")"] })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("maxRedirects") }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: form.maxRedirects, onChange: (e) => setForm((prev) => ({ ...prev, maxRedirects: Number(e.target.value) })), min: "0", max: "20" }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: t("maxRedirectsHelp") })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("acceptedStatusCodes") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: "200-299", value: form.acceptedStatusCodes, onChange: (e) => setForm((prev) => ({ ...prev, acceptedStatusCodes: e.target.value })) }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: t("acceptedStatusCodesHelp") })] })] })] }))] })), form.kind === "http" && (_jsxs("div", { className: "space-y-4", children: [_jsxs("button", { type: "button", onClick: () => setShowHttpOptions(!showHttpOptions), className: "flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-900 dark:text-white uppercase tracking-wider hover:text-slate-300 transition", children: [showHttpOptions ? _jsx(ChevronUp, { className: "h-4 w-4" }) : _jsx(ChevronDown, { className: "h-4 w-4" }), t("httpOptions")] }), showHttpOptions && (_jsxs("div", { className: "space-y-4 border-l-2 border-white/10 pl-4", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("method") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: form.method, onChange: (e) => setForm((prev) => ({ ...prev, method: e.target.value })), children: [_jsx("option", { value: "GET", children: t("httpMethodGet") }), _jsx("option", { value: "POST", children: t("httpMethodPost") }), _jsx("option", { value: "PUT", children: t("httpMethodPut") }), _jsx("option", { value: "PATCH", children: t("httpMethodPatch") }), _jsx("option", { value: "DELETE", children: t("httpMethodDelete") }), _jsx("option", { value: "HEAD", children: t("httpMethodHead") }), _jsx("option", { value: "OPTIONS", children: t("httpMethodOptions") })] })] }), (form.method === "POST" || form.method === "PUT" || form.method === "PATCH") && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("bodyEncoding") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: form.bodyEncoding, onChange: (e) => setForm((prev) => ({ ...prev, bodyEncoding: e.target.value })), children: [_jsx("option", { value: "json", children: t("bodyEncodingJson") }), _jsx("option", { value: "xml", children: t("bodyEncodingXml") }), _jsx("option", { value: "form", children: t("formData") })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("body") }), _jsx("textarea", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white font-mono", placeholder: t("requestBodyPlaceholder"), value: form.body, onChange: (e) => setForm((prev) => ({ ...prev, body: e.target.value })), rows: 4 })] })] })), _jsxs("div", { children: [_jsxs("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: [t("headers"), " (JSON)"] }), _jsx("textarea", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white font-mono", placeholder: t("headersPlaceholder"), value: form.headers, onChange: (e) => setForm((prev) => ({ ...prev, headers: e.target.value })), rows: 3 }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: t("headersHelp") })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("authMethod") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: form.authMethod, onChange: (e) => setForm((prev) => ({ ...prev, authMethod: e.target.value })), children: [_jsx("option", { value: "none", children: t("none") }), _jsx("option", { value: "basic", children: "HTTP Basic Auth" }), _jsx("option", { value: "bearer", children: "Bearer Token" })] })] }), form.authMethod !== "none" && (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: form.authMethod === "basic" ? t("username") : t("token") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: form.authUsername, onChange: (e) => setForm((prev) => ({ ...prev, authUsername: e.target.value })) })] }), form.authMethod === "basic" && (_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: t("password") }), _jsx("input", { type: "password", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: form.authPassword, onChange: (e) => setForm((prev) => ({ ...prev, authPassword: e.target.value })) })] }))] }))] }))] })), _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsxs("label", { className: "mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400", children: [t("description"), " (", t("optional"), ")"] }), _jsx("textarea", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("descriptionPlaceholder"), value: form.description, onChange: (e) => setForm((prev) => ({ ...prev, description: e.target.value })), rows: 2 })] }) }), notifications && notifications.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "block text-sm font-medium text-slate-300", children: [t("notificationChannels"), " (", t("optional"), ")"] }), _jsx("div", { className: "grid gap-2 sm:grid-cols-2 md:grid-cols-3", children: notifications.map((channel) => (_jsxs("label", { className: "flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer hover:bg-white/10 transition", children: [_jsx("input", { type: "checkbox", checked: form.notificationIds.includes(channel.id), onChange: (e) => {
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            notificationIds: e.target.checked
                                                                ? [...prev.notificationIds, channel.id]
                                                                : prev.notificationIds.filter((id) => id !== channel.id),
                                                        }));
                                                    }, className: "h-4 w-4 rounded border-white/20 bg-white/10 text-blue-500" }), _jsx("span", { className: "text-sm text-slate-900 dark:text-white", children: channel.name }), _jsx("span", { className: "ml-auto text-xs text-slate-400 capitalize", children: channel.type })] }, channel.id))) })] })), _jsx(Button, { type: "submit", disabled: mutation.isPending, className: "w-full md:w-auto", children: mutation.isPending ? t("loading") : editingId ? t("updateMonitor") : t("addMonitor") })] })] }), _jsxs(Card, { children: [_jsx("h3", { className: "mb-4 text-xl font-semibold text-slate-900 dark:text-white", children: t("existingMonitors") }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm text-slate-300", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-widest text-slate-500", children: [_jsx("th", { className: "pb-3", children: t("name") }), _jsx("th", { className: "pb-3", children: t("kind") }), _jsx("th", { className: "pb-3", children: t("interval") }), _jsx("th", { className: "pb-3", children: t("status") }), _jsx("th", { className: "pb-3", children: t("uptime") }), _jsx("th", { className: "pb-3 text-right", children: t("actions") })] }) }), _jsx("tbody", { className: "divide-y divide-white/5", children: data?.map((monitor) => (_jsxs("tr", { children: [_jsx("td", { className: "py-3 font-semibold text-slate-900 dark:text-white", children: monitor.name }), _jsx("td", { className: "py-3 capitalize text-slate-400", children: monitor.kind }), _jsxs("td", { className: "py-3", children: [Math.round(monitor.interval / 1000), "s"] }), _jsx("td", { className: "py-3", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(StatusBadge, { status: monitor.status ?? "pending" }), monitor.inMaintenance && (_jsx("span", { className: "rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400", children: t("maintenance") })), monitor.kind === "certificate" && monitor.meta?.certificateDaysLeft !== undefined && (_jsxs("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold ${monitor.meta.certificateDaysLeft < 7
                                                                ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                                                                : monitor.meta.certificateDaysLeft < 30
                                                                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                                                                    : 'bg-green-500/20 text-green-600 dark:text-green-400'}`, children: ["\uD83D\uDD12 ", monitor.meta.certificateDaysLeft, "d"] }))] }) }), _jsx("td", { className: "py-3", children: _jsx("div", { className: "w-48", children: monitor.recentChecks && monitor.recentChecks.length > 0 ? (_jsx(UptimeBar, { checks: monitor.recentChecks, hours: 24 })) : (_jsx("span", { className: "text-slate-500 text-xs", children: t("noData") })) }) }), _jsx("td", { className: "py-3 text-right", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Link, { to: `/monitors/${monitor.id}`, children: _jsxs(Button, { variant: "ghost", className: "px-2 py-1 text-xs", children: [_jsx(Eye, { className: "h-3 w-3 mr-1" }), t("view")] }) }), _jsxs(Button, { variant: "ghost", className: "px-2 py-1 text-xs", onClick: () => handleEdit(monitor), children: [_jsx(Edit, { className: "h-3 w-3 mr-1" }), t("edit")] }), _jsxs(Button, { variant: "ghost", className: "px-2 py-1 text-xs", onClick: () => handleClone(monitor), children: [_jsx(Copy, { className: "h-3 w-3 mr-1" }), t("clone")] }), _jsxs(Button, { variant: "ghost", className: "px-2 py-1 text-xs", onClick: () => handleDelete(monitor), disabled: deleteMutation.isPending, children: [_jsx(Trash2, { className: "h-3 w-3 mr-1" }), t("delete")] })] }) })] }, monitor.id))) })] }) })] })] }));
};
