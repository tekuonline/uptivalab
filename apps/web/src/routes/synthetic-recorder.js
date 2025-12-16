import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export default function SyntheticRecorder() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { t } = useTranslation();
    const [recordingUrl, setRecordingUrl] = useState("");
    const [browser, setBrowser] = useState("chromium");
    const [steps, setSteps] = useState([]);
    const [monitorName, setMonitorName] = useState("");
    const [playwrightCode, setPlaywrightCode] = useState("");
    const [interval, setInterval] = useState(60);
    const [timeout, setTimeout] = useState(48);
    const [showCommand, setShowCommand] = useState("");
    const [notificationIds, setNotificationIds] = useState([]);
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
            const response = await fetch("/api/recorder/codegen", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    url: recordingUrl,
                    browser: browser,
                }),
            });
            const data = await response.json();
            if (data.command) {
                setShowCommand(data.command);
            }
        }
        catch (error) {
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
            const response = await fetch("/api/recorder/parse", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ code: playwrightCode }),
            });
            const data = await response.json();
            if (data.steps && Array.isArray(data.steps)) {
                const newSteps = data.steps.map((step, index) => ({
                    id: `${Date.now()}-${index}`,
                    ...step,
                }));
                setSteps(newSteps);
                setPlaywrightCode("");
                alert(`✓ Parsed ${data.steps.length} steps!`);
            }
        }
        catch (error) {
            console.error("Failed to parse code:", error);
            alert("Failed to parse Playwright code. Make sure you copied the correct code.");
        }
    };
    const removeStep = (id) => {
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
            const response = await fetch("/api/monitors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: monitorName,
                    kind: "synthetic",
                    interval: intervalSeconds * 1000,
                    timeout: timeout * 1000,
                    description: description || undefined,
                    config: {
                        browser: browser,
                        useLocalBrowser: useLocalBrowser,
                        baseUrl: baseUrl || undefined,
                        steps: stepsJSON,
                    },
                    notificationIds: notificationIds.length > 0 ? notificationIds : undefined,
                }),
            });
            if (response.ok) {
                alert("✓ Monitor created successfully!\n\nNote: Make sure you have configured a remote Playwright browser in Settings, or the monitor will fail. See Settings → Remote Browsers.");
                navigate("/");
            }
            else {
                const error = await response.json();
                console.error("Failed to create monitor:", error);
                alert("Failed to create monitor: " + (error.message || "Unknown error"));
            }
        }
        catch (error) {
            console.error("Error creating monitor:", error);
            alert("Error creating monitor: " + (error instanceof Error ? error.message : "Unknown error"));
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-slate-50 dark:bg-slate-950 p-4", children: _jsxs("div", { className: "max-w-5xl mx-auto space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(Button, { variant: "ghost", onClick: () => navigate("/"), children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), t("back")] }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-slate-900 dark:text-white", children: t("syntheticRecorder") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("recordBrowserInteractions") })] })] }) }), _jsxs("div", { className: "grid lg:grid-cols-2 gap-4", children: [_jsxs(Card, { className: "p-4 space-y-4", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-lg font-semibold text-slate-900 dark:text-white mb-3", children: ["1. ", t("recordSteps")] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: t("urlToRecord") }), _jsx(Input, { placeholder: t("recorderUrlPlaceholder"), value: recordingUrl, onChange: (e) => setRecordingUrl(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: t("browser") }), _jsxs("select", { value: browser, onChange: (e) => setBrowser(e.target.value), className: "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm", children: [_jsx("option", { value: "chromium", children: "Chromium" }), _jsx("option", { value: "firefox", children: "Firefox" }), _jsx("option", { value: "webkit", children: "WebKit (Safari)" })] })] }), _jsxs(Button, { onClick: getCodegenCommand, disabled: !recordingUrl, className: "w-full", children: [_jsx(Play, { className: "h-4 w-4 mr-2" }), t("getCommand")] }), showCommand && (_jsxs("div", { className: "bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-3 space-y-2", children: [_jsx("p", { className: "text-xs font-semibold text-slate-700 dark:text-slate-300", children: "Run this in your terminal:" }), _jsx("code", { className: "block text-xs bg-black text-green-400 p-2 rounded overflow-x-auto", children: showCommand }), _jsxs("div", { className: "text-xs text-slate-600 dark:text-slate-400 space-y-1", children: [_jsx("p", { children: "Then:" }), _jsxs("ol", { className: "list-decimal list-inside space-y-0.5 ml-2", children: [_jsx("li", { children: "Browser opens with Playwright Inspector" }), _jsx("li", { children: "Click the record button (red dot)" }), _jsx("li", { children: "Interact with the website" }), _jsx("li", { children: "Copy the code from Inspector" }), _jsx("li", { children: "Paste it below and click Parse" })] })] })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: t("pasteCode") }), _jsx("textarea", { value: playwrightCode, onChange: (e) => setPlaywrightCode(e.target.value), placeholder: t("recorderCodePlaceholder"), className: "w-full h-32 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono resize-none" })] }), _jsx(Button, { onClick: parsePlaywrightCode, disabled: !playwrightCode.trim(), className: "w-full", variant: "outline", children: t("parseSteps") })] })] }), steps.length > 0 && (_jsxs("div", { className: "pt-4 border-t border-slate-200 dark:border-slate-800", children: [_jsxs("h3", { className: "text-sm font-semibold text-slate-900 dark:text-white mb-2", children: ["Recorded Steps (", steps.length, ")"] }), _jsx("div", { className: "space-y-1 max-h-64 overflow-y-auto", children: steps.map((step, index) => (_jsxs("div", { className: "flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded", children: [_jsxs("span", { className: "text-slate-500 w-5", children: [index + 1, "."] }), _jsxs("code", { className: "flex-1 font-mono text-slate-700 dark:text-slate-300", children: [step.action === "goto" && `goto → ${step.url}`, step.action === "click" && `click → ${step.selector}`, step.action === "fill" && `fill → ${step.selector} = "${step.value}"`, step.action === "waitForSelector" && `wait → ${step.selector}`, step.action === "screenshot" && "screenshot"] }), _jsx(Button, { variant: "ghost", onClick: () => removeStep(step.id), className: "h-6 w-6 p-0", children: _jsx(Trash2, { className: "h-3 w-3" }) })] }, step.id))) })] }))] }), _jsxs(Card, { className: "p-4 space-y-4", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-lg font-semibold text-slate-900 dark:text-white mb-3", children: ["2. ", t("monitorConfig")] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: [t("monitorName"), " *"] }), _jsx(Input, { placeholder: t("monitorNameExamplePlaceholder"), value: monitorName, onChange: (e) => setMonitorName(e.target.value) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: [t("checkInterval"), " (", t("seconds"), ") *"] }), _jsx(Input, { type: "number", min: "15", value: interval, onChange: (e) => setInterval(parseInt(e.target.value) || 15) }), interval < 15 && (_jsxs("p", { className: "text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1", children: [_jsx(AlertCircle, { className: "h-3 w-3" }), "Min: 15s"] }))] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: [t("timeout"), " (", t("seconds"), ") *"] }), _jsx(Input, { type: "number", min: "10", value: timeout, onChange: (e) => setTimeout(parseInt(e.target.value) || 48) })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: [t("description"), " (", t("optional"), ")"] }), _jsx("textarea", { placeholder: t("describeMonitor"), value: description, onChange: (e) => setDescription(e.target.value), className: "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none", rows: 2 })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: [t("baseUrl"), " (", t("optional"), ")"] }), _jsx(Input, { placeholder: t("recorderUrlPlaceholder"), value: baseUrl, onChange: (e) => setBaseUrl(e.target.value) }), _jsx("p", { className: "text-xs text-slate-500 mt-1", children: t("baseUrlHelp") })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: t("browserType") }), _jsxs("select", { value: browser, onChange: (e) => setBrowser(e.target.value), className: "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm", children: [_jsx("option", { value: "chromium", children: "Chromium" }), _jsx("option", { value: "firefox", children: "Firefox" }), _jsx("option", { value: "webkit", children: "WebKit (Safari)" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1", children: t("browserMode") }), _jsxs("select", { value: useLocalBrowser ? "local" : "remote", onChange: (e) => setUseLocalBrowser(e.target.value === "local"), className: "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm", children: [_jsxs("option", { value: "remote", children: [t("remote"), " (", t("recommended"), ")"] }), _jsx("option", { value: "local", children: t("local") })] })] })] }), notifications && notifications.length > 0 && (_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2", children: [t("notifications"), " (", t("optional"), ")"] }), _jsx("div", { className: "space-y-2 max-h-32 overflow-y-auto", children: notifications.map((channel) => (_jsxs("label", { className: "flex items-center gap-2 text-sm cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: notificationIds.includes(channel.id), onChange: (e) => {
                                                                            setNotificationIds(e.target.checked
                                                                                ? [...notificationIds, channel.id]
                                                                                : notificationIds.filter((id) => id !== channel.id));
                                                                        }, className: "h-4 w-4 rounded" }), _jsx("span", { className: "text-slate-700 dark:text-slate-300", children: channel.name }), _jsx("span", { className: "ml-auto text-xs text-slate-500 capitalize", children: channel.type })] }, channel.id))) })] })), _jsxs("div", { className: "pt-4 border-t border-slate-200 dark:border-slate-800", children: [_jsx(Button, { onClick: createMonitor, disabled: !monitorName || steps.length === 0, className: "w-full", children: t("createMonitorButton") }), (!monitorName || steps.length === 0) && (_jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-2 text-center", children: [!monitorName && `${t("monitorName")} required. `, steps.length === 0 && "Record at least one step."] }))] })] })] }), _jsxs("div", { className: "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-md p-3", children: [_jsxs("h3", { className: "text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2", children: ["\uD83D\uDCA1 ", t("quickTips")] }), _jsxs("ul", { className: "text-xs text-blue-800 dark:text-blue-400 space-y-1", children: [_jsxs("li", { children: ["\u2022 ", t("recordingTip1")] }), _jsxs("li", { children: ["\u2022 ", t("recordingTip2")] }), _jsxs("li", { children: ["\u2022 ", t("recordingTip3")] }), _jsxs("li", { children: ["\u2022 ", t("recordingTip4")] }), _jsxs("li", { children: ["\u2022 ", t("recordingTip5")] })] })] }), _jsxs("div", { className: "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3", children: [_jsx("h3", { className: "text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1", children: "\u26A0\uFE0F Important" }), _jsx("p", { className: "text-xs text-amber-800 dark:text-amber-400", children: "Synthetic monitors require a remote Playwright browser to be configured. Go to Settings \u2192 Remote Browsers to add one, or the monitor will show as DOWN." })] })] })] })] }) }));
}
