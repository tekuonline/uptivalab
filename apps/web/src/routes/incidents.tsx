import type { IncidentWithRelations } from "@uptivalab/shared";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Filter, Clock, AlertCircle } from "lucide-react";
import { api } from "../lib/api.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { StatusBadge } from "../components/status-badge.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";

const badgeStatus = (incident: IncidentWithRelations) => (incident.status === "RESOLVED" ? "up" : "down");

const statusColors = {
  OPEN: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
  INVESTIGATING: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  MITIGATED: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
  RESOLVED: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
};

export const IncidentsRoute = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const latestMessage = (incident: IncidentWithRelations) => incident.events?.[0]?.message ?? t("noUpdatesYet");
  const { data: incidents, isLoading } = useQuery({ queryKey: ["incidents"], queryFn: () => api.listIncidents(token), enabled: Boolean(token) });
  const { data: monitors } = useQuery({ queryKey: ["monitors"], queryFn: () => api.listMonitors(token), enabled: Boolean(token) });

  const [filters, setFilters] = useState({
    status: "all" as string,
    monitorId: "all" as string,
  });
  const [sortBy, setSortBy] = useState<"date" | "duration">("date");
  const [selectedIncident, setSelectedIncident] = useState<IncidentWithRelations | null>(null);

  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    
    let filtered = [...incidents];
    
    // Apply filters
    if (filters.status !== "all") {
      filtered = filtered.filter((inc) => inc.status === filters.status);
    }
    if (filters.monitorId !== "all") {
      filtered = filtered.filter((inc) => inc.monitorId === filters.monitorId);
    }
    
    // Apply sorting
    if (sortBy === "date") {
      filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    } else if (sortBy === "duration") {
      filtered.sort((a, b) => {
        const aDuration = a.resolvedAt ? new Date(a.resolvedAt).getTime() - new Date(a.startedAt).getTime() : Date.now() - new Date(a.startedAt).getTime();
        const bDuration = b.resolvedAt ? new Date(b.resolvedAt).getTime() - new Date(b.startedAt).getTime() : Date.now() - new Date(b.startedAt).getTime();
        return bDuration - aDuration;
      });
    }
    
    return filtered;
  }, [incidents, filters, sortBy]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ incidentId, newStatus }: { incidentId: string; newStatus: string }) => {
      return api.updateIncidentStatus(token, incidentId, newStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setSelectedIncident(null);
    },
  });

  if (isLoading) return <p className="text-slate-400">{t("loading")}</p>;

  return (
    <div className="space-y-6">
      {/* Filters and Actions Bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">{t("filters")}:</span>
          </div>
          
          <select
            className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[42px]"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">{t("allStatuses")}</option>
            <option value="OPEN">{t("open")}</option>
            <option value="INVESTIGATING">{t("investigating")}</option>
            <option value="MITIGATED">{t("mitigated")}</option>
            <option value="RESOLVED">{t("resolved")}</option>
          </select>
          
          <select
            className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[42px]"
            value={filters.monitorId}
            onChange={(e) => setFilters({ ...filters, monitorId: e.target.value })}
          >
            <option value="all">{t("allMonitors")}</option>
            {monitors?.map((m: any) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          
          <select
            className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[42px]"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "duration")}
          >
            <option value="date">{t("sortBy")} {t("date")}</option>
            <option value="duration">{t("sortBy")} {t("duration")}</option>
          </select>
        </div>
      </Card>

      {/* Incidents List */}
      <div className="space-y-4">
        {filteredIncidents.map((incident) => {
          const duration = incident.resolvedAt
            ? Math.round((new Date(incident.resolvedAt).getTime() - new Date(incident.startedAt).getTime()) / 1000 / 60)
            : Math.round((Date.now() - new Date(incident.startedAt).getTime()) / 1000 / 60);

          return (
            <Card key={incident.id} className="hover:border-white/20 transition cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {incident.monitor?.name ?? incident.monitorId}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[incident.status as keyof typeof statusColors]}`}>
                      {incident.status}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{latestMessage(incident)}</p>
                  
                  <div className="flex items-center gap-6 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {t("date")} {incident.startedAt ? format(new Date(incident.startedAt), "PPp") : "Unknown"}
                    </div>
                    {incident.resolvedAt && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        {t("resolved")} {format(new Date(incident.resolvedAt), "PPp")}
                      </div>
                    )}
                    <div className="font-medium text-slate-900 dark:text-white">
                      {t("duration")}: {duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`}
                    </div>
                  </div>
                  
                  {incident.events && incident.events.length > 0 && (
                    <div className="mt-4 space-y-2 pl-4 border-l-2 border-white/10">
                      {incident.events.slice(0, 3).map((event: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <span className="text-slate-500">
                            {event.timestamp ? format(new Date(event.timestamp), "HH:mm:ss") : "N/A"}
                          </span>
                          <span className="ml-2 text-slate-400">{event.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  <StatusBadge status={badgeStatus(incident)} />
                  {incident.status !== "RESOLVED" && (
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedIncident(incident)}
                      className="text-xs px-2 py-1"
                    >
                      {t("updateStatus")}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        
        {filteredIncidents.length === 0 && (
          <Card>
            <p className="text-center text-slate-400">{t("noIncidents")}</p>
          </Card>
        )}
      </div>

      {/* Status Update Modal (simplified) */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4">{t("updateStatus")}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{selectedIncident.monitor?.name}</p>
            <div className="space-y-2">
              {["INVESTIGATING", "MITIGATED", "RESOLVED"].map((status) => (
                <Button
                  key={status}
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    updateStatusMutation.mutate({ incidentId: selectedIncident.id, newStatus: status });
                  }}
                >
                  {t(status.toLowerCase() as "investigating" | "mitigated" | "resolved")}
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => setSelectedIncident(null)}>
              {t("cancel")}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
