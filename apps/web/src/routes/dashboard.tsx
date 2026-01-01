import type { StatusState } from "@uptivalab/shared";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, AlertTriangle, Clock } from "lucide-react";
import { Line as LineChart } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler } from "chart.js";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useRealtime } from "../hooks/use-realtime.js";
import { Card } from "../components/ui/card.js";
import { StatusBadge } from "../components/status-badge.js";
import { useTranslation } from "../hooks/use-translation.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler);

interface Monitor {
  id: string;
  name: string;
  kind: string;
  meta?: {
    certificateExpiresAt?: string;
    certificateDaysLeft?: number;
  };
}

interface StatusSnapshot {
  id: string;
  name: string;
  kind: string;
  status: StatusState;
  lastCheck: string | null;
  inMaintenance?: boolean;
  meta?: {
    certificateExpiresAt?: string;
    certificateDaysLeft?: number;
  } | null;
}

const getSummaryLabel = (t: any, status: StatusState): string => {
  const labels: Record<StatusState, string> = {
    up: t("allSystemsThriving"),
    down: t("incidentActive"),
    pending: t("awaitingData"),
    paused: t("monitorPaused"),
  };
  return labels[status];
};

const MiniGraph = ({ monitorId, status }: { monitorId: string; status: StatusState }) => {
  const { token } = useAuth();
  const { data } = useQuery({
    queryKey: ["monitor-mini-graph", monitorId],
    queryFn: () => api.getMonitorHistory(token, monitorId, 24),
    enabled: Boolean(token),
  });

  if (!data?.checks || data.checks.length === 0) {
    return <div className="h-8 w-16 rounded bg-slate-200 dark:bg-white/5" />;
  }

  // Take last 24 checks for mini sparkline
  const recentChecks = data.checks.slice(-24);
  const chartData = recentChecks.map((check) => (check.status === "up" ? 100 : 0));

  const statusColor = status === "up" ? "#22c55e" : status === "down" ? "#ef4444" : "#fbbf24";

  return (
    <div className="h-8 w-16">
      <LineChart
        data={{
          labels: chartData.map(() => ''),
          datasets: [
            {
              data: chartData,
              borderColor: statusColor,
              backgroundColor: `${statusColor}20`,
              borderWidth: 1.5,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          scales: {
            x: { display: false },
            y: { display: false, min: 0, max: 100 },
          },
        }}
      />
    </div>
  );
};

const CertificateExpiryWidget = () => {
  const { token } = useAuth();
  const { data: monitors } = useQuery({
    queryKey: ["monitors"],
    queryFn: () => api.listMonitors(token),
    enabled: Boolean(token),
  });

  const certificateMonitors = useMemo(() => {
    if (!monitors) return [];
    return (monitors as Monitor[])
      .filter((m) => m.kind === "certificate")
      .map((m) => {
        const expiresAt = m.meta?.certificateExpiresAt;
        if (!expiresAt) return null;
        
        const expiryDate = new Date(expiresAt);
        const now = new Date();
        const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let color = "text-green-400";
        if (daysRemaining < 7) color = "text-red-400";
        else if (daysRemaining < 30) color = "text-yellow-400";
        
        return { ...m, daysRemaining, color, expiryDate };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [monitors]);

  if (certificateMonitors.length === 0) return null;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-400" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("sslCertificateExpiry")}</h3>
      </div>
      <div className="space-y-3">
        {certificateMonitors.slice(0, 5).map((cert) => (
          <Link
            key={cert.id}
            to={`/monitors/${cert.id}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-3 transition hover:bg-slate-200 dark:hover:bg-white/10"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{cert.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Expires {cert.expiryDate.toLocaleDateString()}
              </p>
            </div>
            <div className={`text-right ${cert.color}`}>
              <p className="text-2xl font-bold">{cert.daysRemaining}</p>
              <p className="text-xs">{t("days")}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
};

export const DashboardRoute = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ["status"], queryFn: () => api.listStatus(token), enabled: Boolean(token) });
  const [snapshots, setSnapshots] = useState<StatusSnapshot[]>([]);

  useEffect(() => {
    if (data) {
      setSnapshots(data as StatusSnapshot[]);
    }
  }, [data]);

  useRealtime((event) => {
    if (event.type !== "monitor:result") return;
    setSnapshots((prev) => {
      const existing = prev.find((item) => item.id === event.payload.monitorId);
      if (!existing) return prev;
      return prev.map((item) =>
        item.id === event.payload.monitorId
          ? { 
              ...item, 
              status: event.payload.status as StatusState, 
              lastCheck: event.payload.checkedAt
            }
          : item
      );
    });
  }, token);

  const counts = useMemo(() => {
    return snapshots.reduce(
      (acc, monitor) => {
        acc[monitor.status] += 1;
        return acc;
      },
      { up: 0, down: 0, pending: 0, paused: 0 } as Record<StatusState, number>
    );
  }, [snapshots]);

  if (isLoading && snapshots.length === 0) {
    return <p className="text-slate-600 dark:text-slate-400">{t("loadingTelemetry")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(counts) as StatusState[]).map((status) => (
          <Card key={status} className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{getSummaryLabel(t, status)}</p>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-4xl font-semibold text-slate-900 dark:text-white">{counts[status]}</div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("monitorsStatus", { status })}</p>
              </div>
              <StatusBadge status={status} />
            </div>
          </Card>
        ))}
      </div>

      <CertificateExpiryWidget />

      <Card>
        <div className="mb-6 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("monitorsTitle")}</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {snapshots.map((monitor) => (
            <Link
              key={monitor.id}
              to={`/monitors/${monitor.id}`}
              className="rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 p-4 transition hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{monitor.id}</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">{monitor.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <MiniGraph monitorId={monitor.id} status={monitor.status} />
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={monitor.status} />
                    {monitor.inMaintenance && (
                      <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-black">
                        Maintenance
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Clock className="h-3 w-3" />
                  {monitor.lastCheck ? new Date(monitor.lastCheck).toLocaleTimeString() : "Pending"}
                </div>
                {monitor.kind === "certificate" && (
                  <div className="text-xs">
                    {monitor.meta?.certificateDaysLeft ? (
                      <div className={`flex items-center gap-2 font-medium ${
                        monitor.meta.certificateDaysLeft < 7
                          ? 'text-red-600 dark:text-red-400'
                          : monitor.meta.certificateDaysLeft < 30
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                      }`}>
                        🔒 Expires in {monitor.meta.certificateDaysLeft} days
                        {monitor.meta.certificateExpiresAt && (
                          <span className="text-slate-500 dark:text-slate-400">
                            ({new Date(monitor.meta.certificateExpiresAt).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">{t("certificateMonitorAwaitingCheck")}</span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
};
