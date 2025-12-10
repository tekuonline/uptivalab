import { useState, useEffect } from "react";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import { useSettings } from "../providers/settings-context.js";
import { useTranslation } from "../hooks/use-translation.js";
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
  Check
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
  | "proxies" 
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
  token?: string;
  createdAt: string;
  lastUsedAt?: string;
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

export const SettingsRoute = () => {
  const { t } = useTranslation();
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
  const [copiedKey, setCopiedKey] = useState("");

  // Docker Hosts
  const [dockerHosts, setDockerHosts] = useState<DockerHost[]>([]);
  const [newDockerHost, setNewDockerHost] = useState({ name: "", url: "" });

  // Remote Browsers
  const [remoteBrowsers, setRemoteBrowsers] = useState<RemoteBrowser[]>([]);
  const [newRemoteBrowser, setNewRemoteBrowser] = useState({ name: "", url: "" });

  // Proxies
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [newProxy, setNewProxy] = useState({
    name: "",
    protocol: "http",
    host: "",
    port: 8080,
    auth: { username: "", password: "" },
  });

  useEffect(() => {
    // Initialize local settings from global context
    setLocalSettings(globalSettings);
    loadApiKeys();
    loadDockerHosts();
    loadRemoteBrowsers();
    loadProxies();
  }, [globalSettings]);

  const saveSettings = async () => {
    setLoading(true);
    try {
      await updateGlobalSettings(localSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
      } else {
        const data = await res.json();
        alert(data.message || t("failedToChangePassword"));
      }
    } catch (error) {
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
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  };

  const createApiKey = async () => {
    if (!newApiKeyLabel.trim()) return;

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
    } catch (error) {
      console.error("Failed to create API key:", error);
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      const token = localStorage.getItem("uptivalab.token");
      await fetch(`/api/settings/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const token = localStorage.getItem("uptivalab.token");
      const res = await fetch("/api/settings/docker-hosts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDockerHosts(await res.json());
      }
    } catch (error) {
      console.error("Failed to load docker hosts:", error);
    }
  };

  const addDockerHost = async () => {
    if (!newDockerHost.name || !newDockerHost.url) return;

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
    } catch (error) {
      console.error("Failed to add docker host:", error);
    }
  };

  const deleteDockerHost = async (id: string) => {
    try {
      const token = localStorage.getItem("uptivalab.token");
      await fetch(`/api/settings/docker-hosts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDockerHosts(dockerHosts.filter((h) => h.id !== id));
    } catch (error) {
      console.error("Failed to delete docker host:", error);
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
    } catch (error) {
      console.error("Failed to load remote browsers:", error);
    }
  };

  const addRemoteBrowser = async () => {
    if (!newRemoteBrowser.name || !newRemoteBrowser.url) return;

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
    } catch (error) {
      console.error("Failed to add remote browser:", error);
    }
  };

  const deleteRemoteBrowser = async (id: string) => {
    try {
      const token = localStorage.getItem("uptivalab.token");
      await fetch(`/api/settings/remote-browsers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setRemoteBrowsers(remoteBrowsers.filter((b) => b.id !== id));
    } catch (error) {
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
    } catch (error) {
      console.error("Failed to load proxies:", error);
    }
  };

  const addProxy = async () => {
    if (!newProxy.name || !newProxy.host || !newProxy.port) return;

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
    } catch (error) {
      console.error("Failed to add proxy:", error);
    }
  };

  const deleteProxy = async (id: string) => {
    try {
      const token = localStorage.getItem("uptivalab.token");
      await fetch(`/api/settings/proxies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setProxies(proxies.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Failed to delete proxy:", error);
    }
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
    { id: "proxies", label: t("proxies"), icon: Network },
    { id: "about", label: t("about"), icon: Info },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t("settings")}</h1>
        {activeTab !== "security" && activeTab !== "api-keys" && activeTab !== "docker-hosts" && 
         activeTab !== "remote-browsers" && activeTab !== "proxies" && (
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
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
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
                <h2 className="text-2xl font-semibold text-white">{t("general")}</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label>{t("displayTimezone")}</Label>
                    <Input
                      value={localSettings.displayTimezone || ""}
                      onChange={(e) => setLocalSettings({ ...localSettings, displayTimezone: e.target.value })}
                      placeholder={t("displayTimezonePlaceholder")}
                    />
                  </div>

                  <div>
                    <Label>{t("serverTimezone")}</Label>
                    <Input
                      value={localSettings.serverTimezone || ""}
                      onChange={(e) => setLocalSettings({ ...localSettings, serverTimezone: e.target.value })}
                      placeholder={t("serverTimezonePlaceholder")}
                    />
                  </div>

                  <div>
                    <Label>{t("searchEngineVisibility")}</Label>
                    <select
                      value={localSettings.searchEngineVisibility || "allow"}
                      onChange={(e) => setLocalSettings({ ...localSettings, searchEngineVisibility: e.target.value as any })}
                      className="h-[46px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
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
                      className="h-[46px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
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
                    <p className="mt-1 text-sm text-slate-400">{t("primaryBaseUrlDescription")}</p>
                  </div>

                  <div>
                    <Label>{t("steamApiKey")}</Label>
                    <Input
                      value={localSettings.steamApiKey || ""}
                      onChange={(e) => setLocalSettings({ ...localSettings, steamApiKey: e.target.value })}
                      placeholder={t("steamApiKeyPlaceholder")}
                    />
                    <p className="mt-1 text-sm text-slate-400">
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
                    <p className="mb-2 text-sm text-slate-400">{t("enableNscdDescription")}</p>
                    <select
                      value={localSettings.enableNscd ? "true" : "false"}
                      onChange={(e) => setLocalSettings({ ...localSettings, enableNscd: e.target.value === "true" })}
                      className="h-[46px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
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
                    <p className="mt-1 text-sm text-slate-400">{t("chromeExecutableDescription")}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white">{t("appearance")}</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label>{t("language")}</Label>
                    <select
                      value={localSettings.language || "en"}
                      onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value })}
                      className="h-[46px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
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
                      onChange={(e) => setLocalSettings({ ...localSettings, theme: e.target.value as any })}
                      className="h-[46px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
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
                      className="h-[46px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
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
                      className="h-5 w-5 rounded border-white/10 bg-white/5"
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
                <h2 className="text-2xl font-semibold text-white">{t("reverseProxy")}</h2>
                
                <div className="space-y-6">
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <h3 className="mb-2 font-semibold text-blue-400">{t("cloudflareTunnel")}</h3>
                    <div className="mb-3 space-y-1 text-sm text-slate-300">
                      <p>{t("cloudflared")}: {localSettings.cloudflaredInstalled ? `✓ ${t("installed")}` : `✗ ${t("notInstalled")}`}</p>
                      <p>{t("status")}: {localSettings.cloudflaredRunning ? `✓ ${t("running")}` : `✗ ${t("notRunning")}`}</p>
                    </div>
                    <Label>{t("cloudflareTunnelToken")}</Label>
                    <Input
                      value={localSettings.cloudflareTunnelToken || ""}
                      onChange={(e) => setLocalSettings({ ...localSettings, cloudflareTunnelToken: e.target.value })}
                      placeholder={t("tunnelTokenPlaceholder")}
                    />
                    <p className="mt-2 text-sm text-slate-400">
                      {t("dontKnowToken")}{" "}
                      <a
                        href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy-with-Cloudflare-Tunnel"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {t("guide")}
                      </a>
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-4">
                    <h3 className="mb-2 font-semibold text-white">{t("otherSoftware")}</h3>
                    <p className="mb-3 text-sm text-slate-300">
                      {t("otherSoftwareExample")}
                    </p>
                    <p className="text-sm text-slate-400">
                      {t("pleaseRead")}{" "}
                      <a
                        href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
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
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white"
                    />
                  </div>

                  <div>
                    <Label>{t("trustProxy")}</Label>
                    <select
                      value={localSettings.trustProxy ? "yes" : "no"}
                      onChange={(e) => setLocalSettings({ ...localSettings, trustProxy: e.target.value === "yes" })}
                      className="h-[46px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
                    >
                      <option value="yes">{t("yes")}</option>
                      <option value="no">{t("no")}</option>
                    </select>
                    <p className="mt-1 text-sm text-slate-400">
                      {t("trustProxyDescription")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "docker-hosts" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white">{t("dockerHosts")}</h2>
                
                {dockerHosts.length === 0 ? (
                  <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center">
                    <p className="text-slate-400">Not available, please set up.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dockerHosts.map((host) => (
                      <div
                        key={host.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div>
                          <p className="font-medium text-white">{host.name}</p>
                          <p className="text-sm text-slate-400">{host.url}</p>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => deleteDockerHost(host.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-white">{t("addDockerHost")}</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder={t("namePlaceholder")}
                      value={newDockerHost.name}
                      onChange={(e) => setNewDockerHost({ ...newDockerHost, name: e.target.value })}
                    />
                    <Input
                      placeholder={t("dockerSocketUrl")}
                      value={newDockerHost.url}
                      onChange={(e) => setNewDockerHost({ ...newDockerHost, url: e.target.value })}
                    />
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
                <h2 className="text-2xl font-semibold text-white">{t("remoteBrowsers")}</h2>
                
                {remoteBrowsers.length === 0 ? (
                  <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center">
                    <p className="text-slate-400">{t("notAvailablePleaseSetup")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {remoteBrowsers.map((browser) => (
                      <div
                        key={browser.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div>
                          <p className="font-medium text-white">{browser.name}</p>
                          <p className="text-sm text-slate-400">{browser.url}</p>
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

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-white">{t("addRemoteBrowser")}</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder={t("namePlaceholder")}
                      value={newRemoteBrowser.name}
                      onChange={(e) => setNewRemoteBrowser({ ...newRemoteBrowser, name: e.target.value })}
                    />
                    <Input
                      placeholder={t("websocketUrl")}
                      value={newRemoteBrowser.url}
                      onChange={(e) => setNewRemoteBrowser({ ...newRemoteBrowser, url: e.target.value })}
                    />
                    <Button onClick={addRemoteBrowser} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {t("addRemoteBrowser")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white">{t("security")}</h2>
                
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-white">{t("changePassword")}</h3>
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
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
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

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                  <h3 className="mb-2 font-semibold text-blue-400">{t("twoFactorAuth")}</h3>
                  <p className="text-sm text-slate-400">{t("comingSoon")}</p>
                </div>

                <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-4">
                  <h3 className="mb-2 font-semibold text-white">{t("advanced")}</h3>
                  <p className="text-sm text-slate-400">{t("additionalSecurity")}</p>
                </div>
              </div>
            )}

            {activeTab === "api-keys" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white">{t("apiKeys")}</h2>
                
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-white">{key.label}</p>
                        <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                          {key.token ? (
                            <>
                              <code className="rounded bg-black/30 px-2 py-1 font-mono">{key.token}</code>
                              <button
                                onClick={() => copyToClipboard(key.token!)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                {copiedKey === key.token ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                              <span className="text-xs text-yellow-400">
                                {t("wontBeShownAgain")}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>{t("created")}: {new Date(key.createdAt).toLocaleDateString()}</span>
                              {key.lastUsedAt && (
                                <span>• {t("lastUsed")}: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                              )}
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

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-white">{t("generateNewApiKey")}</h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("keyLabelPlaceholder")}
                      value={newApiKeyLabel}
                      onChange={(e) => setNewApiKeyLabel(e.target.value)}
                    />
                    <Button onClick={createApiKey} className="gap-2 whitespace-nowrap">
                      <Plus className="h-4 w-4" />
                      {t("generate")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "proxies" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white">{t("proxies")}</h2>
                
                {proxies.length === 0 ? (
                  <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-8 text-center">
                    <p className="text-slate-400">{t("notAvailablePleaseSetup")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {proxies.map((proxy) => (
                      <div
                        key={proxy.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div>
                          <p className="font-medium text-white">{proxy.name}</p>
                          <p className="text-sm text-slate-400">
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

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 font-semibold text-white">Add Proxy</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder="Name"
                      value={newProxy.name}
                      onChange={(e) => setNewProxy({ ...newProxy, name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Protocol</Label>
                        <select
                          value={newProxy.protocol}
                          onChange={(e) => setNewProxy({ ...newProxy, protocol: e.target.value })}
                          className="h-[46px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
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
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="mb-2 text-sm font-medium text-white">{t("authenticationOptional")}</p>
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

            {activeTab === "about" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white">{t("about")}</h2>
                
                <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{t("version")}:</span>
                    <span className="font-mono text-white">2.0.2</span>
                  </div>
                  {versionInfo && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{t("latestVersion")}:</span>
                        <span className="font-mono text-white">{versionInfo.latest}</span>
                      </div>
                      {versionInfo.updateAvailable && (
                        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                          <p className="text-sm font-medium text-green-400">
                            {t("updateAvailable")} - v{versionInfo.latest}
                          </p>
                        </div>
                      )}
                      {!versionInfo.updateAvailable && (
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                          <p className="text-sm font-medium text-blue-400">
                            {t("upToDate")}
                          </p>
                        </div>
                      )}
                      {versionInfo.betaAvailable && versionInfo.latestBeta && (
                        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                          <p className="text-sm font-medium text-yellow-400">
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
                      onChange={(e) => setLocalSettings({ ...localSettings, checkUpdates: e.target.checked })}
                      className="h-5 w-5 rounded border-white/10 bg-white/5"
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
                      onChange={(e) => setLocalSettings({ ...localSettings, checkBetaReleases: e.target.checked })}
                      className="h-5 w-5 rounded border-white/10 bg-white/5"
                    />
                    <Label htmlFor="checkBeta" className="cursor-pointer text-sm">
                      {t("alsoCheckBetaRelease")}
                    </Label>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-6 text-center">
                  <h3 className="mb-2 text-lg font-semibold text-white">UptivaLab</h3>
                  <p className="text-sm text-slate-300">
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
                <h2 className="text-2xl font-semibold text-white">{t("notifications")}</h2>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-6">
                  <p className="text-slate-300">
                    Notification channels are configured in the{" "}
                    <a href="/notifications" className="text-blue-400 hover:underline">
                      Notifications
                    </a>{" "}
                    page.
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
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
