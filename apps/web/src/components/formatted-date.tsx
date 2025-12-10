import { useTimezone } from "../hooks/use-timezone.js";

interface FormattedDateProps {
  date: Date | string;
  relative?: boolean;
}

/**
 * Component that formats dates according to user's timezone settings
 */
export function FormattedDate({ date, relative = true }: FormattedDateProps) {
  const { formatDate, formatDateTime } = useTimezone();
  
  return <span>{relative ? formatDateTime(date) : formatDate(date)}</span>;
}
