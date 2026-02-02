import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Line as LineChart, Doughnut as DoughnutChart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { StatusBadge } from "../components/status-badge.js";
import { UptimeBar } from "../components/uptime-bar.js";
import { FormattedDate } from "../components/formatted-date.js";
import { format } from "date-fns";
import { ArrowLeft, Edit2, Trash2, Pause, Play, GripVertical, PlayCircle } from "lucide-react";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const MonitorDetailRoute = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ 
    name: "", 
    interval: 60000,
    // Type-specific fields
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
    // Synthetic monitor fields
    browser: "chromium" as "chromium" | "firefox" | "webkit",
    useLocalBrowser: true,
    baseUrl: "",
    steps: [] as Array<{
      id: string;
      action: "goto" | "click" | "fill" | "expect" | "wait";
      selector?: string;
      value?: string;
      text?: string;
      property?: string;
      url?: string;
      timeout?: number;
    }>,
  });
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [showAddWaitStep, setShowAddWaitStep] = useState(false);
  const [waitStepValue, setWaitStepValue] = useState("1000");

  const { data: monitor } = useQuery({
    queryKey: ["monitor", id],
    queryFn: () => api.getMonitor(token, id!),
    enabled: Boolean(token && id),
  });

  const { data: history } = useQuery({
    queryKey: ["monitor-history", id, monitor?.kind],
    queryFn: () => api.getMonitorHistory(token, id!, 100, monitor?.kind === "synthetic"),
    enabled: Boolean(token && id && monitor),
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: uptime } = useQuery({
    queryKey: ["monitor-uptime", id],
    queryFn: () => api.getMonitorUptime(token, id!, 30),
    enabled: Boolean(token && id),
    refetchInterval: 30000,
  });

  const { data: screenshots } = useQuery({
    queryKey: ["monitor-screenshots", id],
    queryFn: () => api.getMonitorScreenshots(token, id!),
    enabled: Boolean(token && id && monitor?.kind === "synthetic"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteMonitor(token, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      navigate("/monitors");
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.pauseMonitor(token, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor", id] });
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.resumeMonitor(token, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor", id] });
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const runMutation = useMutation({
    mutationFn: () => api.runMonitor(token, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor", id] });
      queryClient.invalidateQueries({ queryKey: ["monitor-history", id] });
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; config: any; interval: number }) =>
      api.updateMonitor(token, id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor", id] });
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      setIsEditing(false);
    },
  });

  const handleEdit = () => {
    if (!monitor) return;
    
    const config = (monitor as any).config as any;
    
    // For synthetic monitors, show inline editing
    if (monitor.kind === "synthetic") {
      const steps = Array.isArray(config?.steps) ? config.steps : [];
      setEditForm({
        name: monitor.name,
        interval: monitor.interval,
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
        browser: config?.browser ?? "chromium",
        useLocalBrowser: config?.useLocalBrowser ?? true,
        baseUrl: config?.baseUrl ?? "",
        steps: steps.map((step: any, index: number) => ({
          id: `step-${Date.now()}-${index}`,
          ...step,
        })),
      });
      setIsEditing(true);
    } else {
      // For other monitor types, navigate to monitors page with edit state
      navigate('/monitors', { state: { editMonitor: monitor } });
    }
  };

  const buildConfig = (formData: typeof editForm, monitorKind: string) => {
    switch (monitorKind) {
      case "tcp":
        return { host: formData.host, port: parseInt(formData.port, 10) };
      case "ping":
        return { host: formData.host };
      case "dns":
        return { record: formData.record, type: formData.recordType };
      case "docker":
        return { containerName: formData.containerName };
      case "certificate":
        return { host: formData.host, port: parseInt(formData.port, 10) || 443 };
      case "database":
        return { variant: formData.variant, connectionString: formData.connectionString };
      case "grpc":
        return { target: formData.target };
      case "push":
        return { heartbeatSeconds: parseInt(formData.heartbeatSeconds, 10) };
      case "synthetic":
        return {
          browser: formData.browser,
          useLocalBrowser: formData.useLocalBrowser,
          baseUrl: formData.baseUrl || undefined,
          steps: formData.steps.map(({ id, ...step }) => step),
        };
      case "http":
      default:
        return { url: formData.url };
    }
  };

  const handleSave = () => {
    if (!monitor) return;
    const config = buildConfig(editForm, monitor.kind);
    updateMutation.mutate({
      name: editForm.name,
      config,
      interval: editForm.interval,
    });
  };

  const handleDelete = () => {
    if (confirm(`${t("areYouSureDelete")} "${monitor?.name}"?`)) {
      deleteMutation.mutate();
    }
  };

  // Prepare data for latency chart - filter out null/zero latency values
  const latencyData = history?.checks
    .filter((check) => check.latencyMs != null && check.latencyMs > 0)
    .map((check) => ({
      time: format(new Date(check.checkedAt), "HH:mm"),
      latency: check.latencyMs,
      status: check.status,
    })) ?? [];

  // Prepare data for uptime chart
  const uptimeData = uptime?.days
    .filter((day) => day.uptimePercentage != null)
    .map((day) => ({
      date: format(new Date(day.date), "MM/dd"),
      uptime: day.uptimePercentage,
    })) ?? [];

  if (!monitor) return <div className="text-white">{t("loading")}</div>;

  // Handle different monitor types - DNS monitors use 'record', others use 'url'
  const monitorConfig = (monitor as any).config || {};
  const monitorUrl = monitorConfig.url || monitorConfig.record || t("na");
  const monitorType = monitor.kind || "http";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <Link to="/monitors">
            <Button variant="ghost" className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("back")}
            </Button>
          </Link>
          <div className="min-w-0 flex-1 sm:flex-initial">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{monitor.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs uppercase px-2 py-1 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                {monitorType}
              </span>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">{monitorUrl}</p>
              {monitorType === 'certificate' && (monitor as any).meta?.certificateDaysLeft && (
                <span className={`text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1 rounded-full ${
                  (monitor as any).meta.certificateDaysLeft < 7
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                    : (monitor as any).meta.certificateDaysLeft < 30
                      ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30'
                      : 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                }`}>
                  🔒 {t("certificateExpiry")}: {(monitor as any).meta.certificateDaysLeft} {t("days")} (<FormattedDate date={(monitor as any).meta.certificateExpiresAt} relative={false} />)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={monitor.status ?? "pending"} />
          {!isEditing && (
            <>
              {(monitor as any).paused ? (
                <Button variant="ghost" onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending} className="text-xs sm:text-sm">
                  <Play className="h-4 w-4 mr-2" />
                  {resumeMutation.isPending ? t("loading") : t("resume")}
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending} className="text-xs sm:text-sm">
                  <Pause className="h-4 w-4 mr-2" />
                  {pauseMutation.isPending ? t("loading") : t("pause")}
                </Button>
              )}
              <Button variant="ghost" onClick={() => runMutation.mutate()} disabled={runMutation.isPending || (monitor as any).paused} className="text-xs sm:text-sm">
                <PlayCircle className="h-4 w-4 mr-2" />
                {runMutation.isPending ? t("executing") : t("runNow")}
              </Button>
              <Button variant="ghost" onClick={handleEdit} className="text-xs sm:text-sm">
                <Edit2 className="h-4 w-4 mr-2" />
                {t("edit")}
              </Button>
              <Button variant="ghost" onClick={handleDelete} disabled={deleteMutation.isPending} className="text-xs sm:text-sm">
                <Trash2 className="h-4 w-4 mr-2" />
                {t("delete")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Push/Heartbeat Instructions */}
      {monitor.kind === "push" && (monitor as any).heartbeats && (
        <Card className="border-2 border-blue-500/30 bg-blue-50 dark:bg-blue-500/5">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="text-xl sm:text-2xl">🫀</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">{t("heartbeatUrl")}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-3 sm:mb-4">
                  {t("sendPostRequest")} <strong className="text-slate-900 dark:text-white">{(monitor as any).heartbeats.heartbeatEvery} {t("seconds")}</strong>. {t("ifNoHeartbeat")}
                </p>
                
                <div className="rounded-lg bg-slate-900 dark:bg-slate-900 p-3 sm:p-4 mb-3 sm:mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">{t("heartbeatEndpoint")}</span>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/api/heartbeat/${(monitor as any).heartbeats.tokenHash}`;
                        navigator.clipboard.writeText(url);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <code className="text-xs sm:text-sm text-green-400 dark:text-green-400 break-all">
                    {window.location.origin}/api/heartbeat/{(monitor as any).heartbeats.tokenHash}
                  </code>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase mb-2">{t("exampleCurl")}</p>
                    <div className="rounded-lg bg-slate-900 p-2 sm:p-3">
                      <code className="text-xs text-slate-300 break-all">
                        curl -X POST {window.location.origin}/api/heartbeat/{(monitor as any).heartbeats.tokenHash}
                      </code>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">{t("exampleCronJob")}</p>
                    <div className="rounded-lg bg-slate-900 p-3">
                      <code className="text-xs text-slate-300">
                        */5 * * * * curl -X POST {window.location.origin}/api/heartbeat/{(monitor as any).heartbeats.tokenHash}
                      </code>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{t("sendsHeartbeatEvery5Minutes")}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">{t("examplePython")}</p>
                    <div className="rounded-lg bg-slate-900 p-3">
                      <code className="text-xs text-slate-300 whitespace-pre">
{`import requests
requests.post('${window.location.origin}/api/heartbeat/${(monitor as any).heartbeats.tokenHash}')`}
                      </code>
                    </div>
                  </div>

                  {(monitor as any).heartbeats.lastHeartbeat && (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-slate-400">
                        {t("lastHeartbeatReceived")} <span className="text-white"><FormattedDate date={(monitor as any).heartbeats.lastHeartbeat} relative={false} /></span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Uptime Bar */}
      {history && history.checks.length > 0 && (
        <Card>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4">{t("recentUptime24h")}</h3>
          <UptimeBar checks={history.checks} hours={24} />
        </Card>
      )}

      {/* Synthetic Monitor Journey Steps */}
      {monitor.kind === "synthetic" && history && history.checks.length > 0 && (
        <Card>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">{t("latestJourneySteps")}</h3>
          {(() => {
            const latestCheck = history.checks[0]; // Get the most recent check (first in desc-ordered array)
            const journeySteps = (latestCheck as any)?.payload?.journeySteps || [];
            
            if (journeySteps.length === 0) {
              return (
                <div className="text-slate-400 py-4">
                  <p>{t("noJourneyStepsYet")}</p>
                  <pre className="text-xs mt-2 bg-slate-800 p-2 rounded">
                    {JSON.stringify(latestCheck, null, 2)}
                  </pre>
                </div>
              );
            }

            const allPassed = journeySteps.every((step: any) => step.status === "up");
            const failedStepIndex = journeySteps.findIndex((step: any) => step.status === "down");

            return (
              <div className="space-y-4">
                {/* Summary */}
                <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                  allPassed 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="text-2xl">
                    {allPassed ? '✅' : '❌'}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${
                      allPassed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {allPassed 
                        ? t("allStepsPassed").replace("{count}", String(journeySteps.length))
                        : t("failedAtStep").replace("{step}", String(failedStepIndex + 1)).replace("{total}", String(journeySteps.length))
                      }
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {t("lastChecked")}: {format(new Date(latestCheck.checkedAt), "MMM dd, yyyy HH:mm:ss")}
                    </p>
                  </div>
                </div>

                {/* Step Details */}
                <div className="space-y-2">
                  {journeySteps.map((step: any, index: number) => {
                    const isPassed = step.status === "up";
                    const isFailed = step.status === "down";
                    
                    return (
                      <div
                        key={index}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          isPassed 
                            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                            : 'bg-red-500/5 border-red-500/30'
                        }`}
                      >
                        {/* Step Number */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          isPassed 
                            ? 'bg-green-500 text-white' 
                            : 'bg-red-500 text-white'
                        }`}>
                          {index + 1}
                        </div>

                        {/* Step Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${
                              isPassed 
                                ? 'text-slate-900 dark:text-white' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {step.label}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              isPassed 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {isPassed ? t("passed") : t("failed")}
                            </span>
                          </div>
                          
                          {/* Error Details */}
                          {isFailed && step.detail && (
                            <div className="mt-2 p-3 bg-red-900/20 dark:bg-red-900/40 rounded border border-red-500/30">
                              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">{t("errorDetails")}:</p>
                              <pre className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words font-mono">
                                {step.detail}
                              </pre>
                            </div>
                          )}

                          {/* Screenshot */}
                          {(() => {
                            // Match by stepIndex if available, otherwise fall back to stepLabel
                            const stepScreenshot = screenshots?.screenshots?.find(s => 
                              s.stepIndex !== null && s.stepIndex !== undefined 
                                ? s.stepIndex === index 
                                : s.stepLabel === step.label
                            );
                            return stepScreenshot ? (
                              <div className="mt-2">
                                <details className="group">
                                  <summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                    </svg>
                                    {t("screenshot")}
                                    <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </summary>
                                  <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded border">
                                    <img
                                      src={`data:image/png;base64,${stepScreenshot.data}`}
                                      alt={`Screenshot for step ${step.label}`}
                                      className="max-w-full h-auto rounded border border-slate-300 dark:border-slate-600"
                                      style={{ maxHeight: '400px' }}
                                    />
                                  </div>
                                </details>
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          {isPassed ? (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Edit Form */}
      {isEditing && (
        <Card>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4">{t("editMonitor")}</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("name")}</label>
              <input
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            {/* HTTP */}
            {monitor.kind === "http" && (
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("url")}</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  value={editForm.url}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, url: e.target.value }))}
                />
              </div>
            )}
            
            {/* TCP */}
            {monitor.kind === "tcp" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("host")}</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    value={editForm.host}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, host: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("port")}</label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    value={editForm.port}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, port: e.target.value }))}
                  />
                </div>
              </div>
            )}
            
            {/* Ping */}
            {monitor.kind === "ping" && (
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("host")}</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  value={editForm.host}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, host: e.target.value }))}
                />
              </div>
            )}
            
            {/* DNS */}
            {monitor.kind === "dns" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("record")}</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    value={editForm.record}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, record: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("dnsType")}</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]"
                    value={editForm.recordType}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, recordType: e.target.value }))}
                  >
                    <option value="A">{t("aRecord")}</option>
                    <option value="AAAA">{t("aaaaRecord")}</option>
                    <option value="CNAME">{t("cnameRecord")}</option>
                    <option value="MX">{t("mxRecord")}</option>
                    <option value="TXT">{t("txtRecord")}</option>
                  </select>
                </div>
              </div>
            )}
            
            {/* Certificate */}
            {monitor.kind === "certificate" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("host")}</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    value={editForm.host}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, host: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("port")}</label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    value={editForm.port}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, port: e.target.value }))}
                    placeholder="443"
                  />
                </div>
              </div>
            )}
            
            {/* Docker */}
            {monitor.kind === "docker" && (
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("containerName")}</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                  value={editForm.containerName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, containerName: e.target.value }))}
                />
              </div>
            )}
            
            {/* Synthetic Monitor Steps */}
            {monitor.kind === "synthetic" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-4">
                  <div className="flex items-start gap-2">
                    <div className="text-purple-600 dark:text-purple-400 mt-0.5">🎭</div>
                    <div className="flex-1 text-sm text-slate-600 dark:text-slate-300">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">{t("monitorTypeSynthetic")}</p>
                      <p>{t("addWaitStep")} {t("journeySteps").toLowerCase()}</p>
                    </div>
                  </div>
                </div>

                {/* Browser Config */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("browser")}</label>
                    <select
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                      value={editForm.browser}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, browser: e.target.value as typeof prev.browser }))}
                    >
                      <option value="chromium">{t("chromium")}</option>
                      <option value="firefox">{t("firefox")}</option>
                      <option value="webkit">{t("webkit")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("baseUrlOptional")}</label>
                    <input
                      className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                      value={editForm.baseUrl}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                {/* Use Local Browser Checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useLocalBrowser"
                    checked={editForm.useLocalBrowser}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, useLocalBrowser: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="useLocalBrowser" className="text-sm text-slate-600 dark:text-slate-400">
                    {t("local")}
                  </label>
                </div>

                {/* Steps List */}
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("journeySteps")}</label>
                  <div className="space-y-2">
                    {editForm.steps.map((step, index) => (
                      <div
                        key={step.id}
                        draggable
                        onDragStart={() => setDraggedStepIndex(index)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedStepIndex === null || draggedStepIndex === index) return;
                          const newSteps = [...editForm.steps];
                          const draggedStep = newSteps[draggedStepIndex];
                          newSteps.splice(draggedStepIndex, 1);
                          newSteps.splice(index, 0, draggedStep);
                          setEditForm((prev) => ({ ...prev, steps: newSteps }));
                          setDraggedStepIndex(index);
                        }}
                        onDragEnd={() => setDraggedStepIndex(null)}
                        className={`flex items-start gap-2 p-3 rounded-lg border transition-all cursor-move ${
                          draggedStepIndex === index
                            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600'
                        }`}
                      >
                        {/* Drag Handle */}
                        <div className="flex-shrink-0 mt-1 text-slate-400 dark:text-slate-500">
                          <GripVertical className="h-4 w-4" />
                        </div>

                        {/* Step Number */}
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-semibold mt-0.5">
                          {index + 1}
                        </div>

                        {/* Step Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900 dark:text-white uppercase">
                              {step.action}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                            {step.url && <div>URL: {step.url}</div>}
                            {step.selector && <div>Selector: {step.selector}</div>}
                            {step.value && step.action === "wait" && <div>Wait: {step.value}ms</div>}
                            {step.value && step.action !== "wait" && <div>Value: {step.value}</div>}
                            {step.text && <div>Text: {step.text}</div>}
                            {step.property && <div>Property: {step.property}</div>}
                          </div>
                          
                          {/* Edit wait value */}
                          {step.action === "wait" && (
                            <div className="mt-2">
                              <input
                                type="number"
                                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                                value={step.value || "1000"}
                                onChange={(e) => {
                                  const newSteps = [...editForm.steps];
                                  newSteps[index] = { ...step, value: e.target.value };
                                  setEditForm((prev) => ({ ...prev, steps: newSteps }));
                                }}
                                min="100"
                                max="30000"
                                placeholder={t("waitTimeMs")}
                              />
                            </div>
                          )}
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => {
                            const newSteps = editForm.steps.filter((_, i) => i !== index);
                            setEditForm((prev) => ({ ...prev, steps: newSteps }));
                          }}
                          className="flex-shrink-0 p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    {/* Add Wait Step */}
                    {showAddWaitStep ? (
                      <div className="flex gap-2 p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <input
                          type="number"
                          className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                          value={waitStepValue}
                          onChange={(e) => setWaitStepValue(e.target.value)}
                          placeholder={t("waitTimeMs")}
                          min="100"
                          max="30000"
                        />
                        <Button
                          onClick={() => {
                            const newStep = {
                              id: `wait-${Date.now()}`,
                              action: "wait" as const,
                              value: waitStepValue,
                            };
                            setEditForm((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
                            setShowAddWaitStep(false);
                            setWaitStepValue("1000");
                          }}
                          className="px-4"
                        >
                          {t("add")}
                        </Button>
                        <Button
                          onClick={() => {
                            setShowAddWaitStep(false);
                            setWaitStepValue("1000");
                          }}
                          variant="outline"
                          className="px-4"
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddWaitStep(true)}
                        className="w-full p-3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        {t("addWaitStep")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("intervalSeconds")}</label>
              <input
                type="number"
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                value={editForm.interval / 1000}
                onChange={(e) => setEditForm((prev) => ({ ...prev, interval: Number(e.target.value) * 1000 }))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t("saving") : t("saveChanges")}
              </Button>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats */}
      {uptime && (
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("uptime")}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mt-2">{uptime.stats.uptimePercentage.toFixed(2)}%</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("avgResponseTime")}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mt-2">
              {uptime.stats.avgResponseTime !== null ? `${uptime.stats.avgResponseTime.toFixed(0)}ms` : "N/A"}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("totalChecks")}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mt-2">{uptime.stats.totalChecks}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("failedChecks")}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mt-2">{uptime.stats.downChecks}</p>
          </Card>
        </div>
      )}

      {/* Response Time Chart */}
      <Card>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4">{t("responseTimeHistory")}</h3>
        {latencyData.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <LineChart
              data={{
                labels: latencyData.map(d => d.time),
                datasets: [
                  {
                    label: t("responseTimeMs"),
                    data: latencyData.map(d => d.latency),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' },
                  },
                  x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' },
                  },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderWidth: 1,
                  },
                },
              }}
              height={300}
            />
          </div>
        ) : (
          <div className="text-slate-400">
            <p>{t("noLatencyDataAvailable")}</p>
          </div>
        )}
      </Card>

      {/* Uptime Chart */}
      <Card>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4">{t("thirtyDayUptime")}</h3>
        {uptimeData && uptimeData.length > 0 ? (
          <div className="w-full" style={{ height: '300px' }}>
            <LineChart
              data={{
                labels: uptimeData.map(d => d.date),
                datasets: [
                  {
                    label: t("uptimePercent"),
                    data: uptimeData.map(d => d.uptime),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { 
                      color: '#94a3b8',
                      callback: (value) => `${value}%`,
                    },
                    grid: { color: '#334155' },
                  },
                  x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: '#334155' },
                  },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                      label: (context) => `Uptime: ${context.parsed.y?.toFixed(2) ?? 0}%`,
                    },
                  },
                },
              }}
            />
          </div>
        ) : (
          <div className="text-slate-400">
            <p>{t("noUptimeDataAvailable")}</p>
          </div>
        )}
      </Card>

      {/* Uptime Distribution */}
      {history && history.stats.totalChecks > 0 && (
        <Card>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4">{t("uptimeDistribution")}</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {/* Pie Chart */}
            <div className="w-64 h-64">
              <DoughnutChart
                data={{
                  labels: [t("up"), t("down")],
                  datasets: [
                    {
                      data: [history.stats.upChecks, history.stats.downChecks],
                      backgroundColor: ['#10b981', '#ef4444'],
                      borderColor: '#1e293b',
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'bottom',
                      labels: {
                        color: '#94a3b8',
                        padding: 15,
                        font: { size: 12 },
                      },
                    },
                    tooltip: {
                      backgroundColor: '#1e293b',
                      borderColor: '#334155',
                      borderWidth: 1,
                      callbacks: {
                        label: (context) => {
                          const label = context.label || '';
                          const value = context.parsed || 0;
                          const total = history.stats.totalChecks;
                          const percentage = ((value / total) * 100).toFixed(1);
                          return `${label}: ${value} (${percentage}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
            {/* Stats */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm text-slate-300">
                  {t("up")}: {history.stats.upChecks} ({((history.stats.upChecks / history.stats.totalChecks) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm text-slate-300">
                  {t("down")}: {history.stats.downChecks} ({((history.stats.downChecks / history.stats.totalChecks) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {t("totalChecks")}: {history.stats.totalChecks}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Checks */}
      {history && (
        <Card>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4">{t("recentChecks")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-slate-500">
                  <th className="pb-3">{t("time")}</th>
                  <th className="pb-3">{t("status")}</th>
                  <th className="pb-3">{t("latency")}</th>
                  {monitor.kind === "synthetic" && <th className="pb-3">{t("steps")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.checks.slice(0, 20).map((check) => {
                  const journeySteps = monitor.kind === "synthetic" ? ((check as any)?.payload?.journeySteps || []) : [];
                  const passedSteps = journeySteps.filter((s: any) => s.status === "up").length;
                  const totalSteps = journeySteps.length;
                  
                  return (
                    <tr key={check.id}>
                      <td className="py-3">{format(new Date(check.checkedAt), "MMM dd, HH:mm:ss")}</td>
                      <td className="py-3">
                        <StatusBadge status={check.status as "up" | "down" | "pending"} />
                      </td>
                      <td className="py-3">{check.latencyMs !== null ? `${check.latencyMs}ms` : "N/A"}</td>
                      {monitor.kind === "synthetic" && (
                        <td className="py-3">
                          {totalSteps > 0 ? (
                            <span className={`text-xs px-2 py-1 rounded ${
                              passedSteps === totalSteps 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {passedSteps}/{totalSteps} {t("passed")}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
