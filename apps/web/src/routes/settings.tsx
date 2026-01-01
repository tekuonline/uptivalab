import { useState, useEffect } from "react";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import { useSettings } from "../providers/settings-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { 
  Settings as SettingsIcon, 
  Globe, 
  Palette, 
  Bell, 
  Shield, 
  Key, 
  Network, 
  Info,
  Save,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Check,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  Mail,
  UserPlus,
  Download,
  Upload
} from "lucide-react";

type SettingsTab = 
  | "general" 
  | "appearance" 
  | "notifications" 
  | "reverse-proxy" 
  | "tags" 
  | "monitor-history" 
  | "docker-hosts" 
  | "remote-browsers" 
  | "security" 
  | "api-keys" 
  | "users"
  | "proxies" 
  | "backup-restore"
  | "about";

interface Settings {
  displayTimezone?: string;
  serverTimezone?: string;
  searchEngineVisibility?: "allow" | "discourage";
  entryPage?: "dashboard" | "status";
  primaryBaseUrl?: string;
  steamApiKey?: string;
  enableNscd?: boolean;
  chromeExecutable?: string;
  language?: string;
  theme?: "auto" | "light" | "dark";
  heartbeatBarTheme?: "normal" | "bottom-up";
  showElapsedTime?: boolean;
  cloudflareTunnelToken?: string;
  cloudflaredInstalled?: boolean;
  cloudflaredRunning?: boolean;
  reverseProxyHeaders?: string;
  trustProxy?: boolean;
  checkUpdates?: boolean;
  checkBetaReleases?: boolean;
}

interface ApiKey {
  id: string;
  label: string;
  permissions?: string;
  token?: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

interface DockerHost {
  id: string;
  name: string;
  url: string;
}

interface RemoteBrowser {
  id: string;
  name: string;
  url: string;
}

interface Proxy {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    apiKeys: number;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  createdBy?: {
    email: string;
  };
}

export const SettingsRoute = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { settings: globalSettings, updateSettings: updateGlobalSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [localSettings, setLocalSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  // Update checker
  const [versionInfo, setVersionInfo] = useState<{
    current: string;
    latest: string;
    latestBeta?: string;
    updateAvailable: boolean;
    betaAvailable: boolean;
  } | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newApiKeyLabel, setNewApiKeyLabel] = useState("");
  const [newApiKeyPermissions, setNewApiKeyPermissions] = useState<"READ" | "WRITE">("READ");
  const [copiedKey, setCopiedKey] = useState("");

  // Docker Hosts
  const [dockerHosts, setDockerHosts] = useState<DockerHost[]>([]);
  const [newDockerHost, setNewDockerHost] = useState({ name: "", url: "" });
  const [testingDockerHost, setTestingDockerHost] = useState<string | null>(null);
  const [dockerHostStatus, setDockerHostStatus] = useState<Record<string, { success?: boolean; version?: string; error?: string; testing?: boolean }>>({});

  // Remote Browsers
  const [remoteBrowsers, setRemoteBrowsers] = useState<RemoteBrowser[]>([]);
  const [newRemoteBrowser, setNewRemoteBrowser] = useState({ name: "", url: "" });
  const [testingBrowser, setTestingBrowser] = useState(false);
  const [browserTestResult, setBrowserTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Proxies
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [newProxy, setNewProxy] = useState({
    name: "",
    protocol: "http",
    host: "",
    port: 8080,
    auth: { username: "", password: "" },
  });

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ email: "", password: "", role: "VIEWER" as "ADMIN" | "VIEWER" });
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [newInvitation, setNewInvitation] = useState({ email: "", role: "VIEWER" as "ADMIN" | "VIEWER", expiresInDays: 7 });
  const [copiedInviteLink, setCopiedInviteLink] = useState("");

  // Cloudflare Tunnel state
  const [tunnelStatus, setTunnelStatus] = useState<{ running: boolean; installed: boolean } | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);

  // Backup & Restore
  const [exportPassword, setExportPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [backupRestoreLoading, setBackupRestoreLoading] = useState(false);

  // Fetch Cloudflare Tunnel status
  const fetchTunnelStatus = async () => {
    try {
      const status = await api.getCloudflareTunnelStatus(token);
      setTunnelStatus(status);
    } catch (error) {
      console.error("Failed to fetch tunnel status:", error);
    }
  };

  // Control Cloudflare Tunnel
  const controlTunnel = async (action: "start" | "stop" | "restart") => {
    setTunnelLoading(true);
    try {
      // If starting and token has changed, save settings first
      if (action === "start" && localSettings.cloudflareTunnelToken !== globalSettings.cloudflareTunnelToken) {
        await updateGlobalSettings(localSettings, token);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
      
      const result = await api.controlCloudflareTunnel(token, action);
      alert(result.message);
      await fetchTunnelStatus();
    } catch (error) {
      console.error(`Failed to ${action} tunnel:`, error);
      alert(`Failed to ${action} tunnel`);
    } finally {
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

  // Reset API key permission to READ if user is not admin
  useEffect(() => {
    if (user && user.role !== "ADMIN" && newApiKeyPermissions === "WRITE") {
      setNewApiKeyPermissions("READ");
    }
  }, [user, newApiKeyPermissions]);

  const saveSettings = async () => {
    setLoading(true);
    const tokenChanged = localSettings.cloudflareTunnelToken !== globalSettings.cloudflareTunnelToken;
    
    try {
      await updateGlobalSettings(localSettings, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      
      // Restart tunnel if token was changed and tunnel is installed
      if (tokenChanged && tunnelStatus?.installed && localSettings.cloudflareTunnelToken) {
        await controlTunnel("restart");
      } else if (tokenChanged) {
        // Refresh status if token changed but tunnel wasn't running
        await fetchTunnelStatus();
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== repeatPassword) {
      alert(t("passwordsDontMatch"));
      return;
    }

    try {
      await api.changePassword(token, { currentPassword, newPassword });
      alert(t("passwordChangedSuccess"));
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (error) {
      console.error("Failed to change password:", error);
      alert(error instanceof Error ? error.message : t("failedToChangePassword"));
    }
  };

  // Backup & Restore functions
  const exportSettings = async () => {
    setBackupRestoreLoading(true);
    try {
      const data = await api.exportSettings(token, exportPassword || undefined);
      
      // Create and download file
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `uptivalab-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert("Settings exported successfully!");
      setExportPassword("");
    } catch (error) {
      console.error("Failed to export settings:", error);
      alert("Failed to export settings");
    } finally {
      setBackupRestoreLoading(false);
    }
  };

  const importSettings = async () => {
    if (!importFile) {
      alert("Please select a file to import");
      return;
    }

    if (!confirm("This will replace all your current settings and data. Are you sure you want to continue?")) {
      return;
    }

    setBackupRestoreLoading(true);
    try {
      const fileContent = await importFile.text();
      const result = await api.importSettings(token, fileContent, importPassword || undefined);
      
      if (result.success) {
        alert("Settings imported successfully! Please refresh the page.");
        // Reset form
        setImportFile(null);
        setImportPassword("");
        // Optionally reload the page
        window.location.reload();
      } else {
        alert(result.message || "Failed to import settings");
      }
    } catch (error) {
      console.error("Failed to import settings:", error);
      alert("Failed to import settings");
    } finally {
      setBackupRestoreLoading(false);
    }
  };

  const loadApiKeys = async () => {
    try {
      const keys = await api.listApiKeys(token);
      setApiKeys(keys);
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  };

  const createApiKey = async () => {
    if (!newApiKeyLabel.trim()) return;

    try {
      const newKey = await api.createApiKey(token, { 
        label: newApiKeyLabel,
        permissions: newApiKeyPermissions 
      } as any);
      setApiKeys([...apiKeys, newKey]);
      setNewApiKeyLabel("");
      setNewApiKeyPermissions("READ");
    } catch (error) {
      console.error("Failed to create API key:", error);
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      await api.deleteApiKey(token, id);
      setApiKeys(apiKeys.filter((k) => k.id !== id));
    } catch (error) {
      console.error("Failed to delete API key:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const loadDockerHosts = async () => {
    try {
      const hosts = await api.listDockerHosts(token);
      setDockerHosts(hosts);
    } catch (error) {
      console.error("Failed to load docker hosts:", error);
    }
  };

  const addDockerHost = async () => {
    if (!newDockerHost.name || !newDockerHost.url) return;

    try {
      const host = await api.createDockerHost(token, newDockerHost);
      setDockerHosts([...dockerHosts, host]);
      setNewDockerHost({ name: "", url: "" });
    } catch (error) {
      console.error("Failed to add docker host:", error);
    }
  };

  const deleteDockerHost = async (id: string) => {
    try {
      await api.deleteDockerHost(token, id);
      setDockerHosts(dockerHosts.filter((h) => h.id !== id));
      setDockerHostStatus((prev) => {
        const newStatus = { ...prev };
        delete newStatus[id];
        return newStatus;
      });
    } catch (error) {
      console.error("Failed to delete docker host:", error);
    }
  };

  const testDockerHost = async (id: string) => {
    setTestingDockerHost(id);
    setDockerHostStatus((prev) => ({ ...prev, [id]: { testing: true } }));

    try {
      const data = await api.testDockerHost(token, id);
      setDockerHostStatus((prev) => ({
        ...prev,
        [id]: { success: true, version: data.containers ? "Connected" : "No data", testing: false }
      }));
    } catch (error) {
      setDockerHostStatus((prev) => ({
        ...prev,
        [id]: { success: false, error: error instanceof Error ? error.message : String(error), testing: false }
      }));
    } finally {
      setTestingDockerHost(null);
    }
  };

  const loadRemoteBrowsers = async () => {
    try {
      const browsers = await api.listRemoteBrowsers(token);
      setRemoteBrowsers(browsers);
    } catch (error) {
      console.error("Failed to load remote browsers:", error);
    }
  };

  const addRemoteBrowser = async () => {
    if (!newRemoteBrowser.name || !newRemoteBrowser.url) return;

    try {
      const browser = await api.createRemoteBrowser(token, newRemoteBrowser);
      setRemoteBrowsers([...remoteBrowsers, browser]);
      setNewRemoteBrowser({ name: "", url: "" });
    } catch (error) {
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
      const result = await api.testRemoteBrowser(token, { url: newRemoteBrowser.url });
      if (result.success) {
        setBrowserTestResult({ success: true, message: result.message || "Connection successful!" });
      } else {
        setBrowserTestResult({ success: false, message: result.message || t("connectionFailed") });
      }
    } catch (error) {
      setBrowserTestResult({ success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setTestingBrowser(false);
    }
  };

  const deleteRemoteBrowser = async (id: string) => {
    try {
      await api.deleteRemoteBrowser(token, id);
      setRemoteBrowsers(remoteBrowsers.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Failed to delete remote browser:", error);
    }
  };

  const loadProxies = async () => {
    try {
      const proxyList = await api.listProxies(token);
      setProxies(proxyList);
    } catch (error) {
      console.error("Failed to load proxies:", error);
    }
  };

  const addProxy = async () => {
    if (!newProxy.name || !newProxy.host || !newProxy.port) return;

    try {
      const proxy = await api.createProxy(token, newProxy);
      setProxies([...proxies, proxy]);
      setNewProxy({
        name: "",
        protocol: "http",
        host: "",
        port: 8080,
        auth: { username: "", password: "" },
      });
    } catch (error) {
      console.error("Failed to add proxy:", error);
    }
  };

  const deleteProxy = async (id: string) => {
    try {
      await api.deleteProxy(token, id);
      setProxies(proxies.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Failed to delete proxy:", error);
    }
  };

  // User management functions
  const loadUsers = async () => {
    try {
      const userList = await api.listUsers(token);
      setUsers(userList);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.password) return;

    try {
      await api.createUser(token, newUser);
      await loadUsers();
      setNewUser({ email: "", password: "", role: "VIEWER" });
    } catch (error) {
      console.error("Failed to create user:", error);
      alert(error instanceof Error ? error.message : "Failed to create user");
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await api.deleteUser(token, id);
      setUsers(users.filter((user) => user.id !== id));
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert(error instanceof Error ? error.message : "Failed to delete user");
    }
  };

  const updateUserRole = async (id: string, role: "ADMIN" | "VIEWER") => {
    try {
      await api.updateUserRole(token, id, role);
      setUsers(users.map((user) => (user.id === id ? { ...user, role } : user)));
    } catch (error) {
      console.error("Failed to update user role:", error);
      alert(error instanceof Error ? error.message : "Failed to update user role");
    }
  };

  // Invitation management functions
  const loadInvitations = async () => {
    try {
      const invitationList = await api.listInvitations(token);
      setInvitations(invitationList);
    } catch (error) {
      console.error("Failed to load invitations:", error);
    }
  };

  const createInvitation = async () => {
    if (!newInvitation.email) return;

    try {
      const invitation = await api.createInvitation(token, newInvitation);
      await loadInvitations();
      setNewInvitation({ email: "", role: "VIEWER", expiresInDays: 7 });
      
      // Show invitation link
      const inviteLink = `${window.location.origin}/invite/${invitation.token}`;
      navigator.clipboard.writeText(inviteLink);
      setCopiedInviteLink(invitation.id);
      setTimeout(() => setCopiedInviteLink(""), 3000);
      alert(`Invitation created! Link copied to clipboard:\n${inviteLink}`);
    } catch (error) {
      console.error("Failed to create invitation:", error);
      alert(error instanceof Error ? error.message : "Failed to create invitation");
    }
  };

  const deleteInvitation = async (id: string) => {
    try {
      await api.deleteInvitation(token, id);
      setInvitations(invitations.filter((inv) => inv.id !== id));
    } catch (error) {
      console.error("Failed to delete invitation:", error);
    }
  };

  const copyInviteLink = (token: string, id: string) => {
    const inviteLink = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedInviteLink(id);
    setTimeout(() => setCopiedInviteLink(""), 2000);
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const data = await api.checkUpdates(token);
      setVersionInfo(data);
    } catch (error) {
      console.error("Failed to check for updates:", error);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
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
    { id: "backup-restore", label: "Backup & Restore", icon: Download },
    { id: "about", label: t("about"), icon: Info },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("settings")}</h1>
        {activeTab !== "security" && activeTab !== "api-keys" && activeTab !== "docker-hosts" && 
         activeTab !== "remote-browsers" && activeTab !== "proxies" && activeTab !== "users" && activeTab !== "backup-restore" && (
          <Button onClick={saveSettings} disabled={loading} className="gap-2">
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? t("saved") : t("save")}
          </Button>
        )}
      </div>

      <div className="glass-panel rounded-3xl p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="col-span-9 space-y-6">
            {activeTab === "general" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("general")}</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label>{t("displayTimezone")}</Label>
                    <select
                      value={localSettings.displayTimezone || "UTC"}
                      onChange={(e) => setLocalSettings({ ...localSettings, displayTimezone: e.target.value })}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New York (EST/EDT)</option>
                      <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                      <option value="America/Denver">America/Denver (MST/MDT)</option>
                      <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                      <option value="America/Phoenix">America/Phoenix (MST)</option>
                      <option value="America/Toronto">America/Toronto (EST/EDT)</option>
                      <option value="America/Vancouver">America/Vancouver (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                      <option value="Europe/Rome">Europe/Rome (CET/CEST)</option>
                      <option value="Europe/Madrid">Europe/Madrid (CET/CEST)</option>
                      <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
                      <option value="Europe/Brussels">Europe/Brussels (CET/CEST)</option>
                      <option value="Europe/Vienna">Europe/Vienna (CET/CEST)</option>
                      <option value="Europe/Stockholm">Europe/Stockholm (CET/CEST)</option>
                      <option value="Europe/Warsaw">Europe/Warsaw (CET/CEST)</option>
                      <option value="Europe/Athens">Europe/Athens (EET/EEST)</option>
                      <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="Asia/Bangkok">Asia/Bangkok (ICT)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                      <option value="Asia/Hong_Kong">Asia/Hong Kong (HKT)</option>
                      <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</option>
                      <option value="Australia/Melbourne">Australia/Melbourne (AEDT/AEST)</option>
                      <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                      <option value="Australia/Perth">Australia/Perth (AWST)</option>
                      <option value="Pacific/Auckland">Pacific/Auckland (NZDT/NZST)</option>
                      <option value="Pacific/Fiji">Pacific/Fiji (FJT)</option>
                      <option value="Pacific/Honolulu">Pacific/Honolulu (HST)</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("timezoneForDisplayingDates")}</p>
                  </div>

                  <div>
                    <Label>{t("serverTimezone")}</Label>
                    <select
                      value={localSettings.serverTimezone || "UTC"}
                      onChange={(e) => setLocalSettings({ ...localSettings, serverTimezone: e.target.value })}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New York (EST/EDT)</option>
                      <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                      <option value="America/Denver">America/Denver (MST/MDT)</option>
                      <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                      <option value="America/Phoenix">America/Phoenix (MST)</option>
                      <option value="America/Toronto">America/Toronto (EST/EDT)</option>
                      <option value="America/Vancouver">America/Vancouver (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                      <option value="Europe/Rome">Europe/Rome (CET/CEST)</option>
                      <option value="Europe/Madrid">Europe/Madrid (CET/CEST)</option>
                      <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
                      <option value="Europe/Brussels">Europe/Brussels (CET/CEST)</option>
                      <option value="Europe/Vienna">Europe/Vienna (CET/CEST)</option>
                      <option value="Europe/Stockholm">Europe/Stockholm (CET/CEST)</option>
                      <option value="Europe/Warsaw">Europe/Warsaw (CET/CEST)</option>
                      <option value="Europe/Athens">Europe/Athens (EET/EEST)</option>
                      <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="Asia/Bangkok">Asia/Bangkok (ICT)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                      <option value="Asia/Hong_Kong">Asia/Hong Kong (HKT)</option>
                      <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</option>
                      <option value="Australia/Melbourne">Australia/Melbourne (AEDT/AEST)</option>
                      <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                      <option value="Australia/Perth">Australia/Perth (AWST)</option>
                      <option value="Pacific/Auckland">Pacific/Auckland (NZDT/NZST)</option>
                      <option value="Pacific/Fiji">Pacific/Fiji (FJT)</option>
                      <option value="Pacific/Honolulu">Pacific/Honolulu (HST)</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Timezone for the server. Requires API restart to take effect.</p>
                  </div>

                  <div>
                    <Label>{t("searchEngineVisibility")}</Label>
                    <select
                      value={localSettings.searchEngineVisibility || "allow"}
                      onChange={(e) => setLocalSettings({ ...localSettings, searchEngineVisibility: e.target.value as any })}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                    >
                      <option value="allow">{t("allowIndexing")}</option>
                      <option value="discourage">{t("discourageIndexing")}</option>
                    </select>
                  </div>

                  <div>
                    <Label>{t("entryPage")}</Label>
                    <select
                      value={localSettings.entryPage || "dashboard"}
                      onChange={(e) => setLocalSettings({ ...localSettings, entryPage: e.target.value as any })}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                    >
                      <option value="dashboard">{t("dashboard")}</option>
                      <option value="status">{t("statusPage")}</option>
                    </select>
                  </div>

                  <div>
                    <Label>{t("primaryBaseUrl")}</Label>
                    <Input
                      value={localSettings.primaryBaseUrl || ""}
                      onChange={(e) => setLocalSettings({ ...localSettings, primaryBaseUrl: e.target.value })}
                      placeholder={t("primaryBaseUrlPlaceholder")}
                    />
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("primaryBaseUrlDescription")}</p>
                  </div>

                  <div>
                    <Label>{t("steamApiKey")}</Label>
                    <Input
                      value={localSettings.steamApiKey || ""}
                      onChange={(e) => setLocalSettings({ ...localSettings, steamApiKey: e.target.value })}
                      placeholder={t("steamApiKeyPlaceholder")}
                    />
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {t("steamApiKeyDescription")}{" "}
                      <a
                        href="https://steamcommunity.com/dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        https://steamcommunity.com/dev
                      </a>
                    </p>
                  </div>

                  <div>
                    <Label>{t("enableNscd")}</Label>
                    <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{t("enableNscdDescription")}</p>
                    <select
                      value={localSettings.enableNscd ? "true" : "false"}
                      onChange={(e) => setLocalSettings({ ...localSettings, enableNscd: e.target.value === "true" })}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                    >
                      <option value="true">{t("enable")}</option>
                      <option value="false">{t("disable")}</option>
                    </select>
                  </div>

                  <div>
                    <Label>{t("chromeExecutable")}</Label>
                    <Input
                      value={localSettings.chromeExecutable || ""}
                      onChange={(e) => setLocalSettings({ ...localSettings, chromeExecutable: e.target.value })}
                      placeholder={t("chromeExecutablePlaceholder")}
                    />
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("chromeExecutableDescription")}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("appearance")}</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label>{t("language")}</Label>
                    <select
                      value={localSettings.language || "en"}
                      onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value })}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="ja">日本語</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>

                  <div>
                    <Label>{t("theme")}</Label>
                    <select
                      value={localSettings.theme || "auto"}
                      onChange={async (e) => {
                        const newSettings = { ...localSettings, theme: e.target.value as any };
                        setLocalSettings(newSettings);
                        // Auto-save theme setting
                        try {
                          await updateGlobalSettings(newSettings, token);
                        } catch (error) {
                          console.error("Failed to save theme setting:", error);
                        }
                      }}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-slate-900 dark:text-white dark:bg-white/5 dark:text-slate-900 dark:text-white bg-slate-100 text-slate-900"
                    >
                      <option value="auto">{t("autoFollowSystem")}</option>
                      <option value="light">{t("light")}</option>
                      <option value="dark">{t("dark")}</option>
                    </select>
                  </div>

                  <div>
                    <Label>{t("heartbeatBarTheme")}</Label>
                    <select
                      value={localSettings.heartbeatBarTheme || "normal"}
                      onChange={(e) => setLocalSettings({ ...localSettings, heartbeatBarTheme: e.target.value as any })}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                    >
                      <option value="normal">{t("normal")}</option>
                      <option value="bottom-up">{t("bottomUp")}</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="showElapsedTime"
                      checked={localSettings.showElapsedTime || false}
                      onChange={(e) => setLocalSettings({ ...localSettings, showElapsedTime: e.target.checked })}
                      className="h-5 w-5 rounded border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5"
                    />
                    <Label htmlFor="showElapsedTime" className="cursor-pointer">
                      {t("showElapsedTimeDescription")}
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "reverse-proxy" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("reverseProxy")}</h2>
                
                <div className="space-y-6">
                  <div className="rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-4">
                    <h3 className="mb-2 font-semibold text-blue-600 dark:text-blue-400">{t("cloudflareTunnel")}</h3>
                    <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                      {t("cloudflareTunnelConfig")}
                    </p>
                    <Label>{t("cloudflareTunnelToken")}</Label>
                    <Input
                      type="password"
                      value={localSettings.cloudflareTunnelToken || ""}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, cloudflareTunnelToken: e.target.value }))}
                      placeholder={t("cloudflareTunnelTokenPlaceholder")}
                    />
                    
                    {/* Tunnel Status and Controls */}
                    {tunnelStatus && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Status:</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                            tunnelStatus.running 
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${tunnelStatus.running ? "bg-green-500" : "bg-slate-400"}`} />
                            {tunnelStatus.running ? "Running" : "Stopped"}
                          </span>
                        </div>
                        
                        <div className="flex gap-2">
                          {!tunnelStatus.running ? (
                            <button
                              type="button"
                              onClick={() => controlTunnel("start")}
                              disabled={tunnelLoading || !localSettings.cloudflareTunnelToken}
                              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {tunnelLoading ? "Starting..." : "Start"}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => controlTunnel("stop")}
                                disabled={tunnelLoading}
                                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {tunnelLoading ? "Stopping..." : "Stop"}
                              </button>
                              <button
                                type="button"
                                onClick={() => controlTunnel("restart")}
                                disabled={tunnelLoading}
                                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {tunnelLoading ? "Restarting..." : "Restart"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      💡 To get a tunnel token:
                    </p>
                    <ol className="mt-1 ml-4 list-decimal text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <li>{t("visitCloudflareZeroTrustDashboard")} <a href="https://one.dash.cloudflare.com/" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">{t("cloudflareTunnelUrl")}</a></li>
                      <li>Go to Networks → Tunnels</li>
                      <li>Create a new tunnel or use existing one</li>
                      <li>Copy the tunnel token and paste it above</li>
                    </ol>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      📚 <a
                        href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                      >
                        Official Cloudflare Tunnel Documentation
                      </a>
                    </p>
                    <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        ⚠️ <strong>Note:</strong> Enter your Cloudflare Tunnel token above and save settings. The tunnel will start automatically. Use the controls above to start/stop/restart the tunnel as needed.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-300 dark:border-slate-500/20 bg-slate-100 dark:bg-slate-500/10 p-4">
                    <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">{t("otherSoftware")}</h3>
                    <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                      {t("otherSoftwareExample")}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {t("pleaseRead")}{" "}
                      <a
                        href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                      >
                        https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy
                      </a>
                    </p>
                  </div>

                  <div>
                    <Label>{t("httpHeaders")}</Label>
                    <textarea
                      value={localSettings.reverseProxyHeaders || ""}
                      onChange={(e) => setLocalSettings({ ...localSettings, reverseProxyHeaders: e.target.value })}
                      placeholder={t("headerPlaceholder")}
                      rows={4}
                      className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <Label>{t("trustProxy")}</Label>
                    <select
                      value={localSettings.trustProxy ? "yes" : "no"}
                      onChange={(e) => setLocalSettings({ ...localSettings, trustProxy: e.target.value === "yes" })}
                      className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                    >
                      <option value="yes">{t("yes")}</option>
                      <option value="no">{t("no")}</option>
                    </select>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {t("trustProxyDescription")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "docker-hosts" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("dockerHosts")}</h2>
                
                {dockerHosts.length === 0 ? (
                  <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center">
                    <p className="text-slate-400">{t("notAvailablePleaseSetUp")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dockerHosts.map((host) => (
                      <div
                        key={host.id}
                        className="flex items-start justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-slate-900 dark:text-white">{host.name}</p>
                            {dockerHostStatus[host.id]?.success && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                Connected
                              </span>
                            )}
                            {dockerHostStatus[host.id]?.success === false && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                <XCircle className="w-3 h-3" />
                                Failed
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 break-all">{host.url}</p>
                          {dockerHostStatus[host.id]?.version && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              Docker {dockerHostStatus[host.id].version}
                            </p>
                          )}
                          {dockerHostStatus[host.id]?.error && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              Error: {dockerHostStatus[host.id].error}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Button
                            variant="ghost"
                            onClick={() => testDockerHost(host.id)}
                            disabled={testingDockerHost === host.id}
                            className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 gap-2"
                          >
                            {testingDockerHost === host.id ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <Network className="h-4 w-4" />
                                Test
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => deleteDockerHost(host.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{t("addDockerHost")}</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder={t("namePlaceholder")}
                      value={newDockerHost.name}
                      onChange={(e) => setNewDockerHost({ ...newDockerHost, name: e.target.value })}
                    />
                    <div>
                      <Input
                        placeholder={t("dockerSocketUrl")}
                        value={newDockerHost.url}
                        onChange={(e) => setNewDockerHost({ ...newDockerHost, url: e.target.value })}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        Examples: http://localhost:2375, tcp://192.168.1.10:2375, unix:///var/run/docker.sock
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Note: Docker daemon must expose TCP port (edit /etc/docker/daemon.json)
                      </p>
                    </div>
                    <Button onClick={addDockerHost} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {t("addDockerHost")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "remote-browsers" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("remoteBrowsers")}</h2>
                
                {remoteBrowsers.length === 0 ? (
                  <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center">
                    <p className="text-slate-400">{t("notAvailablePleaseSetup")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {remoteBrowsers.map((browser) => (
                      <div
                        key={browser.id}
                        className="flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{browser.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{browser.url}</p>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => deleteRemoteBrowser(browser.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{t("addRemoteBrowser")}</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder={t("namePlaceholder")}
                      value={newRemoteBrowser.name}
                      onChange={(e) => setNewRemoteBrowser({ ...newRemoteBrowser, name: e.target.value })}
                    />
                    <Input
                      placeholder={t("websocketUrl")}
                      value={newRemoteBrowser.url}
                      onChange={(e) => {
                        setNewRemoteBrowser({ ...newRemoteBrowser, url: e.target.value });
                        setBrowserTestResult(null);
                      }}
                    />
                    <p className="text-xs text-slate-500">{t("exampleWebsocketUrl")}</p>
                    
                    {browserTestResult && (
                      <div className={`rounded-lg p-3 text-sm ${
                        browserTestResult.success 
                          ? 'bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400'
                          : 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400'
                      }`}>
                        {browserTestResult.success ? '✓' : '✗'} {browserTestResult.message}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={testRemoteBrowser} 
                        disabled={testingBrowser || !newRemoteBrowser.url}
                        variant="outline"
                        className="flex-1"
                      >
                        {testingBrowser ? 'Testing...' : 'Test Connection'}
                      </Button>
                      <Button 
                        onClick={addRemoteBrowser} 
                        className="gap-2 flex-1"
                        disabled={!newRemoteBrowser.name || !newRemoteBrowser.url}
                      >
                        <Plus className="h-4 w-4" />
                        {t("addRemoteBrowser")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("security")}</h2>
                
                <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{t("changePassword")}</h3>
                  <div className="space-y-3">
                    <div className="relative">
                      <Label>{t("currentPassword")}</Label>
                      <Input
                        type={showPasswords ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={t("currentPasswordPlaceholder")}
                      />
                    </div>
                    <div className="relative">
                      <Label>{t("newPassword")}</Label>
                      <Input
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t("newPasswordPlaceholder")}
                      />
                    </div>
                    <div className="relative">
                      <Label>{t("repeatNewPassword")}</Label>
                      <Input
                        type={showPasswords ? "text" : "password"}
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                        placeholder={t("repeatPasswordPlaceholder")}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-white"
                      >
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showPasswords ? t("hidePasswords") : t("showPasswords")}
                      </button>
                    </div>
                    <Button onClick={changePassword} className="gap-2">
                      <Save className="h-4 w-4" />
                      {t("changePassword")}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-4">
                  <h3 className="mb-2 font-semibold text-blue-600 dark:text-blue-400">{t("twoFactorAuth")}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t("comingSoon")}</p>
                </div>

                <div className="rounded-xl border border-slate-300 dark:border-slate-500/20 bg-slate-100 dark:bg-slate-500/10 p-4">
                  <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">{t("advanced")}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t("additionalSecurity")}</p>
                </div>
              </div>
            )}

            {activeTab === "api-keys" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("apiKeys")}</h2>
                
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">{key.label}</p>
                        <div className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          {key.token ? (
                            <>
                              <code className="rounded bg-black/30 px-2 py-1 font-mono">{key.token}</code>
                              <button
                                onClick={() => copyToClipboard(key.token!)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                              >
                                {copiedKey === key.token ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                {t("wontBeShownAgain")}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>{t("created")}: {new Date(key.createdAt).toLocaleDateString()}</span>
                              {key.lastUsedAt && (
                                <span>• {t("lastUsed")}: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                              )}
                              <span>• Permissions: {key.permissions || 'READ'}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => deleteApiKey(key.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{t("generateNewApiKey")}</h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="api-key-label" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Label
                        </Label>
                        <Input
                          id="api-key-label"
                          placeholder={t("keyLabelPlaceholder")}
                          value={newApiKeyLabel}
                          onChange={(e) => setNewApiKeyLabel(e.target.value)}
                        />
                      </div>
                      <div className="w-32">
                        <Label htmlFor="api-key-permissions" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Permissions
                        </Label>
                        <select
                          id="api-key-permissions"
                          value={newApiKeyPermissions}
                          onChange={(e) => setNewApiKeyPermissions(e.target.value as "READ" | "WRITE")}
                          className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="READ">READ</option>
                          {user?.role === "ADMIN" && <option value="WRITE">WRITE</option>}
                        </select>
                      </div>
                    </div>
                    <Button onClick={createApiKey} className="gap-2 w-full sm:w-auto">
                      <Plus className="h-4 w-4" />
                      {t("generate")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "proxies" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("proxies")}</h2>
                
                {proxies.length === 0 ? (
                  <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center">
                    <p className="text-slate-400">{t("notAvailablePleaseSetup")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {proxies.map((proxy) => (
                      <div
                        key={proxy.id}
                        className="flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{proxy.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {proxy.protocol}://{proxy.host}:{proxy.port}
                            {proxy.auth?.username && ` (${t("authenticated")})`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => deleteProxy(proxy.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{t("addProxy")}</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder={t("proxyNamePlaceholder")}
                      value={newProxy.name}
                      onChange={(e) => setNewProxy({ ...newProxy, name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Protocol</Label>
                        <select
                          value={newProxy.protocol}
                          onChange={(e) => setNewProxy({ ...newProxy, protocol: e.target.value })}
                          className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks4">SOCKS4</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                      </div>
                      <div>
                        <Label>{t("port")}</Label>
                        <Input
                          type="number"
                          placeholder={t("portPlaceholder")}
                          value={newProxy.port}
                          onChange={(e) => setNewProxy({ ...newProxy, port: parseInt(e.target.value) || 8080 })}
                        />
                      </div>
                    </div>
                    <Input
                      placeholder={t("hostPlaceholder")}
                      value={newProxy.host}
                      onChange={(e) => setNewProxy({ ...newProxy, host: e.target.value })}
                    />
                    <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-3">
                      <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">{t("authenticationOptional")}</p>
                      <div className="space-y-2">
                        <Input
                          placeholder={t("usernamePlaceholder")}
                          value={newProxy.auth?.username || ""}
                          onChange={(e) =>
                            setNewProxy({
                              ...newProxy,
                              auth: { ...newProxy.auth, username: e.target.value, password: newProxy.auth?.password || "" },
                            })
                          }
                        />
                        <Input
                          type="password"
                          placeholder={t("passwordPlaceholder")}
                          value={newProxy.auth?.password || ""}
                          onChange={(e) =>
                            setNewProxy({
                              ...newProxy,
                              auth: { ...newProxy.auth, password: e.target.value, username: newProxy.auth?.username || "" },
                            })
                          }
                        />
                      </div>
                    </div>
                    <Button onClick={addProxy} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {t("addProxy")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("userManagement")}</h2>
                
                {/* Users List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("users")}</h3>
                  {users.length === 0 ? (
                    <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center">
                      <p className="text-slate-400">{t("noUsersFound")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">{user.email}</p>
                            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                              <span>Created: {new Date(user.createdAt).toLocaleDateString()}</span>
                              {user._count && <span>• {user._count.apiKeys} API key{user._count.apiKeys !== 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={user.role}
                              onChange={(e) => updateUserRole(user.id, e.target.value as "ADMIN" | "VIEWER")}
                              className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1.5 text-sm text-slate-900 dark:text-white"
                            >
                              <option value="ADMIN">Admin</option>
                              <option value="VIEWER">Viewer</option>
                            </select>
                            <Button
                              variant="ghost"
                              onClick={() => deleteUser(user.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create User Form */}
                <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{t("createNewUser")}</h3>
                  <div className="space-y-3">
                    <Input
                      type="email"
                      placeholder={t("newUserEmailPlaceholder")}
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder={t("newUserPasswordPlaceholder")}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                    <div>
                      <Label>{t("role")}</Label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value as "ADMIN" | "VIEWER" })}
                        className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                    <Button onClick={createUser} className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Create User
                    </Button>
                  </div>
                </div>

                {/* Invitations Section */}
                <div className="space-y-4 border-t border-slate-300 dark:border-white/10 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("pendingInvitations")}</h3>
                  {invitations.length === 0 ? (
                    <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center">
                      <p className="text-slate-400">{t("noPendingInvitations")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {invitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">{invitation.email}</p>
                            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                              <span>Role: {invitation.role}</span>
                              <span>• Expires: {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                              {invitation.createdBy && <span>• By: {invitation.createdBy.email}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => copyInviteLink(invitation.token, invitation.id)}
                              className={copiedInviteLink === invitation.id ? "text-green-400" : ""}
                            >
                              {copiedInviteLink === invitation.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => deleteInvitation(invitation.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create Invitation Form */}
                <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{t("sendEmailInvitation")}</h3>
                  <div className="space-y-3">
                    <Input
                      type="email"
                      placeholder={t("emailAddress")}
                      value={newInvitation.email}
                      onChange={(e) => setNewInvitation({ ...newInvitation, email: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Role</Label>
                        <select
                          value={newInvitation.role}
                          onChange={(e) => setNewInvitation({ ...newInvitation, role: e.target.value as "ADMIN" | "VIEWER" })}
                          className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                        >
                          <option value="VIEWER">Viewer</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                      <div>
                        <Label>Expires In</Label>
                        <select
                          value={newInvitation.expiresInDays}
                          onChange={(e) => setNewInvitation({ ...newInvitation, expiresInDays: parseInt(e.target.value) })}
                          className="h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white"
                        >
                          <option value="1">1 day</option>
                          <option value="3">3 days</option>
                          <option value="7">7 days</option>
                          <option value="14">14 days</option>
                          <option value="30">30 days</option>
                        </select>
                      </div>
                    </div>
                    <Button onClick={createInvitation} className="gap-2">
                      <Mail className="h-4 w-4" />
                      Create Invitation
                    </Button>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      An invitation link will be generated and copied to your clipboard
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "backup-restore" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("backupRestore")}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Export Section */}
                  <div className="space-y-4 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-6">
                    <div className="flex items-center gap-3">
                      <Download className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white">{t("exportSettings")}</h3>
                    </div>
                    
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Export all your settings, monitors, notification channels, and other configuration data to a JSON file.
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="export-password" className="text-sm font-medium">
                          Encryption Password (Optional)
                        </Label>
                        <Input
                          id="export-password"
                          type="password"
                          value={exportPassword}
                          onChange={(e) => setExportPassword(e.target.value)}
                          placeholder="Leave empty for unencrypted export"
                          className="mt-1"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Password protects your exported data with AES-256 encryption
                        </p>
                      </div>
                      
                      <Button 
                        onClick={exportSettings} 
                        disabled={backupRestoreLoading}
                        className="w-full gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {backupRestoreLoading ? "Exporting..." : "Export Settings"}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Import Section */}
                  <div className="space-y-4 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-6">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white">{t("importSettings")}</h3>
                    </div>
                    
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Import settings from a previously exported JSON file. This will replace all current data.
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="import-file" className="text-sm font-medium">
                          Settings File
                        </Label>
                        <Input
                          id="import-file"
                          type="file"
                          accept=".json"
                          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="import-password" className="text-sm font-medium">
                          Decryption Password (if encrypted)
                        </Label>
                        <Input
                          id="import-password"
                          type="password"
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                          placeholder="Leave empty if not encrypted"
                          className="mt-1"
                        />
                      </div>
                      
                      <Button 
                        onClick={importSettings} 
                        disabled={backupRestoreLoading || !importFile}
                        className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Upload className="h-4 w-4" />
                        {backupRestoreLoading ? "Importing..." : "Import Settings"}
                      </Button>
                      
                      <p className="text-xs text-red-600 dark:text-red-400">
                        ⚠️ This action cannot be undone. Make sure to backup your current settings first.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Information Section */}
                <div className="rounded-xl border border-blue-300 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 p-6">
                  <h4 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">{t("whatGetsExported")}</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Application settings and preferences</li>
                    <li>• All monitors and their configurations</li>
                    <li>• Monitor groups and tags</li>
                    <li>• Notification channels</li>
                    <li>• Maintenance windows</li>
                    <li>• Status pages</li>
                    <li>• API keys (without actual tokens)</li>
                    <li>• Docker hosts and remote browsers</li>
                    <li>• Proxy configurations</li>
                    <li>• User accounts and invitations</li>
                  </ul>
                  
                  <h4 className="text-lg font-medium text-blue-900 dark:text-blue-100 mt-4 mb-2">{t("securityNote")}</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Exported files can be encrypted with AES-256 encryption. Always use a strong password and keep it safe.
                    The export does not include sensitive data like actual API tokens or passwords.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "about" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("about")}</h2>
                
                <div className="space-y-4 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{t("version")}:</span>
                    <span className="font-mono text-slate-900 dark:text-white">2.0.2</span>
                  </div>
                  {versionInfo && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{t("latestVersion")}:</span>
                        <span className="font-mono text-slate-900 dark:text-white">{versionInfo.latest}</span>
                      </div>
                      {versionInfo.updateAvailable && (
                        <div className="rounded-lg border border-green-500/30 dark:border-green-500/20 bg-green-500/10 p-3">
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">
                            {t("updateAvailable")} - v{versionInfo.latest}
                          </p>
                        </div>
                      )}
                      {!versionInfo.updateAvailable && (
                        <div className="rounded-lg border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-3">
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {t("upToDate")}
                          </p>
                        </div>
                      )}
                      {versionInfo.betaAvailable && versionInfo.latestBeta && (
                        <div className="rounded-lg border border-yellow-500/30 dark:border-yellow-500/20 bg-yellow-500/10 p-3">
                          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                            Beta {t("updateAvailable")}: v{versionInfo.latestBeta}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  <div className="border-t border-white/10 pt-4">
                    <Button
                      variant="outline"
                      onClick={checkForUpdates}
                      disabled={checkingUpdates}
                      className="w-full"
                    >
                      {checkingUpdates ? t("loading") : t("checkForUpdates")}
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="checkUpdates"
                      checked={localSettings.checkUpdates || false}
                      onChange={async (e) => {
                        const newSettings = { ...localSettings, checkUpdates: e.target.checked };
                        setLocalSettings(newSettings);
                        // Auto-save this setting
                        try {
                          await updateGlobalSettings(newSettings, token);
                        } catch (error) {
                          console.error("Failed to save checkUpdates setting:", error);
                        }
                      }}
                      className="h-5 w-5 rounded border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5"
                    />
                    <Label htmlFor="checkUpdates" className="cursor-pointer text-sm">
                      {t("showUpdateIfAvailable")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="checkBeta"
                      checked={localSettings.checkBetaReleases || false}
                      onChange={async (e) => {
                        const newSettings = { ...localSettings, checkBetaReleases: e.target.checked };
                        setLocalSettings(newSettings);
                        // Auto-save this setting
                        try {
                          await updateGlobalSettings(newSettings, token);
                        } catch (error) {
                          console.error("Failed to save checkBetaReleases setting:", error);
                        }
                      }}
                      className="h-5 w-5 rounded border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5"
                    />
                    <Label htmlFor="checkBeta" className="cursor-pointer text-sm">
                      {t("alsoCheckBetaRelease")}
                    </Label>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-6 text-center">
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">UptivaLab</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {t("comprehensiveMonitoring")}
                  </p>
                  <p className="mt-4 text-xs text-slate-400">
                    © {new Date().getFullYear()} UptivaLab. {t("allRightsReserved")}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("notifications")}</h2>
                <div className="rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/10 p-6">
                  <p className="text-slate-600 dark:text-slate-300">
                    Notification channels are configured in the{" "}
                    <a href="/notifications" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                      Notifications
                    </a>{" "}
                    page.
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Global notification settings coming soon...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
