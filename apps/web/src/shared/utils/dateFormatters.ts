import { format, parseISO } from 'date-fns';

export function safeFormatDate(
  date: string | undefined,
  formatStr: string,
  fallback = '',
): string {
  if (!date) return fallback;
  try {
    return format(parseISO(date), formatStr);
  } catch {
    return fallback || date;
  }
}

export function formatTime(date: string | undefined): string {
  return safeFormatDate(date, 'p');
}

export function formatDateAndTime(date: string | undefined): string {
  return safeFormatDate(date, 'PPp');
}

export function formatFullDate(date: string | undefined): string {
  return safeFormatDate(date, 'LLLL do yyyy', 'N/A');
}

export function formatFullDateWithTime(date: string | undefined): string {
  return safeFormatDate(date, "LLLL do yyyy 'at' h:mm a", 'N/A');
}
