import { useSettings } from "../providers/settings-context.js";

/**
 * Hook to get timezone-aware date formatting functions
 */
export function useTimezone() {
  const { settings } = useSettings();
  const timezone = settings.displayTimezone || "UTC";
  const showElapsed = settings.showElapsedTime !== false; // default true

  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    try {
      return dateObj.toLocaleString("en-US", { 
        timeZone: timezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateObj.toLocaleString();
    }
  };

  const formatRelativeTime = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    
    return formatDate(dateObj);
  };

  const formatDateTime = (date: Date | string): string => {
    if (showElapsed) {
      return formatRelativeTime(date);
    }
    return formatDate(date);
  };

  return {
    timezone,
    showElapsed,
    formatDate,
    formatRelativeTime,
    formatDateTime,
  };
}
