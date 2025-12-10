import type { Monitor } from "@uptivalab/shared";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { StatusBadge } from "../components/status-badge.js";
import { UptimeBar } from "../components/uptime-bar.js";
import { Eye, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export const MonitorsRoute = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["monitors"], queryFn: () => api.listMonitors(token), enabled: Boolean(token) });
  const { data: notifications } = useQuery({ queryKey: ["notifications"], queryFn: () => api.listNotifications(token), enabled: Boolean(token) });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHttpOptions, setShowHttpOptions] = useState(false);
  
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
    });
  };

  const mutation = useMutation({
    mutationFn: () => {
      const config = buildConfig(form);
      return api.createMonitor(token, {
        name: form.name,
        interval: form.interval * 1000,
        timeout: form.timeout * 1000,
        kind: form.kind,
        config,
        notificationIds: form.notificationIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMonitor(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const handleDelete = (monitor: Monitor) => {
    if (confirm(`${t("deleteConfirm")} "${monitor.name}"?`)) {
      deleteMutation.mutate(monitor.id);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-white">{t("createNewMonitor")}</h3>
          <p className="text-sm text-slate-400">{t("createMonitorDescription")}</p>
        </div>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {/* General Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">{t("general")}</h4>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">{t("monitorType")}</label>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white h-[46px]"
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
                  <option value="grpc">gRPC</option>
                  <option value="push">Push</option>
                </select>
              </div>
              
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">{t("friendlyName")}</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
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
                <label className="mb-2 block text-xs font-medium text-slate-400">{t("url")}</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                  placeholder="https://example.com"
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  required
                />
              </div>
            )}
            
            {form.kind === "tcp" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("hostname")}</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                    placeholder="example.com"
                    value={form.host}
                    onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("port")}</label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                    placeholder="80"
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
                <label className="mb-2 block text-xs font-medium text-slate-400">{t("hostname")}</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                  placeholder="example.com or 8.8.8.8"
                  value={form.host}
                  onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                  required
                />
              </div>
            )}
            
            {form.kind === "dns" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("hostname")}</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                    placeholder="example.com"
                    value={form.record}
                    onChange={(e) => setForm((prev) => ({ ...prev, record: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("dnsRecordType")}</label>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white h-[46px]"
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
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">{t("containerNameId")}</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                  placeholder="my-container"
                  value={form.containerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, containerName: e.target.value }))}
                  required
                />
              </div>
            )}
            
            {form.kind === "certificate" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("hostname")}</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                    placeholder="example.com"
                    value={form.host}
                    onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("port")}</label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                    placeholder="443"
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
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("databaseType")}</label>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white h-[46px]"
                    value={form.variant}
                    onChange={(e) => setForm((prev) => ({ ...prev, variant: e.target.value }))}
                  >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="mongodb">MongoDB</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("connectionString")}</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                    placeholder="postgresql://user:pass@host:5432/db"
                    value={form.connectionString}
                    onChange={(e) => setForm((prev) => ({ ...prev, connectionString: e.target.value }))}
                    required
                  />
                </div>
              </div>
            )}
            
            {form.kind === "grpc" && (
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">{t("hostPort")}</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                  placeholder="localhost:50051"
                  value={form.target}
                  onChange={(e) => setForm((prev) => ({ ...prev, target: e.target.value }))}
                  required
                />
              </div>
            )}
            
            {form.kind === "push" && (
              <>
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                  <div className="flex items-start gap-2">
                    <div className="text-blue-400 mt-0.5">ℹ️</div>
                    <div className="flex-1 text-sm text-slate-300">
                      <p className="font-semibold text-white mb-1">{t("pushHeartbeatTitle")}</p>
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
                  <label className="mb-2 block text-xs font-medium text-slate-400">{t("heartbeatInterval")} ({t("seconds")})</label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
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
            
            {/* Interval and Timeout Settings */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">
                  {t("heartbeatInterval")}
                  <span className="ml-2 text-slate-500">({t("checkEvery")} {form.interval} {t("seconds")})</span>
                </label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                  value={form.interval}
                  onChange={(e) => setForm((prev) => ({ ...prev, interval: Number(e.target.value) }))}
                  min="30"
                  max="86400"
                  required
                />
              </div>
              
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">
                  {t("retries")}
                </label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                  placeholder="0"
                  value={form.retries}
                  onChange={(e) => setForm((prev) => ({ ...prev, retries: Number(e.target.value) }))}
                  min="0"
                  max="5"
                />
                <p className="mt-1 text-xs text-slate-500">{t("retriesHelp")}</p>
              </div>
              
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">
                  {t("requestTimeout")}
                  <span className="ml-2 text-slate-500">({t("timeoutAfter")} {form.timeout} {t("seconds")})</span>
                </label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                  value={form.timeout}
                  onChange={(e) => setForm((prev) => ({ ...prev, timeout: Number(e.target.value) }))}
                  min="1"
                  max="300"
                  required
                />
              </div>
            </div>
          </div>
          
          {/* Advanced Options - HTTP specific */}
          {form.kind === "http" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider hover:text-slate-300 transition"
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
                      <span className="text-sm text-white">{t("ignoreTls")}</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.upsideDown}
                        onChange={(e) => setForm((prev) => ({ ...prev, upsideDown: e.target.checked }))}
                        className="h-4 w-4 rounded border-white/20 bg-white/10 text-blue-500"
                      />
                      <span className="text-sm text-white">{t("upsideDownMode")}</span>
                      <span className="text-xs text-slate-400">({t("upsideDownHelp")})</span>
                    </label>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-400">{t("maxRedirects")}</label>
                      <input
                        type="number"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                        value={form.maxRedirects}
                        onChange={(e) => setForm((prev) => ({ ...prev, maxRedirects: Number(e.target.value) }))}
                        min="0"
                        max="20"
                      />
                      <p className="mt-1 text-xs text-slate-500">{t("maxRedirectsHelp")}</p>
                    </div>
                    
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-400">{t("acceptedStatusCodes")}</label>
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
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
                className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider hover:text-slate-300 transition"
              >
                {showHttpOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {t("httpOptions")}
              </button>
              
              {showHttpOptions && (
                <div className="space-y-4 border-l-2 border-white/10 pl-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-400">{t("method")}</label>
                    <select
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white h-[46px]"
                      value={form.method}
                      onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value }))}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                      <option value="HEAD">HEAD</option>
                      <option value="OPTIONS">OPTIONS</option>
                    </select>
                  </div>
                  
                  {(form.method === "POST" || form.method === "PUT" || form.method === "PATCH") && (
                    <>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-400">{t("bodyEncoding")}</label>
                        <select
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white h-[46px]"
                          value={form.bodyEncoding}
                          onChange={(e) => setForm((prev) => ({ ...prev, bodyEncoding: e.target.value }))}
                        >
                          <option value="json">JSON</option>
                          <option value="xml">XML</option>
                          <option value="form">Form Data</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-400">{t("body")}</label>
                        <textarea
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white font-mono"
                          placeholder='{"key": "value"}'
                          value={form.body}
                          onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                          rows={4}
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-400">{t("headers")} (JSON)</label>
                    <textarea
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white font-mono"
                      placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                      value={form.headers}
                      onChange={(e) => setForm((prev) => ({ ...prev, headers: e.target.value }))}
                      rows={3}
                    />
                    <p className="mt-1 text-xs text-slate-500">{t("headersHelp")}</p>
                  </div>
                  
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-400">{t("authMethod")}</label>
                    <select
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white h-[46px]"
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
                        <label className="mb-2 block text-xs font-medium text-slate-400">
                          {form.authMethod === "basic" ? t("username") : t("token")}
                        </label>
                        <input
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                          value={form.authUsername}
                          onChange={(e) => setForm((prev) => ({ ...prev, authUsername: e.target.value }))}
                        />
                      </div>
                      {form.authMethod === "basic" && (
                        <div>
                          <label className="mb-2 block text-xs font-medium text-slate-400">{t("password")}</label>
                          <input
                            type="password"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
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
              <label className="mb-2 block text-xs font-medium text-slate-400">{t("description")} ({t("optional")})</label>
              <textarea
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
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
                    <span className="text-sm text-white">{channel.name}</span>
                    <span className="ml-auto text-xs text-slate-400 capitalize">{channel.type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <Button type="submit" disabled={mutation.isPending} className="w-full md:w-auto">
            {mutation.isPending ? t("loading") : t("addMonitor")}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-4 text-xl font-semibold text-white">{t("existingMonitors")}</h3>
        <div className="overflow-x-auto">
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
              {data?.map((monitor: Monitor & { recentChecks?: Array<{ status: string; checkedAt: string }> }) => (
                <tr key={monitor.id}>
                  <td className="py-3 font-semibold text-white">{monitor.name}</td>
                  <td className="py-3 capitalize text-slate-400">{monitor.kind}</td>
                  <td className="py-3">{Math.round(monitor.interval / 1000)}s</td>
                  <td className="py-3">
                    <StatusBadge status={monitor.status ?? "pending"} />
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
