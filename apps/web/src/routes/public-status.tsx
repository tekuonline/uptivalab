import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useTranslation } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { StatusBadge } from "../components/status-badge.js";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, AlertTriangle, Wrench } from "lucide-react";
import { useEffect } from "react";

export const PublicStatusRoute = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-status", slug],
    queryFn: () => api.getPublicStatusPage(slug!),
    enabled: Boolean(slug),
    refetchInterval: 30000, // Refresh every 30s
  });

  // Apply theme based on status page settings
  useEffect(() => {
    if (!data) return;

    const theme = (data as any).theme || "system";
    const root = document.documentElement;

    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else if (theme === "dark") {
      root.classList.remove("light");
      root.classList.add("dark");
    } else {
      // System theme
      root.classList.remove("light", "dark");
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.add("light");
      }
    }

    // Cleanup on unmount - restore user's theme preference
    return () => {
      root.classList.remove("light", "dark");
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-slate-600 dark:text-slate-400">{t("loadingStatusPage")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t("statusPageNotFound")}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t("statusPageNotFoundMessage")}</p>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational": return "text-green-500";
      case "degraded": return "text-yellow-500";
      case "down": return "text-red-500";
      default: return "text-slate-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational": return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "degraded": return <Clock className="h-6 w-6 text-yellow-500" />;
      case "down": return <XCircle className="h-6 w-6 text-red-500" />;
      default: return <Clock className="h-6 w-6 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{data.name}</h1>
          <div className="flex items-center justify-center gap-3">
            {getStatusIcon(data.overallStatus)}
            <span className={`text-2xl font-semibold ${getStatusColor(data.overallStatus)}`}>
              {data.overallStatus === "operational" && t("allSystemsOperational")}
              {data.overallStatus === "degraded" && t("partialSystemOutage")}
              {data.overallStatus === "down" && t("majorOutage")}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Last updated: {format(new Date(), "MMM dd, yyyy HH:mm:ss")}
          </p>
        </div>

        {/* Monitors */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t("services")}</h2>
          {data.monitors.map((monitor) => (
            <Card key={monitor.id} className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{monitor.name}</h3>
                {monitor.lastCheck && (
                  <p className="text-xs text-slate-600 dark:text-slate-500">
                    Last checked: {format(new Date(monitor.lastCheck), "MMM dd, HH:mm:ss")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {monitor.uptimePercentage.toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{t("uptime")}</p>
                </div>
                {(monitor as any).kind === "certificate" && (monitor as any).meta?.certificateDaysLeft !== undefined && (
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      (monitor as any).meta.certificateDaysLeft < 7
                        ? 'text-red-600 dark:text-red-400'
                        : (monitor as any).meta.certificateDaysLeft < 30
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-green-600 dark:text-green-400'
                    }`}>
                      🔒 {(monitor as any).meta.certificateDaysLeft}d
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{t("certExpiry")}</p>
                  </div>
                )}
                <StatusBadge status={monitor.status as "up" | "down" | "pending" | "paused"} />
              </div>
            </Card>
          ))}
          {data.monitors.length === 0 && (
            <p className="text-center text-slate-600 dark:text-slate-400 py-8">{t("noServicesConfigured")}</p>
          )}
        </div>

        {/* Incidents Section */}
        {(data as any).showIncidents && data.monitors.some((m: any) => m.incidents && m.incidents.length > 0) && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Active Incidents
            </h2>
            {data.monitors.map((monitor: any) =>
              monitor.incidents?.map((incident: any) => (
                <Card key={incident.id} className="border-l-4 border-red-500">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{monitor.name}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Started {format(new Date(incident.startedAt), "MMM dd, yyyy HH:mm")}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        incident.status === 'OPEN' ? 'bg-red-500/20 text-red-400' :
                        incident.status === 'INVESTIGATING' ? 'bg-yellow-500/20 text-yellow-400' :
                        incident.status === 'MITIGATED' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {incident.status}
                      </span>
                    </div>
                    {incident.events && incident.events.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-slate-200 dark:border-white/10 pt-3">
                        {incident.events.map((event: any) => (
                          <div key={event.id} className="text-sm">
                            <p className="text-slate-900 dark:text-white">{event.message}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-500">
                              {format(new Date(event.createdAt), "MMM dd, HH:mm")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Maintenance Section */}
        {(data as any).showMaintenance && (data as any).upcomingMaintenance && (data as any).upcomingMaintenance.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-500" />
              Scheduled Maintenance
            </h2>
            {(data as any).upcomingMaintenance.map((maintenance: any) => {
              const isActive = new Date(maintenance.startsAt) <= new Date() && new Date() <= new Date(maintenance.endsAt);
              const isPast = new Date() > new Date(maintenance.endsAt);
              
              return (
                <Card key={maintenance.id} className={`border-l-4 ${isActive ? 'border-yellow-500' : 'border-blue-500'}`}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{maintenance.name}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {format(new Date(maintenance.startsAt), "MMM dd, yyyy HH:mm")} → {format(new Date(maintenance.endsAt), "MMM dd, yyyy HH:mm")}
                        </p>
                        {maintenance.monitors && maintenance.monitors.length > 0 && (
                          <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                            Affects: {maintenance.monitors.map((m: any) => m.name).join(", ")}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                          IN PROGRESS
                        </span>
                      )}
                      {!isActive && !isPast && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
                          SCHEDULED
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-slate-200 dark:border-white/10">
          <p className="text-xs text-slate-600 dark:text-slate-500">
            Powered by UptivaLab
          </p>
        </div>
      </div>
    </div>
  );
};
