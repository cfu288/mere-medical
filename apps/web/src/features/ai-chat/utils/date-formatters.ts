import { differenceInDays, format, parseISO } from 'date-fns';

export function formatTimestampToTime(isoDate: string): string {
  return format(parseISO(isoDate), 'h:mm a');
}

export function formatTimestampToDay(isoDate: string): string {
  const date = parseISO(isoDate);
  const now = new Date();
  const daysDiff = differenceInDays(now, date);

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return format(date, 'EEEE');
  return format(date, 'MMM d, yyyy');
}

export function formatTimestampText(isoDate: string): string {
  const daysDiff = Math.abs(differenceInDays(parseISO(isoDate), new Date()));
  return daysDiff >= 1
    ? formatTimestampToDay(isoDate)
    : formatTimestampToTime(isoDate);
}
