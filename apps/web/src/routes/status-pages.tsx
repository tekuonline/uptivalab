import type { StatusPage } from "@uptivalab/shared";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { Trash2, ExternalLink, Edit } from "lucide-react";

export const StatusPagesRoute = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    slug: "", 
    heroMessage: "", 
    monitorIds: [] as string[],
    showIncidents: true,
    showMaintenance: true,
    theme: "system" as "light" | "dark" | "system",
  });
  
  const { data, isLoading } = useQuery({ 
    queryKey: ["status-pages"], 
    queryFn: () => api.listStatusPages(token), 
    enabled: Boolean(token) 
  });

  const { data: monitors } = useQuery({
    queryKey: ["monitors"],
    queryFn: () => api.listMonitors(token),
    enabled: Boolean(token),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; slug: string; heroMessage?: string; monitorIds?: string[]; showIncidents?: boolean; showMaintenance?: boolean; theme?: string }) =>
      api.createStatusPage(token, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status-pages"] });
      setForm({ name: "", slug: "", heroMessage: "", monitorIds: [], showIncidents: true, showMaintenance: true, theme: "system" });
      setShowForm(false);
      setEditingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<{ name: string; slug: string; heroMessage?: string; monitorIds?: string[]; showIncidents?: boolean; showMaintenance?: boolean; theme?: string }> }) =>
      api.updateStatusPage(token, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status-pages"] });
      setForm({ name: "", slug: "", heroMessage: "", monitorIds: [], showIncidents: true, showMaintenance: true, theme: "system" });
      setShowForm(false);
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStatusPage(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status-pages"] });
    },
  });

  const handleCreate = () => {
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        payload: {
          name: form.name,
          slug: form.slug,
          heroMessage: form.heroMessage || undefined,
          monitorIds: form.monitorIds.length > 0 ? form.monitorIds : undefined,
          showIncidents: form.showIncidents,
          showMaintenance: form.showMaintenance,
          theme: form.theme,
        },
      });
    } else {
      createMutation.mutate({
        name: form.name,
        slug: form.slug,
        heroMessage: form.heroMessage || undefined,
        monitorIds: form.monitorIds.length > 0 ? form.monitorIds : undefined,
        showIncidents: form.showIncidents,
        showMaintenance: form.showMaintenance,
        theme: form.theme,
      });
    }
  };

  const handleEdit = (page: StatusPage) => {
    // Fetch the full status page with monitors
    api.getStatusPage(token, page.id).then((fullPage) => {
      setEditingId(page.id);
      setForm({
        name: fullPage.name,
        slug: fullPage.slug,
        heroMessage: fullPage.heroMessage || "",
        monitorIds: (fullPage as any).monitors?.map((m: any) => m.id) || [],
        showIncidents: (fullPage as any).showIncidents ?? true,
        showMaintenance: (fullPage as any).showMaintenance ?? true,
        theme: ((fullPage as any).theme as "light" | "dark" | "system") || "system",
      });
      setShowForm(true);
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", slug: "", heroMessage: "", monitorIds: [], showIncidents: true, showMaintenance: true, theme: "system" });
  };

  const handleDelete = (page: StatusPage) => {
    if (confirm(`${t("delete")} "${page.name}"?`)) {
      deleteMutation.mutate(page.id);
    }
  };

  const toggleMonitor = (monitorId: string) => {
    setForm(prev => ({
      ...prev,
      monitorIds: prev.monitorIds.includes(monitorId)
        ? prev.monitorIds.filter(id => id !== monitorId)
        : [...prev.monitorIds, monitorId]
    }));
  };

  if (isLoading) {
    return <p className="text-slate-400">{t("loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{t("externalFacing")}</p>
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("statusPages")}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("publishTransparency")}</p>
          </div>
          <Button variant="secondary" onClick={() => {
            if (showForm) {
              handleCancel();
            } else {
              setShowForm(true);
            }
          }}>
            {showForm ? t("cancel") : t("newPage")}
          </Button>
        </div>
      </Card>

      {showForm && (
        <Card className="space-y-4">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            {editingId ? t("editStatusPage") : t("createStatusPage")}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("pageName")}</label>
              <input
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                placeholder={t("pageNamePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("slug")}</label>
              <input
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                placeholder={t("slugPlaceholder")}
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                pattern="^[a-z0-9-]+$"
                required
              />
              <p className="text-xs text-slate-500 mt-1">{t("slugDescription")}: /status/{form.slug || 'your-slug'}</p>
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("heroMessage")} ({t("optional")})</label>
              <textarea
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
                placeholder={t("heroMessagePlaceholder")}
                value={form.heroMessage}
                onChange={(e) => setForm((prev) => ({ ...prev, heroMessage: e.target.value }))}
                maxLength={280}
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("monitorsToInclude")}</label>
              <div className="space-y-2">
                {monitors?.map((monitor) => (
                  <label key={monitor.id} className="flex items-center gap-3 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={form.monitorIds.includes(monitor.id)}
                      onChange={() => toggleMonitor(monitor.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-900 dark:text-white">{monitor.name}</span>
                  </label>
                ))}
                {(!monitors || monitors.length === 0) && (
                  <p className="text-sm text-slate-600 dark:text-slate-500">{t("noMonitorsAvailable")}</p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm text-slate-600 dark:text-slate-400 block">{t("displayOptions")}</label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={form.showIncidents}
                  onChange={(e) => setForm((prev) => ({ ...prev, showIncidents: e.target.checked }))}
                  className="rounded"
                />
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{t("showIncidents")}</span>
                  <p className="text-xs text-slate-600 dark:text-slate-500">{t("showIncidentsDescription")}</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={form.showMaintenance}
                  onChange={(e) => setForm((prev) => ({ ...prev, showMaintenance: e.target.checked }))}
                  className="rounded"
                />
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{t("showUpcomingMaintenance")}</span>
                  <p className="text-xs text-slate-600 dark:text-slate-500">{t("showMaintenanceDescription")}</p>
                </div>
              </label>
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">{t("theme")}</label>
              <select
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white h-[46px]"
                value={form.theme}
                onChange={(e) => setForm((prev) => ({ ...prev, theme: e.target.value as "light" | "dark" | "system" }))}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
              <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">Choose the theme for your public status page</p>
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending || updateMutation.isPending || !form.name || !form.slug}>
              {(createMutation.isPending || updateMutation.isPending) 
                ? (editingId ? t("updating") : t("loading")) 
                : (editingId ? t("updateStatusPage") : t("createStatusPage"))}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((page: StatusPage) => (
          <Card key={page.id} className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{page.slug}</p>
                <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{page.name}</h4>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => handleEdit(page)} disabled={deleteMutation.isPending}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => handleDelete(page)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {page.heroMessage && <p className="text-sm text-slate-600 dark:text-slate-400">{page.heroMessage}</p>}
            <div className="flex gap-2">
              <Button asChild variant="ghost" className="px-0 text-primary">
                <a href={`/status/${page.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t("viewPublicPage")}
                </a>
              </Button>
            </div>
          </Card>
        ))}
        {(data?.length ?? 0) === 0 && !showForm && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("noStatusPages")}</p>
        )}
      </div>
    </div>
  );
};
