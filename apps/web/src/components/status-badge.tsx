import type { StatusState } from "@uptivalab/shared";
import { twMerge } from "tailwind-merge";

const colorMap: Record<StatusState, string> = {
  up: "bg-success/20 text-success",
  down: "bg-danger/20 text-danger",
  pending: "bg-warning/20 text-warning",
  paused: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
};

export const StatusBadge = ({ status }: { status: StatusState }) => (
  <span className={twMerge("inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold", colorMap[status])}>{status.toUpperCase()}</span>
);
