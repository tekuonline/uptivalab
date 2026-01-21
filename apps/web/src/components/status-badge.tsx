import type { StatusState } from "@uptivalab/shared";
import { twMerge } from "tailwind-merge";
import { useTranslation } from "../hooks/use-translation.js";

const colorMap: Record<StatusState, string> = {
  up: "bg-success/20 text-success",
  down: "bg-danger/20 text-danger",
  pending: "bg-warning/20 text-warning",
  paused: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
};

export const StatusBadge = ({ status }: { status: StatusState }) => {
  const { t } = useTranslation();

  const getStatusText = (status: StatusState) => {
    switch (status) {
      case "up":
        return t("statusUp");
      case "down":
        return t("statusDown");
      case "pending":
        return t("statusPending");
      case "paused":
        return t("statusPaused");
    }
  };

  return (
    <span className={twMerge("inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold", colorMap[status])}>
      {getStatusText(status)}
    </span>
  );
};
