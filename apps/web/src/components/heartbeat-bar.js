import { jsx as _jsx } from "react/jsx-runtime";
import { useSettings } from "../providers/settings-context.js";
export const HeartbeatBar = ({ checks, className = "" }) => {
    const { settings } = useSettings();
    const theme = settings.heartbeatBarTheme || "normal";
    // Limit to last 50 checks for display
    const displayChecks = checks.slice(-50);
    // Reverse the array if bottom-up theme
    const orderedChecks = theme === "bottom-up" ? [...displayChecks].reverse() : displayChecks;
    const getStatusColor = (status) => {
        switch (status) {
            case "up":
                return "bg-green-500";
            case "down":
                return "bg-red-500";
            case "pending":
                return "bg-yellow-500";
            default:
                return "bg-slate-500";
        }
    };
    return (_jsx("div", { className: `flex items-center gap-0.5 ${className}`, children: orderedChecks.map((check, index) => (_jsx("div", { className: `h-8 w-1 rounded-sm ${getStatusColor(check.status)} transition-all hover:h-10`, title: `${check.status} - ${new Date(check.timestamp).toLocaleString()}` }, `${check.timestamp}-${index}`))) }));
};
