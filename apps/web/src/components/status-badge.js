import { jsx as _jsx } from "react/jsx-runtime";
import { twMerge } from "tailwind-merge";
const colorMap = {
    up: "bg-success/20 text-success",
    down: "bg-danger/20 text-danger",
    pending: "bg-warning/20 text-warning",
};
export const StatusBadge = ({ status }) => (_jsx("span", { className: twMerge("rounded-full px-3 py-1 text-xs font-semibold", colorMap[status]), children: status.toUpperCase() }));
