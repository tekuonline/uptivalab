import type { NotificationChannel } from "@uptivalab/shared";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { Trash2, Mail, Bell, Webhook, MessageSquare, Send } from "lucide-react";

export const NotificationsRoute = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ 
    queryKey: ["notifications"], 
    queryFn: () => api.listNotifications(token), 
    enabled: Boolean(token) 
  });

  const [form, setForm] = useState<{ 
    name: string; 
    type: "email" | "ntfy" | "webhook" | "discord" | "slack" | "telegram" | "gotify" | "pushover" | "apprise"; 
    config: Record<string, string>;
  }>({ 
    name: "", 
    type: "email", 
    config: {} 
  });

  // Get config fields based on notification type
  const getConfigFields = (type: string) => {
    switch (type) {
      case "email":
        return [
          { key: "email", label: t("email"), placeholder: "ops@example.com", type: "email" },
          { key: "smtpHost", label: t("smtpHost"), placeholder: "smtp.gmail.com", type: "text" },
          { key: "smtpPort", label: t("smtpPort"), placeholder: "587", type: "number" },
          { key: "smtpUser", label: t("smtpUser"), placeholder: "your-email@gmail.com", type: "text" },
          { key: "smtpPass", label: `${t("password")} (SMTP)`, placeholder: "your-app-password", type: "password" },
          { key: "smtpFrom", label: `${t("email")} (${t("optional")})`, placeholder: "noreply@example.com", type: "email" },
        ];
      case "ntfy":
        return [{ key: "topic", label: t("ntfyTopic"), placeholder: "my-alerts", type: "text" }];
      case "webhook":
        return [{ key: "url", label: t("webhookUrl"), placeholder: "https://example.com/webhook", type: "url" }];
      case "discord":
        return [{ key: "webhookUrl", label: t("discordWebhook"), placeholder: "https://discord.com/api/webhooks/...", type: "url" }];
      case "slack":
        return [{ key: "webhookUrl", label: t("slackWebhook"), placeholder: "https://hooks.slack.com/services/...", type: "url" }];
      case "telegram":
        return [
          { key: "botToken", label: t("telegramBotToken"), placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11", type: "text" },
          { key: "chatId", label: t("telegramChatId"), placeholder: "-1001234567890", type: "text" }
        ];
      case "gotify":
        return [
          { key: "serverUrl", label: t("gotifyServerUrl"), placeholder: "https://gotify.example.com", type: "url" },
          { key: "appToken", label: t("gotifyAppToken"), placeholder: "AxaBcdEfGhIjKl", type: "text" }
        ];
      case "pushover":
        return [
          { key: "userKey", label: t("pushoverUserKey"), placeholder: "azGDORePK8gMaC0QOYAMyEEuzJnyUi", type: "text" },
          { key: "apiToken", label: t("pushoverApiToken"), placeholder: "azGDORePK8gMaC0QOYAMyEEuzJnyUi", type: "text" }
        ];
      case "apprise":
        return [{ key: "url", label: t("appriseUrl"), placeholder: "discord://webhook_id/webhook_token", type: "text" }];
      default:
        return [];
    }
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; type: string; config: Record<string, string> }) => 
      api.createNotification(token, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setForm({ name: "", type: "email", config: {} });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNotification(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleDelete = (channel: NotificationChannel) => {
    if (confirm(`${t("delete")} "${channel.name}"?`)) {
      deleteMutation.mutate(channel.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const configFields = getConfigFields(form.type);
    const config: Record<string, string> = {};
    
    configFields.forEach(field => {
      const value = form.config[field.key];
      if (value) {
        config[field.key] = value;
      }
    });

    createMutation.mutate({ ...form, config });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-5 w-5" />;
      case "ntfy": return <Bell className="h-5 w-5" />;
      case "webhook": return <Webhook className="h-5 w-5" />;
      case "discord": return <MessageSquare className="h-5 w-5" />;
      case "slack": return <MessageSquare className="h-5 w-5" />;
      case "telegram": return <Send className="h-5 w-5" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  if (isLoading) return <p className="text-slate-400">{t("loading")}</p>;

  const configFields = getConfigFields(form.type);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{t("createNotificationChannel")}</h3>
          <p className="text-sm text-slate-400">{t("notificationChannelDescription")}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">{t("name")}</label>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                placeholder="Production Alerts"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">{t("type")}</label>
              <select
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                value={form.type}
                onChange={(e) => {
                  const newType = e.target.value as "email" | "ntfy" | "webhook" | "discord" | "slack" | "telegram" | "gotify" | "pushover" | "apprise";
                  setForm((prev) => ({ ...prev, type: newType, config: {} }));
                }}
              >
                <option value="email">Email (SMTP)</option>
                <option value="ntfy">ntfy.sh</option>
                <option value="webhook">Webhook</option>
                <option value="discord">Discord</option>
                <option value="slack">Slack</option>
                <option value="telegram">Telegram</option>
                <option value="gotify">Gotify</option>
                <option value="pushover">Pushover</option>
                <option value="apprise">Apprise</option>
              </select>
            </div>
          </div>

          {form.type === "email" && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <p className="text-sm text-blue-200 mb-2">📧 SMTP {t("configuration")}</p>
              <p className="text-xs text-blue-300/70">
                {t("smtpHelpText")}
              </p>
              <ul className="text-xs text-blue-300/70 mt-2 ml-4 space-y-1">
                <li>• Port 587 (TLS/STARTTLS) - {t("recommended")}</li>
                <li>• Port 465 (SSL) - {t("secureConnection")}</li>
                <li>• Port 25 ({t("unencrypted")}) - {t("notRecommended")}</li>
              </ul>
              <p className="text-xs text-blue-300/70 mt-2">
                💡 {t("gmailNote")}: {t("usePort587")} <a href="https://support.google.com/accounts/answer/185833" target="_blank" className="underline hover:text-blue-200">{t("appPasswordLink")}</a>.
              </p>
            </div>
          )}

          {configFields.map((field) => (
            <div key={field.key}>
              <label className="mb-2 block text-xs font-medium text-slate-400">{field.label}</label>
              <input
                type={field.type}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                placeholder={field.placeholder}
                value={form.config[field.key] || ""}
                onChange={(e) => setForm((prev) => ({ 
                  ...prev, 
                  config: { ...prev.config, [field.key]: e.target.value }
                }))}
                required={!field.label.includes(t("optional"))}
              />
            </div>
          ))}

          <Button type="submit" disabled={createMutation.isPending} className="w-full md:w-auto">
            {createMutation.isPending ? t("loading") : t("createNotificationChannel")}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-4 text-xl font-semibold text-white">{t("notificationChannels")}</h3>
        <div className="space-y-3">
          {data?.map((channel: NotificationChannel) => (
            <div key={channel.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-slate-400">
                  {getIcon(channel.type)}
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{channel.type}</p>
                  <p className="text-lg font-medium text-white">{channel.name}</p>
                  {channel.config && Object.keys(channel.config).length > 0 && (
                    <p className="text-xs text-slate-400">
                      {Object.entries(channel.config).map(([k, v]) => 
                        k === 'botToken' || k === 'apiToken' || k === 'userKey' || k === 'appToken' || k === 'smtpPass'
                          ? `${k}: ***` 
                          : `${k}: ${v}`
                      ).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                className="px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                onClick={() => handleDelete(channel)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(data?.length ?? 0) === 0 && <p className="text-sm text-slate-400">{t("noNotifications")}</p>}
        </div>
      </Card>
    </div>
  );
};
