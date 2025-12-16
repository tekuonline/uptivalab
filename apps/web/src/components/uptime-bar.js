import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from "react";
export const UptimeBar = ({ checks, hours = 24 }) => {
    const segments = useMemo(() => {
        // Filter checks from the last X hours
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
        const recentChecks = checks.filter(check => {
            const checkTime = new Date(check.checkedAt);
            return checkTime >= cutoffTime;
        });
        // Reverse to show oldest to newest (left to right)
        return recentChecks.reverse().map((check, index) => ({
            key: `${check.checkedAt}-${index}`,
            status: check.status,
            checkedAt: check.checkedAt,
        }));
    }, [checks, hours]);
    if (segments.length === 0) {
        return (_jsx("div", { className: "h-7 w-full rounded flex items-center justify-center bg-slate-800/50", children: _jsx("span", { className: "text-xs text-slate-500", children: "No data" }) }));
    }
    return (_jsx("div", { className: "flex h-7 w-full gap-[1px] rounded overflow-hidden", children: segments.map((segment) => (_jsx("div", { className: `flex-1 transition-opacity hover:opacity-80 ${segment.status === "up"
                ? "bg-green-500"
                : segment.status === "down"
                    ? "bg-red-500"
                    : "bg-gray-500"}`, title: `${segment.status === "up" ? "✓ Up" : segment.status === "down" ? "✗ Down" : "● Pending"} - ${new Date(segment.checkedAt).toLocaleString()}` }, segment.key))) }));
};
