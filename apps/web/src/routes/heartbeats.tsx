import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { Trash2, Copy } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "../hooks/use-translation.js";

export const HeartbeatsRoute = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ monitorId: "", heartbeatEvery: 300 });
  const [error, setError] = useState<string | null>(null);
  
  const { data: heartbeats } = useQuery({
    queryKey: ["heartbeats"],
    queryFn: () => api.listHeartbeats(token),
    enabled: Boolean(token),
  });

  const { data: monitors } = useQuery({
    queryKey: ["monitors"],
    queryFn: () => api.listMonitors(token),
    enabled: Boolean(token),
  });

  // Filter to only show push monitors
  const pushMonitors = monitors?.filter((monitor: any) => monitor.kind === "push") || [];
  
  // Filter out monitors that already have heartbeat tokens
  const availableMonitors = pushMonitors.filter((monitor: any) => 
    !heartbeats?.some((hb: any) => hb.monitorId === monitor.id)
  );

  const createMutation = useMutation({
    mutationFn: (payload: { monitorId: string; heartbeatEvery: number }) =>
      api.createHeartbeat(token, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["heartbeats"] });
      setForm({ monitorId: "", heartbeatEvery: 300 });
      setError(null);
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        setError(t("deleteExistingToken"));
      } else {
        setError(err?.message || t("error"));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteHeartbeat(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["heartbeats"] });
    },
  });

  const copyToClipboard = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    alert(t("heartbeatUrlCopied"));
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{t("createHeartbeatToken")}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("generateHeartbeatUrl")}</p>
        </div>
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 dark:border-red-500/20 p-3">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
        )}
        {pushMonitors.length === 0 ? (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 dark:border-yellow-500/20 p-4 text-center">
            <p className="text-sm text-yellow-700 dark:text-yellow-200 mb-2">
              📝 {t("noPushMonitors")}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-300/70">
              {t("noPushMonitorsDesc")}
            </p>
            <a href="/monitors" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline mt-2 inline-block">
              {t("goToMonitors")}
            </a>
          </div>
        ) : availableMonitors.length === 0 ? (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20 p-4 text-center">
            <p className="text-sm text-blue-700 dark:text-blue-200 mb-2">
              ✅ {t("allPushHaveTokens")}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300/70">
              {t("deleteExistingToken")}
            </p>
          </div>
        ) : (
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              createMutation.mutate(form);
            }}
          >
            <select
              className="rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]"
              value={form.monitorId}
              onChange={(e) => setForm((prev) => ({ ...prev, monitorId: e.target.value }))}
              required
            >
              <option value="">{t("selectMonitors")}</option>
              {availableMonitors.map((monitor) => (
                <option key={monitor.id} value={monitor.id}>
                  {monitor.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              placeholder={t("interval")}
              value={form.heartbeatEvery}
              onChange={(e) => setForm((prev) => ({ ...prev, heartbeatEvery: Number(e.target.value) }))}
              min="60"
              max="86400"
              required
            />
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t("loading") : t("createHeartbeatToken")}
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h3 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">{t("activeHeartbeats")}</h3>
        <div className="space-y-4">
          {heartbeats?.map((heartbeat) => (
            <div key={heartbeat.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 dark:text-white">{heartbeat.monitor.name}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t("heartbeatEvery")} {heartbeat.heartbeatEvery}s
                  </p>
                  {heartbeat.lastHeartbeat && (
                    <p className="text-xs text-slate-500 mt-1">
                      {t("lastCheck")}: {format(new Date(heartbeat.lastHeartbeat), "MMM dd, HH:mm:ss")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-xs bg-black/20 px-2 py-1 rounded">
                      POST /api/heartbeat/{heartbeat.tokenHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`/api/heartbeat/${heartbeat.tokenHash}`)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (confirm(t("deleteHeartbeatConfirm"))) {
                      deleteMutation.mutate(heartbeat.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!heartbeats?.length && (
            <p className="text-center text-slate-400 py-8">{t("noHeartbeats")}</p>
          )}
        </div>
      </Card>
    </div>
  );
};
