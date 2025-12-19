import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { Trash2, Calendar, Clock, Edit2 } from "lucide-react";

export const MaintenanceRoute = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const { data: windows, isLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: () => api.listMaintenance(token),
    enabled: Boolean(token),
  });

  const { data: monitors } = useQuery({
    queryKey: ["monitors"],
    queryFn: () => api.listMonitors(token),
    enabled: Boolean(token),
  });

  const [form, setForm] = useState({
    id: null as string | null,
    name: "",
    startsAt: "",
    endsAt: "",
    monitorIds: [] as string[],
  });

  // Helper to convert Date to local datetime-local input format
  const toLocalDateTimeString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper to get local date in YYYY-MM-DD format
  const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [isEditing, setIsEditing] = useState(false);

  const createMutation = useMutation({
    mutationFn: (payload: Omit<typeof form, "id">) => api.createMaintenance(token, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      setForm({ id: null, name: "", startsAt: "", endsAt: "", monitorIds: [] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<typeof form, "id"> }) => 
      api.updateMaintenance(token, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      setForm({ id: null, name: "", startsAt: "", endsAt: "", monitorIds: [] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMaintenance(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate monitors selected
    if (form.monitorIds.length === 0) {
      alert(t("pleaseSelectMonitors") || "Please select at least one monitor");
      return;
    }
    
    // Validate end time is after start time
    const start = new Date(form.startsAt);
    const end = new Date(form.endsAt);
    
    if (end <= start) {
      alert(t("endTimeMustBeAfterStart") || "End time must be after start time");
      return;
    }
    
    // Validate minimum duration (at least 1 minute)
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = durationMs / 60000;
    
    if (durationMinutes < 1) {
      alert(t("minimumDurationOneMinute") || "Maintenance window must be at least 1 minute");
      return;
    }

    // If start time is in the past, adjust it to now (for immediate maintenance)
    const now = new Date();
    const adjustedStart = start < now ? now : start;
    
    const payload = {
      name: form.name,
      startsAt: adjustedStart.toISOString(),
      endsAt: end.toISOString(),
      monitorIds: form.monitorIds,
    };
    
    if (isEditing && form.id) {
      updateMutation.mutate({ id: form.id as string, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (window: any) => {
    setForm({
      id: window.id,
      name: window.name,
      startsAt: new Date(window.startsAt).toISOString().slice(0, 16),
      endsAt: new Date(window.endsAt).toISOString().slice(0, 16),
      monitorIds: window.monitors?.map((m: any) => m.id) || [],
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setForm({ id: null, name: "", startsAt: "", endsAt: "", monitorIds: [] });
    setIsEditing(false);
  };

  const handleDelete = (window: any) => {
    if (confirm(`${t("delete")} "${window.name}"?`)) {
      deleteMutation.mutate(window.id);
    }
  };

  const toggleMonitor = (monitorId: string) => {
    setForm((prev) => ({
      ...prev,
      monitorIds: prev.monitorIds.includes(monitorId)
        ? prev.monitorIds.filter((id) => id !== monitorId)
        : [...prev.monitorIds, monitorId],
    }));
  };

  if (isLoading) return <p className="text-slate-400">{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isEditing ? t("editMaintenanceWindow") : t("createMaintenanceWindow")}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("maintenanceDescription")}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("windowName")}</label>
            <input
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              placeholder={t("maintenancePlaceholder")}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <label className="mb-3 block text-sm font-medium text-slate-900 dark:text-white">{t("startTime")}</label>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">{t("date")}</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white [color-scheme:dark]"
                    value={form.startsAt.slice(0, 10)}
                    onChange={(e) => {
                      const time = form.startsAt.slice(11) || "00:00";
                      setForm((prev) => ({ ...prev, startsAt: `${e.target.value}T${time}` }));
                    }}
                    min={toLocalDateString(new Date())}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">{t("time")}</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white [color-scheme:dark]"
                    value={form.startsAt.slice(11, 16) || "00:00"}
                    onChange={(e) => {
                      const date = form.startsAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
                      setForm((prev) => ({ ...prev, startsAt: `${date}T${e.target.value}` }));
                    }}
                    required
                  />
                </div>
              </div>
              {form.startsAt && form.startsAt.length >= 16 && (
                <p className="mt-2 text-xs text-slate-400">
                  📅 {new Date(form.startsAt).toLocaleString()}
                </p>
              )}
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <label className="mb-3 block text-sm font-medium text-slate-900 dark:text-white">{t("endTime")}</label>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">{t("date")}</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white [color-scheme:dark]"
                    value={form.endsAt.slice(0, 10)}
                    onChange={(e) => {
                      const time = form.endsAt.slice(11) || "00:00";
                      setForm((prev) => ({ ...prev, endsAt: `${e.target.value}T${time}` }));
                    }}
                    min={form.startsAt.slice(0, 10) || new Date().toISOString().slice(0, 10)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">{t("time")}</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white [color-scheme:dark]"
                    value={form.endsAt.slice(11, 16) || "00:00"}
                    onChange={(e) => {
                      const date = form.endsAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
                      setForm((prev) => ({ ...prev, endsAt: `${date}T${e.target.value}` }));
                    }}
                    required
                  />
                </div>
              </div>
              {form.endsAt && form.endsAt.length >= 16 && (
                <p className="mt-2 text-xs text-slate-400">
                  📅 {new Date(form.endsAt).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/10"
                onClick={() => {
                  const now = new Date();
                  const end = new Date(now.getTime() + 60 * 60000); // 1 hour from now
                  setForm(prev => ({
                    ...prev,
                    startsAt: toLocalDateTimeString(now),
                    endsAt: toLocalDateTimeString(end)
                  }));
                }}
              >
                {t("nowOneHour")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/10"
                onClick={() => {
                  const now = new Date();
                  const end = new Date(now.getTime() + 2 * 60 * 60000); // 2 hours from now
                  setForm(prev => ({
                    ...prev,
                    startsAt: toLocalDateTimeString(now),
                    endsAt: toLocalDateTimeString(end)
                  }));
                }}
              >
                {t("nowTwoHours")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/10"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getTime() + 30 * 60000); // Start in 30 min
                  const end = new Date(start.getTime() + 60 * 60000); // Duration: 1 hour
                  setForm(prev => ({
                    ...prev,
                    startsAt: toLocalDateTimeString(start),
                    endsAt: toLocalDateTimeString(end)
                  }));
                }}
              >
                {t("scheduledIn30Min")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/10"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getTime() + 60 * 60000); // Start in 1 hour
                  const end = new Date(start.getTime() + 60 * 60000); // Duration: 1 hour
                  setForm(prev => ({
                    ...prev,
                    startsAt: toLocalDateTimeString(start),
                    endsAt: toLocalDateTimeString(end)
                  }));
                }}
              >
                🕑 In 1 hour (1 hour)
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/10"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getTime() + 2 * 60 * 60000); // Start in 2 hours
                  const end = new Date(start.getTime() + 60 * 60000); // Duration: 1 hour
                  setForm(prev => ({
                    ...prev,
                    startsAt: toLocalDateTimeString(start),
                    endsAt: toLocalDateTimeString(end)
                  }));
                }}
              >
                🕒 In 2 hours (1 hour)
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/10"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now);
                  start.setHours(22, 0, 0, 0); // Tonight at 10 PM
                  // If 10 PM has already passed today, set it for tomorrow
                  if (start <= now) {
                    start.setDate(start.getDate() + 1);
                  }
                  const end = new Date(start.getTime() + 4 * 60 * 60000); // Duration: 4 hours
                  setForm(prev => ({
                    ...prev,
                    startsAt: toLocalDateTimeString(start),
                    endsAt: toLocalDateTimeString(end)
                  }));
                }}
              >
                🌙 Tonight 10 PM (4 hours)
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/10"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now);
                  start.setDate(start.getDate() + 1); // Tomorrow
                  start.setHours(2, 0, 0, 0); // 2 AM
                  const end = new Date(start.getTime() + 4 * 60 * 60000); // Duration: 4 hours
                  setForm(prev => ({
                    ...prev,
                    startsAt: toLocalDateTimeString(start),
                    endsAt: toLocalDateTimeString(end)
                  }));
                }}
              >
                🌅 Tomorrow 2 AM (4 hours)
              </button>
            </div>
          </div>

          {form.startsAt && form.endsAt && (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20 px-4 py-3">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {t("duration")}: {(() => {
                  const start = new Date(form.startsAt);
                  const end = new Date(form.endsAt);
                  const diffMs = end.getTime() - start.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const hours = Math.floor(diffMins / 60);
                  const mins = diffMins % 60;
                  if (hours > 24) {
                    const days = Math.floor(hours / 24);
                    const remainingHours = hours % 24;
                    return `${days}d ${remainingHours}h ${mins}m`;
                  }
                  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                })()}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("affectedMonitors")} <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            {form.monitorIds.length === 0 && (
              <p className="mb-2 text-xs text-yellow-600 dark:text-yellow-400">
                ⚠️ {t("pleaseSelectMonitors")}
              </p>
            )}
            <div className="grid gap-2 md:grid-cols-2">
              {monitors?.map((monitor: any) => (
                <label
                  key={monitor.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
                >
                  <input
                    type="checkbox"
                    checked={form.monitorIds.includes(monitor.id)}
                    onChange={() => toggleMonitor(monitor.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-900 dark:text-white">{monitor.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{monitor.kind}</span>
                </label>
              ))}
            </div>
            {form.monitorIds.length > 0 && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                ✓ {form.monitorIds.length} {t("monitorsAffected")}
              </p>
            )}
          </div>

          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending
              ? isEditing ? t("updating") : t("loading")
              : isEditing ? t("updateMaintenanceWindow") : t("createMaintenanceWindow")}
          </Button>
          {isEditing && (
            <Button variant="ghost" type="button" onClick={handleCancel}>
              {t("cancel")}
            </Button>
          )}
        </form>
      </Card>

      <Card>
        <h3 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">{t("scheduledMaintenance")}</h3>
        <div className="space-y-3">
          {windows?.map((window: any) => {
            const now = new Date();
            const startsAt = new Date(window.startsAt);
            const endsAt = new Date(window.endsAt);
            
            const isUpcoming = startsAt > now;
            const isActive = startsAt <= now && now <= endsAt;
            const isPast = now > endsAt;
            
            return (
              <div
                key={window.id}
                className={`flex items-start justify-between rounded-2xl border p-4 ${
                  isActive
                    ? "border-yellow-500/50 bg-yellow-500/10"
                    : isUpcoming
                    ? "border-blue-500/50 bg-blue-500/10"
                    : isPast
                    ? "border-slate-300 dark:border-white/5 bg-slate-100 dark:bg-white/5 opacity-50"
                    : "border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <p className="font-semibold text-slate-900 dark:text-white">{window.name}</p>
                    {isUpcoming && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">
                        {t("upcoming").toUpperCase()}
                      </span>
                    )}
                    {isActive && (
                      <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-black">
                        {t("active").toUpperCase()}
                      </span>
                    )}
                    {isPast && (
                      <span className="rounded-full bg-slate-500 dark:bg-slate-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {t("past").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(window.startsAt).toLocaleString()}
                    </span>
                    <span>→</span>
                    <span>{new Date(window.endsAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    {window.monitors?.length || 0} {t("monitorsAffected")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                    onClick={() => handleEdit(window)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    onClick={() => handleDelete(window)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {(windows?.length ?? 0) === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("noMaintenanceWindows")}</p>
          )}
        </div>
      </Card>
    </div>
  );
};
