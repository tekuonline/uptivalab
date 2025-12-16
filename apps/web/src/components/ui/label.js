import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
const Label = React.forwardRef(({ className = "", ...props }, ref) => {
    return (_jsx("label", { ref: ref, className: `mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300 ${className}`, ...props }));
});
Label.displayName = "Label";
export { Label };
