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

  const [isEditing, setIsEditing] = useState(false);

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.createMaintenance(token, payload),
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
    if (isEditing && form.id) {
      const { id, ...payload } = form;
      updateMutation.mutate({ id, payload });
    } else {
      createMutation.mutate(form);
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
          <h3 className="text-xl font-semibold text-white">
            {isEditing ? t("editMaintenanceWindow") : t("createMaintenanceWindow")}
          </h3>
          <p className="text-sm text-slate-400">
            {t("maintenanceDescription")}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">{t("windowName")}</label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
              placeholder={t("maintenancePlaceholder")}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">{t("startTime")}</label>
              <input
                type="datetime-local"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                value={form.startsAt}
                onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">{t("endTime")}</label>
              <input
                type="datetime-local"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                value={form.endsAt}
                onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">
              {t("affectedMonitors")}
            </label>
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
                  <span className="text-sm text-white">{monitor.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{monitor.kind}</span>
                </label>
              ))}
            </div>
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
        <h3 className="mb-4 text-xl font-semibold text-white">{t("scheduledMaintenance")}</h3>
        <div className="space-y-3">
          {windows?.map((window: any) => {
            const isActive = new Date(window.startsAt) <= new Date() && new Date() <= new Date(window.endsAt);
            const isPast = new Date() > new Date(window.endsAt);
            
            return (
              <div
                key={window.id}
                className={`flex items-start justify-between rounded-2xl border p-4 ${
                  isActive
                    ? "border-yellow-500/50 bg-yellow-500/10"
                    : isPast
                    ? "border-white/5 bg-white/5 opacity-50"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <p className="font-semibold text-white">{window.name}</p>
                    {isActive && (
                      <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-black">
                        {t("active").toUpperCase()}
                      </span>
                    )}
                    {isPast && (
                      <span className="rounded-full bg-slate-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {t("past").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(window.startsAt).toLocaleString()}
                    </span>
                    <span>→</span>
                    <span>{new Date(window.endsAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {window.monitors?.length || 0} {t("monitorsAffected")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/10"
                    onClick={() => handleEdit(window)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
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
            <p className="text-sm text-slate-400">{t("noMaintenanceWindows")}</p>
          )}
        </div>
      </Card>
    </div>
  );
};
