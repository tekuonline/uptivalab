import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Card } from "../components/ui/card.js";
import { ArrowLeft, Trash2, AlertCircle, Play, GripVertical, Edit3 } from "lucide-react";
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
  const [useLocalBrowser, setUseLocalBrowser] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showWaitInput, setShowWaitInput] = useState(false);
  const [customWaitTime, setCustomWaitTime] = useState("1000");
  
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.listNotifications(token),
    enabled: Boolean(token),
  });

  const getCodegenCommand = async () => {
    if (!recordingUrl) {
      alert(t("enterUrlFirst"));
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
      alert(t("failedGenerateCommand"));
    }
  };

  const parsePlaywrightCode = async () => {
    if (!playwrightCode.trim()) {
      alert(t("pasteCodeFirst"));
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
        alert(t("parsedStepsSuccess").replace("{count}", data.steps.length.toString()));
      }
    } catch (error) {
      console.error("Failed to parse code:", error);
      alert(t("failedParseCode"));
    }
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSteps = [...steps];
    const draggedStep = newSteps[draggedIndex];
    newSteps.splice(draggedIndex, 1);
    newSteps.splice(index, 0, draggedStep);
    
    setSteps(newSteps);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addWaitStep = () => {
    const newStep: RecordedStep = {
      id: `manual-${Date.now()}`,
      action: "wait",
      value: customWaitTime
    };
    setSteps(prev => [...prev, newStep]);
    setShowWaitInput(false);
    setCustomWaitTime("1000");
  };

  const editWaitStep = (stepId: string, newValue: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, value: newValue } : step
    ));
  };

  const createMonitor = async () => {
    if (!monitorName || steps.length === 0) {
      alert(t("addMonitorNameAndStep"));
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

      alert(t("monitorCreatedSuccess"));
      navigate("/");
    } catch (error) {
      console.error("Failed to create monitor:", error);
      alert(t("failedCreateMonitor") + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-3 sm:p-4">
      <div className="max-w-5xl mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => navigate("/")} className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("back")}
            </Button>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{t("syntheticRecorder")}</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{t("recordBrowserInteractions")}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Left: Recording */}
          <Card className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-2 sm:mb-3">1. {t("recordSteps")}</h2>
              
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("urlToRecord")}</label>
                  <Input
                    placeholder={t("recorderUrlPlaceholder")}
                    value={recordingUrl}
                    onChange={(e) => setRecordingUrl(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("browser")}</label>
                  <select
                    value={browser}
                    onChange={(e) => setBrowser(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 sm:px-3 py-2 text-xs sm:text-sm"
                  >
                    <option value="chromium">{t("chromium")}</option>
                    <option value="firefox">{t("firefox")}</option>
                    <option value="webkit">{t("webkit")}</option>
                  </select>
                </div>

                <Button onClick={getCodegenCommand} disabled={!recordingUrl} className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  {t("getCommand")}
                </Button>

                {showCommand && (
                  <div className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("runThisInTerminal")}</p>
                    <code className="block text-xs bg-black text-green-400 p-2 rounded overflow-x-auto">
                      {showCommand}
                    </code>
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <p>{t("then")}</p>
                      <ol className="list-decimal list-inside space-y-0.5 ml-2">
                        <li>{t("browserOpensInspector")}</li>
                        <li>{t("clickRecordButton")}</li>
                        <li>{t("interactWithWebsite")}</li>
                        <li>{t("copyCodeFromInspector")}</li>
                        <li>{t("pasteBelowAndParse")}</li>
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
                  {t("recordedSteps")} ({steps.length})
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded cursor-move ${
                        draggedIndex === index ? 'opacity-50' : ''
                      }`}
                    >
                      <GripVertical className="h-3 w-3 text-slate-400 cursor-grab" />
                      <span className="text-slate-500 w-5">{index + 1}.</span>
                      <code className="flex-1 font-mono text-slate-700 dark:text-slate-300">
                        {step.action === "goto" && `${t("gotoAction")} ${step.url}`}
                        {step.action === "click" && `${t("clickAction")} ${step.selector}`}
                        {step.action === "fill" && `${t("fillAction")} ${step.selector} = "${step.value}"`}
                        {step.action === "expect" && `${t("expectAction")} ${step.selector}`}
                        {step.action === "wait" && (
                          <span className="flex items-center gap-1">
                            {t("waitStepPrefix")}
                            <input
                              type="number"
                              value={step.value}
                              onChange={(e) => editWaitStep(step.id, e.target.value)}
                              className="w-16 px-1 py-0 text-xs bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                              min="100"
                              max="30000"
                            />
                            ms
                          </span>
                        )}
                        {step.action === "screenshot" && t("screenshotAction")}
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

            {/* Manual wait button - always visible */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              {showWaitInput ? (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={customWaitTime}
                    onChange={(e) => setCustomWaitTime(e.target.value)}
                    placeholder={t("waitTimeMs")}
                    className="flex-1 text-sm"
                    min="100"
                    max="30000"
                  />
                  <Button onClick={addWaitStep} className="px-3">
                    {t("addButton")}
                  </Button>
                  <Button 
                    onClick={() => setShowWaitInput(false)} 
                    variant="outline" 
                    className="px-3"
                  >
                    {t("cancelButton")}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowWaitInput(true)}
                  variant="outline"
                  className="w-full text-sm py-2"
                >
                  {t("addWaitStep")}
                </Button>
              )}
            </div>
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
                        {t("minInterval")}
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
                      <option value="chromium">{t("chromium")}</option>
                      <option value="firefox">{t("firefox")}</option>
                      <option value="webkit">{t("webkit")}</option>
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
                      <option value="local">{t("localBrowser")}</option>
                      <option value="remote">{t("remoteBrowserRecommended")}</option>
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
                      {steps.length === 0 && t("recordAtLeastOneStep")}
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
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">{t("important")}</h3>
              <p className="text-xs text-amber-800 dark:text-amber-400">
                {t("syntheticMonitorRequiresRemote")}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
