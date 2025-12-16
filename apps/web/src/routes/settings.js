import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import { useSettings } from "../providers/settings-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { Settings as SettingsIcon, Globe, Palette, Bell, Shield, Key, Network, Info, Save, Plus, Trash2, Copy, Eye, EyeOff, Check, CheckCircle, XCircle, RefreshCw, Users, Mail, UserPlus } from "lucide-react";
export const SettingsRoute = () => {
    const { t } = useTranslation();
    const { settings: globalSettings, updateSettings: updateGlobalSettings } = useSettings();
    const [activeTab, setActiveTab] = useState("general");
    const [localSettings, setLocalSettings] = useState({});
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    // Security
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    // Update checker
    const [versionInfo, setVersionInfo] = useState(null);
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);
    // API Keys
    const [apiKeys, setApiKeys] = useState([]);
    const [newApiKeyLabel, setNewApiKeyLabel] = useState("");
    const [copiedKey, setCopiedKey] = useState("");
    // Docker Hosts
    const [dockerHosts, setDockerHosts] = useState([]);
    const [newDockerHost, setNewDockerHost] = useState({ name: "", url: "" });
    const [testingDockerHost, setTestingDockerHost] = useState(null);
    const [dockerHostStatus, setDockerHostStatus] = useState({});
    // Remote Browsers
    const [remoteBrowsers, setRemoteBrowsers] = useState([]);
    const [newRemoteBrowser, setNewRemoteBrowser] = useState({ name: "", url: "" });
    const [testingBrowser, setTestingBrowser] = useState(false);
    const [browserTestResult, setBrowserTestResult] = useState(null);
    // Proxies
    const [proxies, setProxies] = useState([]);
    const [newProxy, setNewProxy] = useState({
        name: "",
        protocol: "http",
        host: "",
        port: 8080,
        auth: { username: "", password: "" },
    });
    // Users
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ email: "", password: "", role: "VIEWER" });
    const [invitations, setInvitations] = useState([]);
    const [newInvitation, setNewInvitation] = useState({ email: "", role: "VIEWER", expiresInDays: 7 });
    const [copiedInviteLink, setCopiedInviteLink] = useState("");
    // Cloudflare Tunnel state
    const [tunnelStatus, setTunnelStatus] = useState(null);
    const [tunnelLoading, setTunnelLoading] = useState(false);
    // Fetch Cloudflare Tunnel status
    const fetchTunnelStatus = async () => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/cloudflare-tunnel/status", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setTunnelStatus(await res.json());
            }
        }
        catch (error) {
            console.error("Failed to fetch tunnel status:", error);
        }
    };
    // Control Cloudflare Tunnel
    const controlTunnel = async (action) => {
        setTunnelLoading(true);
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch(`/api/cloudflare-tunnel/${action}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const result = await res.json();
                alert(result.message);
                await fetchTunnelStatus();
            }
            else {
                const error = await res.json();
                alert(error.message || `Failed to ${action} tunnel`);
            }
        }
        catch (error) {
            console.error(`Failed to ${action} tunnel:`, error);
            alert(`Failed to ${action} tunnel`);
        }
        finally {
            setTunnelLoading(false);
        }
    };
    useEffect(() => {
        // Initialize local settings from global context
        setLocalSettings(globalSettings);
        loadApiKeys();
        loadDockerHosts();
        loadRemoteBrowsers();
        loadProxies();
        loadUsers();
        loadInvitations();
        fetchTunnelStatus();
    }, [globalSettings]);
    const saveSettings = async () => {
        setLoading(true);
        const tokenChanged = localSettings.cloudflareTunnelToken !== globalSettings.cloudflareTunnelToken;
        try {
            await updateGlobalSettings(localSettings);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            // Restart tunnel if token was changed and tunnel is installed
            if (tokenChanged && tunnelStatus?.installed && localSettings.cloudflareTunnelToken) {
                await controlTunnel("restart");
            }
            else if (tokenChanged) {
                // Refresh status if token changed but tunnel wasn't running
                await fetchTunnelStatus();
            }
        }
        catch (error) {
            console.error("Failed to save settings:", error);
        }
        finally {
            setLoading(false);
        }
    };
    const changePassword = async () => {
        if (newPassword !== repeatPassword) {
            alert(t("passwordsDontMatch"));
            return;
        }
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            if (res.ok) {
                alert(t("passwordChangedSuccess"));
                setCurrentPassword("");
                setNewPassword("");
                setRepeatPassword("");
            }
            else {
                const data = await res.json();
                alert(data.message || t("failedToChangePassword"));
            }
        }
        catch (error) {
            console.error("Failed to change password:", error);
        }
    };
    const loadApiKeys = async () => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/api-keys", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setApiKeys(await res.json());
            }
        }
        catch (error) {
            console.error("Failed to load API keys:", error);
        }
    };
    const createApiKey = async () => {
        if (!newApiKeyLabel.trim())
            return;
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/api-keys", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ label: newApiKeyLabel }),
            });
            if (res.ok) {
                const newKey = await res.json();
                setApiKeys([...apiKeys, newKey]);
                setNewApiKeyLabel("");
            }
        }
        catch (error) {
            console.error("Failed to create API key:", error);
        }
    };
    const deleteApiKey = async (id) => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            await fetch(`/api/settings/api-keys/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            setApiKeys(apiKeys.filter((k) => k.id !== id));
        }
        catch (error) {
            console.error("Failed to delete API key:", error);
        }
    };
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        setTimeout(() => setCopiedKey(""), 2000);
    };
    const loadDockerHosts = async () => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/docker-hosts", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setDockerHosts(await res.json());
            }
        }
        catch (error) {
            console.error("Failed to load docker hosts:", error);
        }
    };
    const addDockerHost = async () => {
        if (!newDockerHost.name || !newDockerHost.url)
            return;
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/docker-hosts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newDockerHost),
            });
            if (res.ok) {
                const host = await res.json();
                setDockerHosts([...dockerHosts, host]);
                setNewDockerHost({ name: "", url: "" });
            }
        }
        catch (error) {
            console.error("Failed to add docker host:", error);
        }
    };
    const deleteDockerHost = async (id) => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            await fetch(`/api/settings/docker-hosts/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            setDockerHosts(dockerHosts.filter((h) => h.id !== id));
            setDockerHostStatus((prev) => {
                const newStatus = { ...prev };
                delete newStatus[id];
                return newStatus;
            });
        }
        catch (error) {
            console.error("Failed to delete docker host:", error);
        }
    };
    const testDockerHost = async (id) => {
        setTestingDockerHost(id);
        setDockerHostStatus((prev) => ({ ...prev, [id]: { testing: true } }));
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch(`/api/settings/docker-hosts/${id}/test`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDockerHostStatus((prev) => ({
                    ...prev,
                    [id]: { success: true, version: data.serverVersion, testing: false }
                }));
            }
            else {
                const error = await res.text();
                setDockerHostStatus((prev) => ({
                    ...prev,
                    [id]: { success: false, error, testing: false }
                }));
            }
        }
        catch (error) {
            setDockerHostStatus((prev) => ({
                ...prev,
                [id]: { success: false, error: String(error), testing: false }
            }));
        }
        finally {
            setTestingDockerHost(null);
        }
    };
    const loadRemoteBrowsers = async () => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/remote-browsers", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setRemoteBrowsers(await res.json());
            }
        }
        catch (error) {
            console.error("Failed to load remote browsers:", error);
        }
    };
    const addRemoteBrowser = async () => {
        if (!newRemoteBrowser.name || !newRemoteBrowser.url)
            return;
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/remote-browsers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newRemoteBrowser),
            });
            if (res.ok) {
                const browser = await res.json();
                setRemoteBrowsers([...remoteBrowsers, browser]);
                setNewRemoteBrowser({ name: "", url: "" });
            }
        }
        catch (error) {
            console.error("Failed to add remote browser:", error);
        }
    };
    const testRemoteBrowser = async () => {
        if (!newRemoteBrowser.url) {
            setBrowserTestResult({ success: false, message: "Please enter a WebSocket URL" });
            return;
        }
        setTestingBrowser(true);
        setBrowserTestResult(null);
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/remote-browsers/test", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ url: newRemoteBrowser.url }),
            });
            const result = await res.json();
            if (res.ok && result.success) {
                setBrowserTestResult({ success: true, message: result.message || "Connection successful!" });
            }
            else {
                setBrowserTestResult({ success: false, message: result.message || t("connectionFailed") });
            }
        }
        catch (error) {
            setBrowserTestResult({ success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
        }
        finally {
            setTestingBrowser(false);
        }
    };
    const deleteRemoteBrowser = async (id) => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            await fetch(`/api/settings/remote-browsers/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            setRemoteBrowsers(remoteBrowsers.filter((b) => b.id !== id));
        }
        catch (error) {
            console.error("Failed to delete remote browser:", error);
        }
    };
    const loadProxies = async () => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/proxies", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setProxies(await res.json());
            }
        }
        catch (error) {
            console.error("Failed to load proxies:", error);
        }
    };
    const addProxy = async () => {
        if (!newProxy.name || !newProxy.host || !newProxy.port)
            return;
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/proxies", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newProxy),
            });
            if (res.ok) {
                const proxy = await res.json();
                setProxies([...proxies, proxy]);
                setNewProxy({
                    name: "",
                    protocol: "http",
                    host: "",
                    port: 8080,
                    auth: { username: "", password: "" },
                });
            }
        }
        catch (error) {
            console.error("Failed to add proxy:", error);
        }
    };
    const deleteProxy = async (id) => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            await fetch(`/api/settings/proxies/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            setProxies(proxies.filter((p) => p.id !== id));
        }
        catch (error) {
            console.error("Failed to delete proxy:", error);
        }
    };
    // User management functions
    const loadUsers = async () => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/users", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setUsers(await res.json());
            }
        }
        catch (error) {
            console.error("Failed to load users:", error);
        }
    };
    const createUser = async () => {
        if (!newUser.email || !newUser.password)
            return;
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newUser),
            });
            if (res.ok) {
                await loadUsers();
                setNewUser({ email: "", password: "", role: "VIEWER" });
            }
            else {
                const data = await res.json();
                alert(data.message || "Failed to create user");
            }
        }
        catch (error) {
            console.error("Failed to create user:", error);
        }
    };
    const deleteUser = async (id) => {
        if (!confirm("Are you sure you want to delete this user?"))
            return;
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch(`/api/users/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setUsers(users.filter((user) => user.id !== id));
            }
            else {
                const data = await res.json();
                alert(data.message || "Failed to delete user");
            }
        }
        catch (error) {
            console.error("Failed to delete user:", error);
        }
    };
    const updateUserRole = async (id, role) => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch(`/api/users/${id}/role`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role }),
            });
            if (res.ok) {
                setUsers(users.map((user) => (user.id === id ? { ...user, role } : user)));
            }
            else {
                const data = await res.json();
                alert(data.message || "Failed to update user role");
            }
        }
        catch (error) {
            console.error("Failed to update user role:", error);
        }
    };
    // Invitation management functions
    const loadInvitations = async () => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/invitations", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setInvitations(await res.json());
            }
        }
        catch (error) {
            console.error("Failed to load invitations:", error);
        }
    };
    const createInvitation = async () => {
        if (!newInvitation.email)
            return;
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/invitations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newInvitation),
            });
            if (res.ok) {
                const invitation = await res.json();
                await loadInvitations();
                setNewInvitation({ email: "", role: "VIEWER", expiresInDays: 7 });
                // Show invitation link
                const inviteLink = `${window.location.origin}/invite/${invitation.token}`;
                navigator.clipboard.writeText(inviteLink);
                setCopiedInviteLink(invitation.id);
                setTimeout(() => setCopiedInviteLink(""), 3000);
                alert(`Invitation created! Link copied to clipboard:\n${inviteLink}`);
            }
            else {
                const data = await res.json();
                alert(data.message || "Failed to create invitation");
            }
        }
        catch (error) {
            console.error("Failed to create invitation:", error);
        }
    };
    const deleteInvitation = async (id) => {
        try {
            const token = localStorage.getItem("uptivalab.token");
            await fetch(`/api/invitations/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            setInvitations(invitations.filter((inv) => inv.id !== id));
        }
        catch (error) {
            console.error("Failed to delete invitation:", error);
        }
    };
    const copyInviteLink = (token, id) => {
        const inviteLink = `${window.location.origin}/invite/${token}`;
        navigator.clipboard.writeText(inviteLink);
        setCopiedInviteLink(id);
        setTimeout(() => setCopiedInviteLink(""), 2000);
    };
    const checkForUpdates = async () => {
        setCheckingUpdates(true);
        try {
            const token = localStorage.getItem("uptivalab.token");
            const res = await fetch("/api/settings/check-updates", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setVersionInfo(data);
            }
        }
        catch (error) {
            console.error("Failed to check for updates:", error);
        }
        finally {
            setCheckingUpdates(false);
        }
    };
    const tabs = [
        { id: "general", label: t("general"), icon: SettingsIcon },
        { id: "appearance", label: t("appearance"), icon: Palette },
        { id: "notifications", label: t("notifications"), icon: Bell },
        { id: "reverse-proxy", label: t("reverseProxy"), icon: Network },
        { id: "docker-hosts", label: t("dockerHosts"), icon: Network },
        { id: "remote-browsers", label: t("remoteBrowsers"), icon: Globe },
        { id: "security", label: t("security"), icon: Shield },
        { id: "api-keys", label: t("apiKeys"), icon: Key },
        { id: "users", label: t("userManagement"), icon: Users },
        { id: "proxies", label: t("proxies"), icon: Network },
        { id: "about", label: t("about"), icon: Info },
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900 dark:text-white", children: t("settings") }), activeTab !== "security" && activeTab !== "api-keys" && activeTab !== "docker-hosts" &&
                        activeTab !== "remote-browsers" && activeTab !== "proxies" && activeTab !== "users" && (_jsxs(Button, { onClick: saveSettings, disabled: loading, className: "gap-2", children: [saved ? _jsx(Check, { className: "h-4 w-4" }) : _jsx(Save, { className: "h-4 w-4" }), saved ? t("saved") : t("save")] }))] }), _jsx("div", { className: "glass-panel rounded-3xl p-6", children: _jsxs("div", { className: "grid grid-cols-12 gap-6", children: [_jsx("div", { className: "col-span-3 space-y-1", children: tabs.map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${activeTab === tab.id
                                    ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`, children: [_jsx(tab.icon, { className: "h-5 w-5" }), tab.label] }, tab.id))) }), _jsxs("div", { className: "col-span-9 space-y-6", children: [activeTab === "general" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("general") }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { children: t("displayTimezone") }), _jsxs("select", { value: localSettings.displayTimezone || "UTC", onChange: (e) => setLocalSettings({ ...localSettings, displayTimezone: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "UTC", children: "UTC (Coordinated Universal Time)" }), _jsx("option", { value: "America/New_York", children: "America/New York (EST/EDT)" }), _jsx("option", { value: "America/Chicago", children: "America/Chicago (CST/CDT)" }), _jsx("option", { value: "America/Denver", children: "America/Denver (MST/MDT)" }), _jsx("option", { value: "America/Los_Angeles", children: "America/Los Angeles (PST/PDT)" }), _jsx("option", { value: "America/Phoenix", children: "America/Phoenix (MST)" }), _jsx("option", { value: "America/Toronto", children: "America/Toronto (EST/EDT)" }), _jsx("option", { value: "America/Vancouver", children: "America/Vancouver (PST/PDT)" }), _jsx("option", { value: "Europe/London", children: "Europe/London (GMT/BST)" }), _jsx("option", { value: "Europe/Paris", children: "Europe/Paris (CET/CEST)" }), _jsx("option", { value: "Europe/Berlin", children: "Europe/Berlin (CET/CEST)" }), _jsx("option", { value: "Europe/Rome", children: "Europe/Rome (CET/CEST)" }), _jsx("option", { value: "Europe/Madrid", children: "Europe/Madrid (CET/CEST)" }), _jsx("option", { value: "Europe/Amsterdam", children: "Europe/Amsterdam (CET/CEST)" }), _jsx("option", { value: "Europe/Brussels", children: "Europe/Brussels (CET/CEST)" }), _jsx("option", { value: "Europe/Vienna", children: "Europe/Vienna (CET/CEST)" }), _jsx("option", { value: "Europe/Stockholm", children: "Europe/Stockholm (CET/CEST)" }), _jsx("option", { value: "Europe/Warsaw", children: "Europe/Warsaw (CET/CEST)" }), _jsx("option", { value: "Europe/Athens", children: "Europe/Athens (EET/EEST)" }), _jsx("option", { value: "Europe/Moscow", children: "Europe/Moscow (MSK)" }), _jsx("option", { value: "Asia/Dubai", children: "Asia/Dubai (GST)" }), _jsx("option", { value: "Asia/Kolkata", children: "Asia/Kolkata (IST)" }), _jsx("option", { value: "Asia/Bangkok", children: "Asia/Bangkok (ICT)" }), _jsx("option", { value: "Asia/Singapore", children: "Asia/Singapore (SGT)" }), _jsx("option", { value: "Asia/Hong_Kong", children: "Asia/Hong Kong (HKT)" }), _jsx("option", { value: "Asia/Shanghai", children: "Asia/Shanghai (CST)" }), _jsx("option", { value: "Asia/Tokyo", children: "Asia/Tokyo (JST)" }), _jsx("option", { value: "Asia/Seoul", children: "Asia/Seoul (KST)" }), _jsx("option", { value: "Australia/Sydney", children: "Australia/Sydney (AEDT/AEST)" }), _jsx("option", { value: "Australia/Melbourne", children: "Australia/Melbourne (AEDT/AEST)" }), _jsx("option", { value: "Australia/Brisbane", children: "Australia/Brisbane (AEST)" }), _jsx("option", { value: "Australia/Perth", children: "Australia/Perth (AWST)" }), _jsx("option", { value: "Pacific/Auckland", children: "Pacific/Auckland (NZDT/NZST)" }), _jsx("option", { value: "Pacific/Fiji", children: "Pacific/Fiji (FJT)" }), _jsx("option", { value: "Pacific/Honolulu", children: "Pacific/Honolulu (HST)" })] }), _jsx("p", { className: "mt-1 text-xs text-slate-600 dark:text-slate-400", children: "Timezone for displaying dates and times in the UI" })] }), _jsxs("div", { children: [_jsx(Label, { children: t("serverTimezone") }), _jsxs("select", { value: localSettings.serverTimezone || "UTC", onChange: (e) => setLocalSettings({ ...localSettings, serverTimezone: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "UTC", children: "UTC (Coordinated Universal Time)" }), _jsx("option", { value: "America/New_York", children: "America/New York (EST/EDT)" }), _jsx("option", { value: "America/Chicago", children: "America/Chicago (CST/CDT)" }), _jsx("option", { value: "America/Denver", children: "America/Denver (MST/MDT)" }), _jsx("option", { value: "America/Los_Angeles", children: "America/Los Angeles (PST/PDT)" }), _jsx("option", { value: "America/Phoenix", children: "America/Phoenix (MST)" }), _jsx("option", { value: "America/Toronto", children: "America/Toronto (EST/EDT)" }), _jsx("option", { value: "America/Vancouver", children: "America/Vancouver (PST/PDT)" }), _jsx("option", { value: "Europe/London", children: "Europe/London (GMT/BST)" }), _jsx("option", { value: "Europe/Paris", children: "Europe/Paris (CET/CEST)" }), _jsx("option", { value: "Europe/Berlin", children: "Europe/Berlin (CET/CEST)" }), _jsx("option", { value: "Europe/Rome", children: "Europe/Rome (CET/CEST)" }), _jsx("option", { value: "Europe/Madrid", children: "Europe/Madrid (CET/CEST)" }), _jsx("option", { value: "Europe/Amsterdam", children: "Europe/Amsterdam (CET/CEST)" }), _jsx("option", { value: "Europe/Brussels", children: "Europe/Brussels (CET/CEST)" }), _jsx("option", { value: "Europe/Vienna", children: "Europe/Vienna (CET/CEST)" }), _jsx("option", { value: "Europe/Stockholm", children: "Europe/Stockholm (CET/CEST)" }), _jsx("option", { value: "Europe/Warsaw", children: "Europe/Warsaw (CET/CEST)" }), _jsx("option", { value: "Europe/Athens", children: "Europe/Athens (EET/EEST)" }), _jsx("option", { value: "Europe/Moscow", children: "Europe/Moscow (MSK)" }), _jsx("option", { value: "Asia/Dubai", children: "Asia/Dubai (GST)" }), _jsx("option", { value: "Asia/Kolkata", children: "Asia/Kolkata (IST)" }), _jsx("option", { value: "Asia/Bangkok", children: "Asia/Bangkok (ICT)" }), _jsx("option", { value: "Asia/Singapore", children: "Asia/Singapore (SGT)" }), _jsx("option", { value: "Asia/Hong_Kong", children: "Asia/Hong Kong (HKT)" }), _jsx("option", { value: "Asia/Shanghai", children: "Asia/Shanghai (CST)" }), _jsx("option", { value: "Asia/Tokyo", children: "Asia/Tokyo (JST)" }), _jsx("option", { value: "Asia/Seoul", children: "Asia/Seoul (KST)" }), _jsx("option", { value: "Australia/Sydney", children: "Australia/Sydney (AEDT/AEST)" }), _jsx("option", { value: "Australia/Melbourne", children: "Australia/Melbourne (AEDT/AEST)" }), _jsx("option", { value: "Australia/Brisbane", children: "Australia/Brisbane (AEST)" }), _jsx("option", { value: "Australia/Perth", children: "Australia/Perth (AWST)" }), _jsx("option", { value: "Pacific/Auckland", children: "Pacific/Auckland (NZDT/NZST)" }), _jsx("option", { value: "Pacific/Fiji", children: "Pacific/Fiji (FJT)" }), _jsx("option", { value: "Pacific/Honolulu", children: "Pacific/Honolulu (HST)" })] }), _jsx("p", { className: "mt-1 text-xs text-slate-600 dark:text-slate-400", children: "Timezone for the server. Requires API restart to take effect." })] }), _jsxs("div", { children: [_jsx(Label, { children: t("searchEngineVisibility") }), _jsxs("select", { value: localSettings.searchEngineVisibility || "allow", onChange: (e) => setLocalSettings({ ...localSettings, searchEngineVisibility: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "allow", children: t("allowIndexing") }), _jsx("option", { value: "discourage", children: t("discourageIndexing") })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t("entryPage") }), _jsxs("select", { value: localSettings.entryPage || "dashboard", onChange: (e) => setLocalSettings({ ...localSettings, entryPage: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "dashboard", children: t("dashboard") }), _jsx("option", { value: "status", children: t("statusPage") })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t("primaryBaseUrl") }), _jsx(Input, { value: localSettings.primaryBaseUrl || "", onChange: (e) => setLocalSettings({ ...localSettings, primaryBaseUrl: e.target.value }), placeholder: t("primaryBaseUrlPlaceholder") }), _jsx("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-400", children: t("primaryBaseUrlDescription") })] }), _jsxs("div", { children: [_jsx(Label, { children: t("steamApiKey") }), _jsx(Input, { value: localSettings.steamApiKey || "", onChange: (e) => setLocalSettings({ ...localSettings, steamApiKey: e.target.value }), placeholder: t("steamApiKeyPlaceholder") }), _jsxs("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-400", children: [t("steamApiKeyDescription"), " ", _jsx("a", { href: "https://steamcommunity.com/dev", target: "_blank", rel: "noopener noreferrer", className: "text-blue-400 hover:underline", children: "https://steamcommunity.com/dev" })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t("enableNscd") }), _jsx("p", { className: "mb-2 text-sm text-slate-600 dark:text-slate-400", children: t("enableNscdDescription") }), _jsxs("select", { value: localSettings.enableNscd ? "true" : "false", onChange: (e) => setLocalSettings({ ...localSettings, enableNscd: e.target.value === "true" }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "true", children: t("enable") }), _jsx("option", { value: "false", children: t("disable") })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t("chromeExecutable") }), _jsx(Input, { value: localSettings.chromeExecutable || "", onChange: (e) => setLocalSettings({ ...localSettings, chromeExecutable: e.target.value }), placeholder: t("chromeExecutablePlaceholder") }), _jsx("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-400", children: t("chromeExecutableDescription") })] })] })] })), activeTab === "appearance" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("appearance") }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { children: t("language") }), _jsxs("select", { value: localSettings.language || "en", onChange: (e) => setLocalSettings({ ...localSettings, language: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "en", children: "English" }), _jsx("option", { value: "es", children: "Espa\u00F1ol" }), _jsx("option", { value: "fr", children: "Fran\u00E7ais" }), _jsx("option", { value: "de", children: "Deutsch" }), _jsx("option", { value: "ja", children: "\u65E5\u672C\u8A9E" }), _jsx("option", { value: "zh", children: "\u4E2D\u6587" })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t("theme") }), _jsxs("select", { value: localSettings.theme || "auto", onChange: async (e) => {
                                                                const newSettings = { ...localSettings, theme: e.target.value };
                                                                setLocalSettings(newSettings);
                                                                // Auto-save theme setting
                                                                try {
                                                                    await updateGlobalSettings(newSettings);
                                                                }
                                                                catch (error) {
                                                                    console.error("Failed to save theme setting:", error);
                                                                }
                                                            }, className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-slate-900 dark:text-white dark:bg-white/5 dark:text-slate-900 dark:text-white bg-slate-100 text-slate-900", children: [_jsx("option", { value: "auto", children: t("autoFollowSystem") }), _jsx("option", { value: "light", children: t("light") }), _jsx("option", { value: "dark", children: t("dark") })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t("heartbeatBarTheme") }), _jsxs("select", { value: localSettings.heartbeatBarTheme || "normal", onChange: (e) => setLocalSettings({ ...localSettings, heartbeatBarTheme: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "normal", children: t("normal") }), _jsx("option", { value: "bottom-up", children: t("bottomUp") })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "checkbox", id: "showElapsedTime", checked: localSettings.showElapsedTime || false, onChange: (e) => setLocalSettings({ ...localSettings, showElapsedTime: e.target.checked }), className: "h-5 w-5 rounded border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5" }), _jsx(Label, { htmlFor: "showElapsedTime", className: "cursor-pointer", children: t("showElapsedTimeDescription") })] })] })] })), activeTab === "reverse-proxy" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("reverseProxy") }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-4", children: [_jsx("h3", { className: "mb-2 font-semibold text-blue-600 dark:text-blue-400", children: t("cloudflareTunnel") }), _jsx("p", { className: "mb-3 text-sm text-slate-600 dark:text-slate-300", children: t("cloudflareTunnelConfig") }), _jsx(Label, { children: t("cloudflareTunnelToken") }), _jsx(Input, { type: "password", value: localSettings.cloudflareTunnelToken || "", onChange: (e) => setLocalSettings({ ...localSettings, cloudflareTunnelToken: e.target.value }), placeholder: t("cloudflareTunnelTokenPlaceholder") }), tunnelStatus && (_jsxs("div", { className: "mt-3 flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Status:" }), _jsxs("span", { className: `inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${tunnelStatus.running
                                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"}`, children: [_jsx("span", { className: `h-2 w-2 rounded-full ${tunnelStatus.running ? "bg-green-500" : "bg-slate-400"}` }), tunnelStatus.running ? "Running" : "Stopped"] })] }), _jsx("div", { className: "flex gap-2", children: !tunnelStatus.running ? (_jsx("button", { type: "button", onClick: () => controlTunnel("start"), disabled: tunnelLoading || !localSettings.cloudflareTunnelToken, className: "rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed", children: tunnelLoading ? "Starting..." : "Start" })) : (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => controlTunnel("stop"), disabled: tunnelLoading, className: "rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed", children: tunnelLoading ? "Stopping..." : "Stop" }), _jsx("button", { type: "button", onClick: () => controlTunnel("restart"), disabled: tunnelLoading, className: "rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed", children: tunnelLoading ? "Restarting..." : "Restart" })] })) })] })), _jsx("p", { className: "mt-2 text-xs text-slate-600 dark:text-slate-400", children: "\uD83D\uDCA1 To get a tunnel token:" }), _jsxs("ol", { className: "mt-1 ml-4 list-decimal text-xs text-slate-600 dark:text-slate-400 space-y-1", children: [_jsxs("li", { children: ["Visit ", _jsx("a", { href: "https://one.dash.cloudflare.com/", target: "_blank", rel: "noopener", className: "text-blue-600 dark:text-blue-400 hover:underline", children: "Cloudflare Zero Trust Dashboard" })] }), _jsx("li", { children: "Go to Networks \u2192 Tunnels" }), _jsx("li", { children: "Create a new tunnel or use existing one" }), _jsx("li", { children: "Copy the tunnel token and paste it above" })] }), _jsxs("p", { className: "mt-2 text-xs text-slate-600 dark:text-slate-400", children: ["\uD83D\uDCDA ", _jsx("a", { href: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/", target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline", children: "Official Cloudflare Tunnel Documentation" })] }), _jsx("div", { className: "mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3", children: _jsxs("p", { className: "text-xs text-yellow-700 dark:text-yellow-300", children: ["\u26A0\uFE0F ", _jsx("strong", { children: "Note:" }), " Enter your Cloudflare Tunnel token above and save settings. The tunnel will start automatically. Use the controls above to start/stop/restart the tunnel as needed."] }) })] }), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-slate-500/20 bg-slate-100 dark:bg-slate-500/10 p-4", children: [_jsx("h3", { className: "mb-2 font-semibold text-slate-900 dark:text-white", children: t("otherSoftware") }), _jsx("p", { className: "mb-3 text-sm text-slate-600 dark:text-slate-300", children: t("otherSoftwareExample") }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: [t("pleaseRead"), " ", _jsx("a", { href: "https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy", target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline", children: "https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t("httpHeaders") }), _jsx("textarea", { value: localSettings.reverseProxyHeaders || "", onChange: (e) => setLocalSettings({ ...localSettings, reverseProxyHeaders: e.target.value }), placeholder: t("headerPlaceholder"), rows: 4, className: "w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4 text-slate-900 dark:text-white" })] }), _jsxs("div", { children: [_jsx(Label, { children: t("trustProxy") }), _jsxs("select", { value: localSettings.trustProxy ? "yes" : "no", onChange: (e) => setLocalSettings({ ...localSettings, trustProxy: e.target.value === "yes" }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "yes", children: t("yes") }), _jsx("option", { value: "no", children: t("no") })] }), _jsx("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-400", children: t("trustProxyDescription") })] })] })] })), activeTab === "docker-hosts" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("dockerHosts") }), dockerHosts.length === 0 ? (_jsx("div", { className: "rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center", children: _jsx("p", { className: "text-slate-400", children: "Not available, please set up." }) })) : (_jsx("div", { className: "space-y-2", children: dockerHosts.map((host) => (_jsxs("div", { className: "flex items-start justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: host.name }), dockerHostStatus[host.id]?.success && (_jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400", children: [_jsx(CheckCircle, { className: "w-3 h-3" }), "Connected"] })), dockerHostStatus[host.id]?.success === false && (_jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400", children: [_jsx(XCircle, { className: "w-3 h-3" }), "Failed"] }))] }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400 break-all", children: host.url }), dockerHostStatus[host.id]?.version && (_jsxs("p", { className: "text-xs text-green-600 dark:text-green-400 mt-1", children: ["Docker ", dockerHostStatus[host.id].version] })), dockerHostStatus[host.id]?.error && (_jsxs("p", { className: "text-xs text-red-600 dark:text-red-400 mt-1", children: ["Error: ", dockerHostStatus[host.id].error] }))] }), _jsxs("div", { className: "flex items-center gap-2 ml-4 shrink-0", children: [_jsx(Button, { variant: "ghost", onClick: () => testDockerHost(host.id), disabled: testingDockerHost === host.id, className: "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 gap-2", children: testingDockerHost === host.id ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "h-4 w-4 animate-spin" }), "Testing..."] })) : (_jsxs(_Fragment, { children: [_jsx(Network, { className: "h-4 w-4" }), "Test"] })) }), _jsx(Button, { variant: "ghost", onClick: () => deleteDockerHost(host.id), className: "text-red-400 hover:text-red-300", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }, host.id))) })), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsx("h3", { className: "mb-4 font-semibold text-slate-900 dark:text-white", children: t("addDockerHost") }), _jsxs("div", { className: "space-y-3", children: [_jsx(Input, { placeholder: t("namePlaceholder"), value: newDockerHost.name, onChange: (e) => setNewDockerHost({ ...newDockerHost, name: e.target.value }) }), _jsxs("div", { children: [_jsx(Input, { placeholder: t("dockerSocketUrl"), value: newDockerHost.url, onChange: (e) => setNewDockerHost({ ...newDockerHost, url: e.target.value }) }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-1.5", children: "Examples: http://localhost:2375, tcp://192.168.1.10:2375, unix:///var/run/docker.sock" }), _jsx("p", { className: "text-xs text-yellow-600 dark:text-yellow-400 mt-1", children: "Note: Docker daemon must expose TCP port (edit /etc/docker/daemon.json)" })] }), _jsxs(Button, { onClick: addDockerHost, className: "gap-2", children: [_jsx(Plus, { className: "h-4 w-4" }), t("addDockerHost")] })] })] })] })), activeTab === "remote-browsers" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("remoteBrowsers") }), remoteBrowsers.length === 0 ? (_jsx("div", { className: "rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center", children: _jsx("p", { className: "text-slate-400", children: t("notAvailablePleaseSetup") }) })) : (_jsx("div", { className: "space-y-2", children: remoteBrowsers.map((browser) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: browser.name }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: browser.url })] }), _jsx(Button, { variant: "ghost", onClick: () => deleteRemoteBrowser(browser.id), className: "text-red-400 hover:text-red-300", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, browser.id))) })), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsx("h3", { className: "mb-4 font-semibold text-slate-900 dark:text-white", children: t("addRemoteBrowser") }), _jsxs("div", { className: "space-y-3", children: [_jsx(Input, { placeholder: t("namePlaceholder"), value: newRemoteBrowser.name, onChange: (e) => setNewRemoteBrowser({ ...newRemoteBrowser, name: e.target.value }) }), _jsx(Input, { placeholder: t("websocketUrl"), value: newRemoteBrowser.url, onChange: (e) => {
                                                                setNewRemoteBrowser({ ...newRemoteBrowser, url: e.target.value });
                                                                setBrowserTestResult(null);
                                                            } }), _jsx("p", { className: "text-xs text-slate-500", children: "Example: ws://playwright:9222/ or ws://192.168.1.100:9222/" }), browserTestResult && (_jsxs("div", { className: `rounded-lg p-3 text-sm ${browserTestResult.success
                                                                ? 'bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400'
                                                                : 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400'}`, children: [browserTestResult.success ? '✓' : '✗', " ", browserTestResult.message] })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: testRemoteBrowser, disabled: testingBrowser || !newRemoteBrowser.url, variant: "outline", className: "flex-1", children: testingBrowser ? 'Testing...' : 'Test Connection' }), _jsxs(Button, { onClick: addRemoteBrowser, className: "gap-2 flex-1", disabled: !newRemoteBrowser.name || !newRemoteBrowser.url, children: [_jsx(Plus, { className: "h-4 w-4" }), t("addRemoteBrowser")] })] })] })] })] })), activeTab === "security" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("security") }), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsx("h3", { className: "mb-4 font-semibold text-slate-900 dark:text-white", children: t("changePassword") }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Label, { children: t("currentPassword") }), _jsx(Input, { type: showPasswords ? "text" : "password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), placeholder: t("currentPasswordPlaceholder") })] }), _jsxs("div", { className: "relative", children: [_jsx(Label, { children: t("newPassword") }), _jsx(Input, { type: showPasswords ? "text" : "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), placeholder: t("newPasswordPlaceholder") })] }), _jsxs("div", { className: "relative", children: [_jsx(Label, { children: t("repeatNewPassword") }), _jsx(Input, { type: showPasswords ? "text" : "password", value: repeatPassword, onChange: (e) => setRepeatPassword(e.target.value), placeholder: t("repeatPasswordPlaceholder") })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsxs("button", { type: "button", onClick: () => setShowPasswords(!showPasswords), className: "flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-white", children: [showPasswords ? _jsx(EyeOff, { className: "h-4 w-4" }) : _jsx(Eye, { className: "h-4 w-4" }), showPasswords ? t("hidePasswords") : t("showPasswords")] }) }), _jsxs(Button, { onClick: changePassword, className: "gap-2", children: [_jsx(Save, { className: "h-4 w-4" }), t("changePassword")] })] })] }), _jsxs("div", { className: "rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-4", children: [_jsx("h3", { className: "mb-2 font-semibold text-blue-600 dark:text-blue-400", children: t("twoFactorAuth") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("comingSoon") })] }), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-slate-500/20 bg-slate-100 dark:bg-slate-500/10 p-4", children: [_jsx("h3", { className: "mb-2 font-semibold text-slate-900 dark:text-white", children: t("advanced") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("additionalSecurity") })] })] })), activeTab === "api-keys" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("apiKeys") }), _jsx("div", { className: "space-y-2", children: apiKeys.map((key) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: key.label }), _jsx("div", { className: "mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400", children: key.token ? (_jsxs(_Fragment, { children: [_jsx("code", { className: "rounded bg-black/30 px-2 py-1 font-mono", children: key.token }), _jsx("button", { onClick: () => copyToClipboard(key.token), className: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300", children: copiedKey === key.token ? (_jsx(Check, { className: "h-4 w-4" })) : (_jsx(Copy, { className: "h-4 w-4" })) }), _jsx("span", { className: "text-xs text-yellow-600 dark:text-yellow-400", children: t("wontBeShownAgain") })] })) : (_jsxs(_Fragment, { children: [_jsxs("span", { children: [t("created"), ": ", new Date(key.createdAt).toLocaleDateString()] }), key.lastUsedAt && (_jsxs("span", { children: ["\u2022 ", t("lastUsed"), ": ", new Date(key.lastUsedAt).toLocaleDateString()] }))] })) })] }), _jsx(Button, { variant: "ghost", onClick: () => deleteApiKey(key.id), className: "text-red-400 hover:text-red-300", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, key.id))) }), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsx("h3", { className: "mb-4 font-semibold text-slate-900 dark:text-white", children: t("generateNewApiKey") }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { placeholder: t("keyLabelPlaceholder"), value: newApiKeyLabel, onChange: (e) => setNewApiKeyLabel(e.target.value) }), _jsxs(Button, { onClick: createApiKey, className: "gap-2 whitespace-nowrap", children: [_jsx(Plus, { className: "h-4 w-4" }), t("generate")] })] })] })] })), activeTab === "proxies" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("proxies") }), proxies.length === 0 ? (_jsx("div", { className: "rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center", children: _jsx("p", { className: "text-slate-400", children: t("notAvailablePleaseSetup") }) })) : (_jsx("div", { className: "space-y-2", children: proxies.map((proxy) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: proxy.name }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: [proxy.protocol, "://", proxy.host, ":", proxy.port, proxy.auth?.username && ` (${t("authenticated")})`] })] }), _jsx(Button, { variant: "ghost", onClick: () => deleteProxy(proxy.id), className: "text-red-400 hover:text-red-300", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, proxy.id))) })), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsx("h3", { className: "mb-4 font-semibold text-slate-900 dark:text-white", children: t("addProxy") }), _jsxs("div", { className: "space-y-3", children: [_jsx(Input, { placeholder: t("proxyNamePlaceholder"), value: newProxy.name, onChange: (e) => setNewProxy({ ...newProxy, name: e.target.value }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx(Label, { children: "Protocol" }), _jsxs("select", { value: newProxy.protocol, onChange: (e) => setNewProxy({ ...newProxy, protocol: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "http", children: "HTTP" }), _jsx("option", { value: "https", children: "HTTPS" }), _jsx("option", { value: "socks4", children: "SOCKS4" }), _jsx("option", { value: "socks5", children: "SOCKS5" })] })] }), _jsxs("div", { children: [_jsx(Label, { children: t("port") }), _jsx(Input, { type: "number", placeholder: t("portPlaceholder"), value: newProxy.port, onChange: (e) => setNewProxy({ ...newProxy, port: parseInt(e.target.value) || 8080 }) })] })] }), _jsx(Input, { placeholder: t("hostPlaceholder"), value: newProxy.host, onChange: (e) => setNewProxy({ ...newProxy, host: e.target.value }) }), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-3", children: [_jsx("p", { className: "mb-2 text-sm font-medium text-slate-900 dark:text-white", children: t("authenticationOptional") }), _jsxs("div", { className: "space-y-2", children: [_jsx(Input, { placeholder: t("usernamePlaceholder"), value: newProxy.auth?.username || "", onChange: (e) => setNewProxy({
                                                                                ...newProxy,
                                                                                auth: { ...newProxy.auth, username: e.target.value, password: newProxy.auth?.password || "" },
                                                                            }) }), _jsx(Input, { type: "password", placeholder: t("passwordPlaceholder"), value: newProxy.auth?.password || "", onChange: (e) => setNewProxy({
                                                                                ...newProxy,
                                                                                auth: { ...newProxy.auth, password: e.target.value, username: newProxy.auth?.username || "" },
                                                                            }) })] })] }), _jsxs(Button, { onClick: addProxy, className: "gap-2", children: [_jsx(Plus, { className: "h-4 w-4" }), t("addProxy")] })] })] })] })), activeTab === "users" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("userManagement") }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: "Users" }), users.length === 0 ? (_jsx("div", { className: "rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center", children: _jsx("p", { className: "text-slate-400", children: "No users found" }) })) : (_jsx("div", { className: "space-y-2", children: users.map((user) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: user.email }), _jsxs("div", { className: "flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400", children: [_jsxs("span", { children: ["Created: ", new Date(user.createdAt).toLocaleDateString()] }), user._count && _jsxs("span", { children: ["\u2022 ", user._count.apiKeys, " API key", user._count.apiKeys !== 1 ? 's' : ''] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("select", { value: user.role, onChange: (e) => updateUserRole(user.id, e.target.value), className: "rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1.5 text-sm text-slate-900 dark:text-white", children: [_jsx("option", { value: "ADMIN", children: "Admin" }), _jsx("option", { value: "VIEWER", children: "Viewer" })] }), _jsx(Button, { variant: "ghost", onClick: () => deleteUser(user.id), className: "text-red-400 hover:text-red-300", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }, user.id))) }))] }), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsx("h3", { className: "mb-4 font-semibold text-slate-900 dark:text-white", children: t("createNewUser") }), _jsxs("div", { className: "space-y-3", children: [_jsx(Input, { type: "email", placeholder: t("newUserEmailPlaceholder"), value: newUser.email, onChange: (e) => setNewUser({ ...newUser, email: e.target.value }) }), _jsx(Input, { type: "password", placeholder: t("newUserPasswordPlaceholder"), value: newUser.password, onChange: (e) => setNewUser({ ...newUser, password: e.target.value }) }), _jsxs("div", { children: [_jsx(Label, { children: t("role") }), _jsxs("select", { value: newUser.role, onChange: (e) => setNewUser({ ...newUser, role: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "VIEWER", children: "Viewer" }), _jsx("option", { value: "ADMIN", children: "Admin" })] })] }), _jsxs(Button, { onClick: createUser, className: "gap-2", children: [_jsx(UserPlus, { className: "h-4 w-4" }), "Create User"] })] })] }), _jsxs("div", { className: "space-y-4 border-t border-slate-300 dark:border-white/10 pt-6", children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: "Pending Invitations" }), invitations.length === 0 ? (_jsx("div", { className: "rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center", children: _jsx("p", { className: "text-slate-400", children: "No pending invitations" }) })) : (_jsx("div", { className: "space-y-2", children: invitations.map((invitation) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: invitation.email }), _jsxs("div", { className: "flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400", children: [_jsxs("span", { children: ["Role: ", invitation.role] }), _jsxs("span", { children: ["\u2022 Expires: ", new Date(invitation.expiresAt).toLocaleDateString()] }), invitation.createdBy && _jsxs("span", { children: ["\u2022 By: ", invitation.createdBy.email] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => copyInviteLink(invitation.token, invitation.id), className: copiedInviteLink === invitation.id ? "text-green-400" : "", children: copiedInviteLink === invitation.id ? _jsx(Check, { className: "h-4 w-4" }) : _jsx(Copy, { className: "h-4 w-4" }) }), _jsx(Button, { variant: "ghost", onClick: () => deleteInvitation(invitation.id), className: "text-red-400 hover:text-red-300", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }, invitation.id))) }))] }), _jsxs("div", { className: "rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4", children: [_jsx("h3", { className: "mb-4 font-semibold text-slate-900 dark:text-white", children: "Send Email Invitation" }), _jsxs("div", { className: "space-y-3", children: [_jsx(Input, { type: "email", placeholder: t("emailAddress"), value: newInvitation.email, onChange: (e) => setNewInvitation({ ...newInvitation, email: e.target.value }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx(Label, { children: "Role" }), _jsxs("select", { value: newInvitation.role, onChange: (e) => setNewInvitation({ ...newInvitation, role: e.target.value }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "VIEWER", children: "Viewer" }), _jsx("option", { value: "ADMIN", children: "Admin" })] })] }), _jsxs("div", { children: [_jsx(Label, { children: "Expires In" }), _jsxs("select", { value: newInvitation.expiresInDays, onChange: (e) => setNewInvitation({ ...newInvitation, expiresInDays: parseInt(e.target.value) }), className: "h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white", children: [_jsx("option", { value: "1", children: "1 day" }), _jsx("option", { value: "3", children: "3 days" }), _jsx("option", { value: "7", children: "7 days" }), _jsx("option", { value: "14", children: "14 days" }), _jsx("option", { value: "30", children: "30 days" })] })] })] }), _jsxs(Button, { onClick: createInvitation, className: "gap-2", children: [_jsx(Mail, { className: "h-4 w-4" }), "Create Invitation"] }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400", children: "An invitation link will be generated and copied to your clipboard" })] })] })] })), activeTab === "about" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("about") }), _jsxs("div", { className: "space-y-4 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-slate-400", children: [t("version"), ":"] }), _jsx("span", { className: "font-mono text-slate-900 dark:text-white", children: "2.0.2" })] }), versionInfo && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-slate-400", children: [t("latestVersion"), ":"] }), _jsx("span", { className: "font-mono text-slate-900 dark:text-white", children: versionInfo.latest })] }), versionInfo.updateAvailable && (_jsx("div", { className: "rounded-lg border border-green-500/30 dark:border-green-500/20 bg-green-500/10 p-3", children: _jsxs("p", { className: "text-sm font-medium text-green-600 dark:text-green-400", children: [t("updateAvailable"), " - v", versionInfo.latest] }) })), !versionInfo.updateAvailable && (_jsx("div", { className: "rounded-lg border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-3", children: _jsx("p", { className: "text-sm font-medium text-blue-600 dark:text-blue-400", children: t("upToDate") }) })), versionInfo.betaAvailable && versionInfo.latestBeta && (_jsx("div", { className: "rounded-lg border border-yellow-500/30 dark:border-yellow-500/20 bg-yellow-500/10 p-3", children: _jsxs("p", { className: "text-sm font-medium text-yellow-600 dark:text-yellow-400", children: ["Beta ", t("updateAvailable"), ": v", versionInfo.latestBeta] }) }))] })), _jsx("div", { className: "border-t border-white/10 pt-4", children: _jsx(Button, { variant: "outline", onClick: checkForUpdates, disabled: checkingUpdates, className: "w-full", children: checkingUpdates ? t("loading") : t("checkForUpdates") }) }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "checkbox", id: "checkUpdates", checked: localSettings.checkUpdates || false, onChange: async (e) => {
                                                                const newSettings = { ...localSettings, checkUpdates: e.target.checked };
                                                                setLocalSettings(newSettings);
                                                                // Auto-save this setting
                                                                try {
                                                                    await updateGlobalSettings(newSettings);
                                                                }
                                                                catch (error) {
                                                                    console.error("Failed to save checkUpdates setting:", error);
                                                                }
                                                            }, className: "h-5 w-5 rounded border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5" }), _jsx(Label, { htmlFor: "checkUpdates", className: "cursor-pointer text-sm", children: t("showUpdateIfAvailable") })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "checkbox", id: "checkBeta", checked: localSettings.checkBetaReleases || false, onChange: async (e) => {
                                                                const newSettings = { ...localSettings, checkBetaReleases: e.target.checked };
                                                                setLocalSettings(newSettings);
                                                                // Auto-save this setting
                                                                try {
                                                                    await updateGlobalSettings(newSettings);
                                                                }
                                                                catch (error) {
                                                                    console.error("Failed to save checkBetaReleases setting:", error);
                                                                }
                                                            }, className: "h-5 w-5 rounded border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5" }), _jsx(Label, { htmlFor: "checkBeta", className: "cursor-pointer text-sm", children: t("alsoCheckBetaRelease") })] })] }), _jsxs("div", { className: "rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-6 text-center", children: [_jsx("h3", { className: "mb-2 text-lg font-semibold text-slate-900 dark:text-white", children: "UptivaLab" }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300", children: t("comprehensiveMonitoring") }), _jsxs("p", { className: "mt-4 text-xs text-slate-400", children: ["\u00A9 ", new Date().getFullYear(), " UptivaLab. ", t("allRightsReserved")] })] })] })), activeTab === "notifications" && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-semibold text-slate-900 dark:text-white", children: t("notifications") }), _jsxs("div", { className: "rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-6", children: [_jsxs("p", { className: "text-slate-600 dark:text-slate-300", children: ["Notification channels are configured in the", " ", _jsx("a", { href: "/notifications", className: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline", children: "Notifications" }), " ", "page."] }), _jsx("p", { className: "mt-2 text-sm text-slate-600 dark:text-slate-400", children: "Global notification settings coming soon..." })] })] }))] })] }) })] }));
};
