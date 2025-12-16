import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
const Input = React.forwardRef(({ className = "", type, ...props }, ref) => {
    return (_jsx("input", { type: type, className: `h-[46px] w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${className}`, ref: ref, ...props }));
});
Input.displayName = "Input";
export { Input };
