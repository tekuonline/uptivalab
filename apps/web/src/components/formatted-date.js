import { jsx as _jsx } from "react/jsx-runtime";
import { useTimezone } from "../hooks/use-timezone.js";
/**
 * Component that formats dates according to user's timezone settings
 */
export function FormattedDate({ date, relative = true }) {
    const { formatDate, formatDateTime } = useTimezone();
    return _jsx("span", { children: relative ? formatDateTime(date) : formatDate(date) });
}
