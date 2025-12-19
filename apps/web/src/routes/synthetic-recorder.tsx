import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Card } from "../components/ui/card.js";
import { ArrowLeft, Trash2, AlertCircle, Play } from "lucide-react";
import { useAuth } from "../providers/auth-context.js";
import { api } from "../lib/api.js";
import { useTranslation } from "../hooks/use-translation.js";

interface RecordedStep {
  id: string;
  action: string;
  selector?: string;
  url?: string;
  value?: string;
}

export default function SyntheticRecorder() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t } = useTranslation();
  const [recordingUrl, setRecordingUrl] = useState("");
  const [browser, setBrowser] = useState("chromium");
  const [steps, setSteps] = useState<RecordedStep[]>([]);
  const [monitorName, setMonitorName] = useState("");
  const [playwrightCode, setPlaywrightCode] = useState("");
  const [interval, setInterval] = useState(60);
  const [timeout, setTimeout] = useState(48);
  const [showCommand, setShowCommand] = useState("");
  const [notificationIds, setNotificationIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [useLocalBrowser, setUseLocalBrowser] = useState(false);
  
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.listNotifications(token),
    enabled: Boolean(token),
  });

  const getCodegenCommand = async () => {
    if (!recordingUrl) {
      alert("Please enter a URL first");
      return;
    }

    try {
      const data = await api.recorderCodegen(token, {
        url: recordingUrl,
        browser: browser,
      });
      
      if (data.command) {
        setShowCommand(data.command);
      }
    } catch (error) {
      console.error("Failed to get codegen command:", error);
      alert("Failed to generate command. See console for details.");
    }
  };

  const parsePlaywrightCode = async () => {
    if (!playwrightCode.trim()) {
      alert("Please paste Playwright code first");
      return;
    }

    try {
      const data = await api.recorderParse(token, { code: playwrightCode });
      
      if (data.steps && Array.isArray(data.steps)) {
        const newSteps = data.steps.map((step: any, index: number) => ({
          id: `${Date.now()}-${index}`,
          ...step,
        }));
        setSteps(newSteps);
        setPlaywrightCode("");
        alert(`✓ Parsed ${data.steps.length} steps!`);
      }
    } catch (error) {
      console.error("Failed to parse code:", error);
      alert("Failed to parse Playwright code. Make sure you copied the correct code.");
    }
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const createMonitor = async () => {
    if (!monitorName || steps.length === 0) {
      alert("Please add a monitor name and at least one step");
      return;
    }

    // Ensure interval is at least 15 seconds
    const intervalSeconds = Math.max(interval, 15);

    try {
      const stepsJSON = steps.map(({ id, ...step }) => step);

      await api.createMonitor(token, {
        name: monitorName,
        kind: "synthetic",
        interval: intervalSeconds * 1000,
        timeout: timeout * 1000,
        config: {
          browser: browser,
          useLocalBrowser: useLocalBrowser,
          baseUrl: baseUrl || undefined,
          steps: stepsJSON,
        },
        notificationIds: notificationIds.length > 0 ? notificationIds : undefined,
      });

      alert("✓ Monitor created successfully!\n\nNote: Make sure you have configured a remote Playwright browser in Settings, or the monitor will fail. See Settings → Remote Browsers.");
      navigate("/");
    } catch (error) {
      console.error("Failed to create monitor:", error);
      alert("Failed to create monitor: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("back")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("syntheticRecorder")}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t("recordBrowserInteractions")}</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Left: Recording */}
          <Card className="p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">1. {t("recordSteps")}</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("urlToRecord")}</label>
                  <Input
                    placeholder={t("recorderUrlPlaceholder")}
                    value={recordingUrl}
                    onChange={(e) => setRecordingUrl(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("browser")}</label>
                  <select
                    value={browser}
                    onChange={(e) => setBrowser(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="chromium">Chromium</option>
                    <option value="firefox">Firefox</option>
                    <option value="webkit">WebKit (Safari)</option>
                  </select>
                </div>

                <Button onClick={getCodegenCommand} disabled={!recordingUrl} className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  {t("getCommand")}
                </Button>

                {showCommand && (
                  <div className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Run this in your terminal:</p>
                    <code className="block text-xs bg-black text-green-400 p-2 rounded overflow-x-auto">
                      {showCommand}
                    </code>
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <p>Then:</p>
                      <ol className="list-decimal list-inside space-y-0.5 ml-2">
                        <li>Browser opens with Playwright Inspector</li>
                        <li>Click the record button (red dot)</li>
                        <li>Interact with the website</li>
                        <li>Copy the code from Inspector</li>
                        <li>Paste it below and click Parse</li>
                      </ol>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t("pasteCode")}
                  </label>
                  <textarea
                    value={playwrightCode}
                    onChange={(e) => setPlaywrightCode(e.target.value)}
                    placeholder={t("recorderCodePlaceholder")}
                    className="w-full h-32 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono resize-none"
                  />
                </div>

                <Button onClick={parsePlaywrightCode} disabled={!playwrightCode.trim()} className="w-full" variant="outline">
                  {t("parseSteps")}
                </Button>
              </div>
            </div>

            {steps.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  Recorded Steps ({steps.length})
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded"
                    >
                      <span className="text-slate-500 w-5">{index + 1}.</span>
                      <code className="flex-1 font-mono text-slate-700 dark:text-slate-300">
                        {step.action === "goto" && `goto → ${step.url}`}
                        {step.action === "click" && `click → ${step.selector}`}
                        {step.action === "fill" && `fill → ${step.selector} = "${step.value}"`}
                        {step.action === "waitForSelector" && `wait → ${step.selector}`}
                        {step.action === "screenshot" && "screenshot"}
                      </code>
                      <Button
                        variant="ghost"
                        onClick={() => removeStep(step.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Right: Monitor Config */}
          <Card className="p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">2. {t("monitorConfig")}</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t("monitorName")} *
                  </label>
                  <Input
                    placeholder={t("monitorNameExamplePlaceholder")}
                    value={monitorName}
                    onChange={(e) => setMonitorName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t("checkInterval")} ({t("seconds")}) *
                    </label>
                    <Input
                      type="number"
                      min="15"
                      value={interval}
                      onChange={(e) => setInterval(parseInt(e.target.value) || 15)}
                    />
                    {interval < 15 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        Min: 15s
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t("timeout")} ({t("seconds")}) *
                    </label>
                    <Input
                      type="number"
                      min="10"
                      value={timeout}
                      onChange={(e) => setTimeout(parseInt(e.target.value) || 48)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t("description")} ({t("optional")})
                  </label>
                  <textarea
                    placeholder={t("describeMonitor")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t("baseUrl")} ({t("optional")})
                  </label>
                  <Input
                    placeholder={t("recorderUrlPlaceholder")}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">{t("baseUrlHelp")}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t("browserType")}
                    </label>
                    <select
                      value={browser}
                      onChange={(e) => setBrowser(e.target.value)}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    >
                      <option value="chromium">Chromium</option>
                      <option value="firefox">Firefox</option>
                      <option value="webkit">WebKit (Safari)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t("browserMode")}
                    </label>
                    <select
                      value={useLocalBrowser ? "local" : "remote"}
                      onChange={(e) => setUseLocalBrowser(e.target.value === "local")}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    >
                      <option value="remote">{t("remote")} ({t("recommended")})</option>
                      <option value="local">{t("local")}</option>
                    </select>
                  </div>
                </div>

                {notifications && notifications.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {t("notifications")} ({t("optional")})
                    </label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {notifications.map((channel: any) => (
                        <label
                          key={channel.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={notificationIds.includes(channel.id)}
                            onChange={(e) => {
                              setNotificationIds(
                                e.target.checked
                                  ? [...notificationIds, channel.id]
                                  : notificationIds.filter((id) => id !== channel.id)
                              );
                            }}
                            className="h-4 w-4 rounded"
                          />
                          <span className="text-slate-700 dark:text-slate-300">{channel.name}</span>
                          <span className="ml-auto text-xs text-slate-500 capitalize">{channel.type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    onClick={createMonitor}
                    disabled={!monitorName || steps.length === 0}
                    className="w-full"
                  >
                    {t("createMonitorButton")}
                  </Button>
                  
                  {(!monitorName || steps.length === 0) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                      {!monitorName && `${t("monitorName")} required. `}
                      {steps.length === 0 && "Record at least one step."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-md p-3">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 {t("quickTips")}</h3>
              <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
                <li>• {t("recordingTip1")}</li>
                <li>• {t("recordingTip2")}</li>
                <li>• {t("recordingTip3")}</li>
                <li>• {t("recordingTip4")}</li>
                <li>• {t("recordingTip5")}</li>
              </ul>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">⚠️ Important</h3>
              <p className="text-xs text-amber-800 dark:text-amber-400">
                Synthetic monitors require a remote Playwright browser to be configured. Go to Settings → Remote Browsers to add one, or the monitor will show as DOWN.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
