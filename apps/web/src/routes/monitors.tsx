import type { Monitor } from "@uptivalab/shared";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Docker state
  const [dockerHosts, setDockerHosts] = useState<any[]>([]);
  const [selectedDockerHost, setSelectedDockerHost] = useState("");
  const [dockerResources, setDockerResources] = useState<any>(null);
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
    tagIds: [] as string[],
    notificationIds: [] as string[],
    
    // Advanced options
    createIncidents: true,
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
    url: "",           // http
    host: "",          // tcp, ping, certificate
    port: "",          // tcp, certificate
    record: "",        // dns
    recordType: "A",   // dns
    containerName: "", // docker
    connectionString: "", // database
    variant: "postgres",  // database
    target: "",        // grpc
    heartbeatSeconds: "300", // push
    dockerHostId: "",  // docker - selected host
    
    // Synthetic monitor fields
    browser: "chromium",     // synthetic - browser type
    useLocalBrowser: false,  // synthetic - use local vs remote
    steps: "",               // synthetic - JSON string of steps array
  });
  
  const buildConfig = (formData: typeof form) => {
    const baseConfig: Record<string, unknown> = {};
    
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
        } catch {
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
        } catch (error) {
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
      createIncidents: true,
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
      useLocalBrowser: true, // Default to embedded browser
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
        createIncidents: form.createIncidents,
        notificationIds: form.notificationIds,
      };
      
      if (editingId) {
        return api.updateMonitor(token, editingId, payload);
      } else {
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
    const state = location.state as { editMonitor?: any };
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
    } catch (error) {
      console.error("Failed to load Docker hosts:", error);
    }
  };

  const loadDockerResources = async (dockerHostId: string) => {
    if (!dockerHostId) return;

    setLoadingDockerResources(true);
    try {
      const data = await api.getDockerHostResources(token, dockerHostId);
      setDockerResources(data);
    } catch (error) {
      console.error("Failed to load Docker resources:", error);
      alert(`Failed to load Docker resources: ${error instanceof Error ? error.message : error}\n\nCheck:\n- Docker host settings in Settings → Docker Hosts\n- Browser console for detailed errors\n- Docker daemon configuration`);
      setDockerResources(null);
    } finally {
      setLoadingDockerResources(false);
    }
  };

  const handleDockerHostChange = (hostId: string) => {
    setSelectedDockerHost(hostId);
    setForm((prev) => ({ ...prev, dockerHostId: hostId, containerName: "" }));
    if (hostId) {
      loadDockerResources(hostId);
    } else {
      setDockerResources(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMonitor(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const handleDelete = (monitor: Monitor) => {
    const confirmMessage = `${t("confirmDelete")} "${monitor.name}"?`;
    if (window.confirm(confirmMessage)) {
      deleteMutation.mutate(monitor.id);
    }
  };
  
  const handleClone = (monitor: any) => {
    // Parse config back to form fields
    const config = monitor.config as any;
    
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
      createIncidents: monitor.createIncidents ?? true,
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
  
  const handleEdit = (monitor: any) => {
    setEditingId(monitor.id);
    const config = monitor.config as any;
    
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
      createIncidents: monitor.createIncidents ?? true,
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white truncate">
              {editingId ? t("editMonitor") : t("createNewMonitor")}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{t("createMonitorDescription")}</p>
          </div>
          {editingId && (
            <Button variant="ghost" onClick={handleCancelEdit} className="flex items-center gap-2 shrink-0">
              <X className="h-4 w-4" />
              {t("cancel")}
            </Button>
          )}
        </div>
        <form
          className="space-y-4 sm:space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {/* General Section */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-900 dark:text-white uppercase tracking-wider">{t("general")}</h4>
            
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="mb-1 sm:mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("monitorType")}</label>
                <select
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 sm:px-4 py-2 sm:py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white"
                  value={form.kind}
                  onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
                >
                  <option value="http">HTTP(s) - HTTP/HTTPS</option>
                  <option value="tcp">TCP Port</option>
                  <option value="ping">Ping</option>
                  <option value="dns">DNS</option>
                  <option value="docker">Docker Container</option>
                  <option value="certificate">SSL Certificate</option>
                  <option value="database">Database</option>
                  <option value="synthetic">Synthetic Journey</option>
                  <option value="grpc">gRPC</option>
                  <option value="push">Push</option>
                </select>
              </div>
              
              <div>
                <label className="mb-1 sm:mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("friendlyName")}</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  placeholder={t("monitorNamePlaceholder")}
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            {/* URL/Host Field */}
            {form.kind === "http" && (
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("url")}</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  placeholder={t("urlPlaceholder")}
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  required
                />
              </div>
            )}
            
            {form.kind === "tcp" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("hostname")}</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    placeholder={t("hostInputPlaceholder")}
                    value={form.host}
                    onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("port")}</label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    placeholder={t("portInputPlaceholder")}
                    value={form.port}
                    onChange={(e) => setForm((prev) => ({ ...prev, port: e.target.value }))}
                    min="1"
                    max="65535"
                    required
                  />
                </div>
              </div>
            )}
            
            {form.kind === "ping" && (
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("hostname")}</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  placeholder={t("dnsHostPlaceholder")}
                  value={form.host}
                  onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                  required
                />
              </div>
            )}
            
            {form.kind === "dns" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("hostname")}</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    placeholder={t("hostInputPlaceholder")}
                    value={form.record}
                    onChange={(e) => setForm((prev) => ({ ...prev, record: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("dnsRecordType")}</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]"
                    value={form.recordType}
                    onChange={(e) => setForm((prev) => ({ ...prev, recordType: e.target.value }))}
                  >
                    <option value="A">A</option>
                    <option value="AAAA">AAAA</option>
                    <option value="CNAME">CNAME</option>
                    <option value="MX">MX</option>
                    <option value="TXT">TXT</option>
                  </select>
                </div>
              </div>
            )}
            
            {form.kind === "docker" && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t("dockerHost")} {dockerHosts.length === 0 && <span className="text-red-600 dark:text-red-400">({t("noHostsConfigured")})</span>}
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]"
                    value={form.dockerHostId}
                    onChange={(e) => handleDockerHostChange(e.target.value)}
                    required
                  >
                    <option value="">{t("selectDockerHost")}</option>
                    {dockerHosts.map((host) => (
                      <option key={host.id} value={host.id}>
                        {host.name} ({host.url})
                      </option>
                    ))}
                  </select>
                  {dockerHosts.length === 0 && (
                    <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                      ⚠️ {t("addDockerHostWarning")}
                    </p>
                  )}
                </div>

                {loadingDockerResources && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20 p-3">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      <RefreshCw className="inline h-4 w-4 animate-spin mr-2" />
                      {t("loadingDockerResources")}
                    </p>
                  </div>
                )}

                {dockerResources && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/30 dark:border-green-500/20 p-3 space-y-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                      ✓ {t("connectedToDocker").replace("{version}", dockerResources.serverVersion)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {t("foundDockerResources").replace("{containers}", String(dockerResources.containers.length)).replace("{networks}", String(dockerResources.networks.length)).replace("{volumes}", String(dockerResources.volumes.length))}
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t("containerNameIdLabel")}
                  </label>
                  {dockerResources && dockerResources.containers.length > 0 ? (
                    <select
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]"
                      value={form.containerName}
                      onChange={(e) => setForm((prev) => ({ ...prev, containerName: e.target.value }))}
                      required
                    >
                      <option value="">{t("selectContainer")}</option>
                      {dockerResources.containers.map((container: any) => (
                        <option key={container.id} value={container.name}>
                          {container.name} ({container.image}) - {container.state}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                      placeholder="my-container or container-id"
                      value={form.containerName}
                      onChange={(e) => setForm((prev) => ({ ...prev, containerName: e.target.value }))}
                      required
                    />
                  )}
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {dockerResources ? t("selectFromRunningContainers") : t("enterContainerManually")}
                  </p>
                </div>
              </div>
            )}
            
            {form.kind === "certificate" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("hostname")}</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    placeholder={t("certHostPlaceholder")}
                    value={form.host}
                    onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("port")}</label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    placeholder={t("certPortPlaceholder")}
                    value={form.port}
                    onChange={(e) => setForm((prev) => ({ ...prev, port: e.target.value }))}
                    min="1"
                    max="65535"
                  />
                </div>
              </div>
            )}
            
            {form.kind === "database" && (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("databaseType")}</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]"
                    value={form.variant}
                    onChange={(e) => setForm((prev) => ({ ...prev, variant: e.target.value }))}
                  >
                    <option value="postgres">{t("postgresqlDb")}</option>
                    <option value="mysql">{t("mysqlDb")}</option>
                    <option value="mongodb">{t("mongodbDb")}</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("connectionString")}</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    placeholder={t("dbConnectionString")}
                    value={form.connectionString}
                    onChange={(e) => setForm((prev) => ({ ...prev, connectionString: e.target.value }))}
                    required
                  />
                </div>
              </div>
            )}
            
            {form.kind === "grpc" && (
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("hostPort")}</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  placeholder={t("grpcTargetPlaceholder")}
                  value={form.target}
                  onChange={(e) => setForm((prev) => ({ ...prev, target: e.target.value }))}
                  required
                />
              </div>
            )}
            
            {form.kind === "push" && (
              <>
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20 p-4">
                  <div className="flex items-start gap-2">
                    <div className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
                    <div className="flex-1 text-sm text-slate-600 dark:text-slate-300">
                      <p className="font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-1">{t("pushHeartbeatTitle")}</p>
                      <p className="mb-2">
                        {t("pushHeartbeatDescription")}
                      </p>
                      <p className="text-xs text-slate-400">
                        💡 {t("pushHeartbeatUseCase")}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("heartbeatInterval")} ({t("seconds")})</label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    placeholder="300"
                    value={form.heartbeatSeconds}
                    onChange={(e) => setForm((prev) => ({ ...prev, heartbeatSeconds: e.target.value }))}
                    min="60"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">{t("heartbeatIntervalHelp")}</p>
                </div>
              </>
            )}
            
            {form.kind === "synthetic" && (
              <>
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 dark:border-purple-500/20 p-4">
                  <div className="flex items-start gap-2">
                    <div className="text-purple-600 dark:text-purple-400 mt-0.5">🎭</div>
                    <div className="flex-1 text-sm text-slate-600 dark:text-slate-300">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">{t("syntheticJourneyMonitoring")}</p>
                      <p className="mb-2">
                        {t("createMultiStepTests")}
                      </p>
                      <p className="text-xs text-slate-400">
                        {t("usesPlaywright")}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => navigate('/synthetic-recorder')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  >
                    🎬 Open Visual Step Builder
                  </button>
                </div>
                
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("baseUrlOptional")}</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    placeholder="https://example.com"
                    value={form.url}
                    onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">{t("baseUrlHelp")}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("browserType")}</label>
                    <select
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]"
                      value={form.browser || 'chromium'}
                      onChange={(e) => setForm((prev) => ({ ...prev, browser: e.target.value }))}
                    >
                      <option value="chromium">{t("chromium")}</option>
                      <option value="firefox">{t("firefox")}</option>
                      <option value="webkit">{t("webkit")}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("browserMode")}</label>
                    <select
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]"
                      value={form.useLocalBrowser ? 'local' : 'remote'}
                      onChange={(e) => setForm((prev) => ({ ...prev, useLocalBrowser: e.target.value === 'local' }))}
                    >
                      <option value="local">{t("localBrowser")}</option>
                      <option value="remote">{t("remoteBrowserRecommended")}</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">{t("remoteUsesPlaywright")}</p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Journey Steps
                    <span className="ml-2 text-slate-500">(JSON Array)</span>
                  </label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white font-mono"
                    placeholder={`[\n  {"action": "goto", "url": "https://example.com/login"},\n  {"action": "fill", "selector": "#email", "value": "test@example.com"},\n  {"action": "fill", "selector": "#password", "value": "secret"},\n  {"action": "click", "selector": "button[type=submit]"},\n  {"action": "waitForSelector", "selector": ".dashboard"}\n]`}
                    value={form.steps || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, steps: e.target.value }))}
                    rows={10}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {t("availableActions")} <a href="https://github.com/tekuonline/uptivaLab/blob/main/SYNTHETIC_MONITORING.md#available-step-actions" target="_blank" rel="noopener" className="text-purple-500 hover:underline">{t("documentation")}</a> {t("forDetails")}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("quickExamples")}</p>
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-mono">
                    <div><strong>{t("loginTest")}:</strong> goto → fill(email) → fill(password) → click(submit) → waitForSelector(.dashboard)</div>
                    <div><strong>{t("searchTest")}:</strong> goto → fill(searchBox) → click(searchButton) → waitForSelector(.results)</div>
                    <div><strong>{t("formTest")}:</strong> goto → fill(name) → fill(email) → click(submit) → waitForSelector(.success)</div>
                  </div>
                </div>
              </>
            )}
            
            {/* Interval and Timeout Settings */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t("heartbeatInterval")}
                  <span className="ml-2 text-slate-500">({t("checkEvery")} {form.interval} {t("seconds")})</span>
                </label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  value={form.interval}
                  onChange={(e) => setForm((prev) => ({ ...prev, interval: Number(e.target.value) }))}
                  min="30"
                  max="86400"
                  required
                />
              </div>
              
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t("retries")}
                </label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  placeholder={t("heartbeatSecondsPlaceholder").replace('300', '0')}
                  value={form.retries}
                  onChange={(e) => setForm((prev) => ({ ...prev, retries: Number(e.target.value) }))}
                  min="0"
                  max="5"
                />
                <p className="mt-1 text-xs text-slate-500">{t("retriesHelp")}</p>
              </div>
              
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t("requestTimeout")}
                  <span className="ml-2 text-slate-500">({t("timeoutAfter")} {form.timeout} {t("seconds")})</span>
                </label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  value={form.timeout}
                  onChange={(e) => setForm((prev) => ({ ...prev, timeout: Number(e.target.value) }))}
                  min="1"
                  max="300"
                  required
                />
              </div>
            </div>
          </div>

          {/* Incident Creation Toggle */}
          <div className="rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.createIncidents}
                onChange={(e) => setForm((prev) => ({ ...prev, createIncidents: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-blue-500"
              />
              <span className="text-sm font-medium text-slate-900 dark:text-white">{t("createIncidents")}</span>
            </label>
            <p className="mt-2 text-xs text-slate-500 ml-6">
              {t("createIncidentsHelp")}
            </p>
          </div>
          
          {/* Advanced Options - HTTP specific */}
          {form.kind === "http" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-900 dark:text-white uppercase tracking-wider hover:text-slate-300 transition"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {t("advancedOptions")}
              </button>
              
              {showAdvanced && (
                <div className="space-y-4 border-l-2 border-white/10 pl-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.ignoreTls}
                        onChange={(e) => setForm((prev) => ({ ...prev, ignoreTls: e.target.checked }))}
                        className="h-4 w-4 rounded border-white/20 bg-white/10 text-blue-500"
                      />
                      <span className="text-sm text-slate-900 dark:text-white">{t("ignoreTls")}</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.upsideDown}
                        onChange={(e) => setForm((prev) => ({ ...prev, upsideDown: e.target.checked }))}
                        className="h-4 w-4 rounded border-white/20 bg-white/10 text-blue-500"
                      />
                      <span className="text-sm text-slate-900 dark:text-white">{t("upsideDownMode")}</span>
                      <span className="text-xs text-slate-400">({t("upsideDownHelp")})</span>
                    </label>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("maxRedirects")}</label>
                      <input
                        type="number"
                        className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                        value={form.maxRedirects}
                        onChange={(e) => setForm((prev) => ({ ...prev, maxRedirects: Number(e.target.value) }))}
                        min="0"
                        max="20"
                      />
                      <p className="mt-1 text-xs text-slate-500">{t("maxRedirectsHelp")}</p>
                    </div>
                    
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("acceptedStatusCodes")}</label>
                      <input
                        className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                        placeholder="200-299"
                        value={form.acceptedStatusCodes}
                        onChange={(e) => setForm((prev) => ({ ...prev, acceptedStatusCodes: e.target.value }))}
                      />
                      <p className="mt-1 text-xs text-slate-500">{t("acceptedStatusCodesHelp")}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* HTTP Options */}
          {form.kind === "http" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowHttpOptions(!showHttpOptions)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-900 dark:text-white uppercase tracking-wider hover:text-slate-300 transition"
              >
                {showHttpOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {t("httpOptions")}
              </button>
              
              {showHttpOptions && (
                <div className="space-y-4 border-l-2 border-white/10 pl-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("method")}</label>
                    <select
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]"
                      value={form.method}
                      onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value }))}
                    >
                      <option value="GET">{t("httpMethodGet")}</option>
                      <option value="POST">{t("httpMethodPost")}</option>
                      <option value="PUT">{t("httpMethodPut")}</option>
                      <option value="PATCH">{t("httpMethodPatch")}</option>
                      <option value="DELETE">{t("httpMethodDelete")}</option>
                      <option value="HEAD">{t("httpMethodHead")}</option>
                      <option value="OPTIONS">{t("httpMethodOptions")}</option>
                    </select>
                  </div>
                  
                  {(form.method === "POST" || form.method === "PUT" || form.method === "PATCH") && (
                    <>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("bodyEncoding")}</label>
                        <select
                          className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]"
                          value={form.bodyEncoding}
                          onChange={(e) => setForm((prev) => ({ ...prev, bodyEncoding: e.target.value }))}
                        >
                          <option value="json">{t("bodyEncodingJson")}</option>
                          <option value="xml">{t("bodyEncodingXml")}</option>
                          <option value="form">{t("formData")}</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("body")}</label>
                        <textarea
                          className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white font-mono"
                          placeholder={t("requestBodyPlaceholder")}
                          value={form.body}
                          onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                          rows={4}
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("headers")} (JSON)</label>
                    <textarea
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white font-mono"
                      placeholder={t("headersPlaceholder")}
                      value={form.headers}
                      onChange={(e) => setForm((prev) => ({ ...prev, headers: e.target.value }))}
                      rows={3}
                    />
                    <p className="mt-1 text-xs text-slate-500">{t("headersHelp")}</p>
                  </div>
                  
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("authMethod")}</label>
                    <select
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]"
                      value={form.authMethod}
                      onChange={(e) => setForm((prev) => ({ ...prev, authMethod: e.target.value }))}
                    >
                      <option value="none">{t("none")}</option>
                      <option value="basic">HTTP Basic Auth</option>
                      <option value="bearer">Bearer Token</option>
                    </select>
                  </div>
                  
                  {form.authMethod !== "none" && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                          {form.authMethod === "basic" ? t("username") : t("token")}
                        </label>
                        <input
                          className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                          value={form.authUsername}
                          onChange={(e) => setForm((prev) => ({ ...prev, authUsername: e.target.value }))}
                        />
                      </div>
                      {form.authMethod === "basic" && (
                        <div>
                          <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("password")}</label>
                          <input
                            type="password"
                            className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                            value={form.authPassword}
                            onChange={(e) => setForm((prev) => ({ ...prev, authPassword: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Description and Tags */}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("description")} ({t("optional")})</label>
              <textarea
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                placeholder={t("descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          
          {/* Notifications */}
          {notifications && notifications.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                {t("notificationChannels")} ({t("optional")})
              </label>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {notifications.map((channel) => (
                  <label
                    key={channel.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer hover:bg-white/10 transition"
                  >
                    <input
                      type="checkbox"
                      checked={form.notificationIds.includes(channel.id)}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          notificationIds: e.target.checked
                            ? [...prev.notificationIds, channel.id]
                            : prev.notificationIds.filter((id) => id !== channel.id),
                        }));
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-white/10 text-blue-500"
                    />
                    <span className="text-sm text-slate-900 dark:text-white">{channel.name}</span>
                    <span className="ml-auto text-xs text-slate-400 capitalize">{channel.type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <Button type="submit" disabled={mutation.isPending} className="w-full md:w-auto">
            {mutation.isPending ? t("loading") : editingId ? t("updateMonitor") : t("addMonitor")}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">{t("existingMonitors")}</h3>
        
        {/* Mobile Card View */}
        <div className="block lg:hidden space-y-3">
          {data?.map((monitor: Monitor & { recentChecks?: Array<{ status: string; checkedAt: string }>; inMaintenance?: boolean }) => (
            <div key={monitor.id} className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{monitor.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{monitor.kind} • {Math.round(monitor.interval / 1000)}s</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={monitor.status ?? "pending"} />
                  {monitor.inMaintenance && (
                    <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">
                      {t("maintenance")}
                    </span>
                  )}
                </div>
              </div>
              {monitor.recentChecks && monitor.recentChecks.length > 0 ? (
                <UptimeBar checks={monitor.recentChecks} hours={24} />
              ) : (
                <span className="text-slate-500 text-xs">{t("noData")}</span>
              )}
              <div className="flex flex-wrap gap-2">
                <Link to={`/monitors/${monitor.id}`} className="flex-1 min-w-[100px]">
                  <Button variant="ghost" className="w-full px-2 py-1 text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    {t("view")}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="flex-1 min-w-[100px] px-2 py-1 text-xs"
                  onClick={() => handleEdit(monitor)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  {t("edit")}
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => handleDelete(monitor)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-500">
                <th className="pb-3">{t("name")}</th>
                <th className="pb-3">{t("kind")}</th>
                <th className="pb-3">{t("interval")}</th>
                <th className="pb-3">{t("status")}</th>
                <th className="pb-3">{t("uptime")}</th>
                <th className="pb-3 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.map((monitor: Monitor & { recentChecks?: Array<{ status: string; checkedAt: string }>; inMaintenance?: boolean }) => (
                <tr key={monitor.id}>
                  <td className="py-3 font-semibold text-slate-900 dark:text-white">{monitor.name}</td>
                  <td className="py-3 capitalize text-slate-400">{monitor.kind}</td>
                  <td className="py-3">{Math.round(monitor.interval / 1000)}s</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={monitor.status ?? "pending"} />
                      {monitor.inMaintenance && (
                        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                          {t("maintenance")}
                        </span>
                      )}
                      {monitor.kind === "certificate" && (monitor as any).meta?.certificateDaysLeft !== undefined && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          (monitor as any).meta.certificateDaysLeft < 7
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                            : (monitor as any).meta.certificateDaysLeft < 30
                              ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                              : 'bg-green-500/20 text-green-600 dark:text-green-400'
                        }`}>
                          🔒 {(monitor as any).meta.certificateDaysLeft}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="w-48">
                      {monitor.recentChecks && monitor.recentChecks.length > 0 ? (
                        <UptimeBar checks={monitor.recentChecks} hours={24} />
                      ) : (
                        <span className="text-slate-500 text-xs">{t("noData")}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/monitors/${monitor.id}`}>
                        <Button variant="ghost" className="px-2 py-1 text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          {t("view")}
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => handleEdit(monitor)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        {t("edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => handleClone(monitor)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {t("clone")}
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => handleDelete(monitor)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {t("delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
