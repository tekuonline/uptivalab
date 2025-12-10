import { jsx as _jsx } from "react/jsx-runtime";
import { twMerge } from "tailwind-merge";
export const Card = ({ children, className, ...props }) => (_jsx("div", { className: twMerge("glass-panel rounded-2xl p-6", className), ...props, children: children }));
