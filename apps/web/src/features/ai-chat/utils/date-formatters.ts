import { differenceInDays, format } from 'date-fns';

export function formatTimestampText(date: Date): string {
  const daysDiff = differenceInDays(new Date(), date);
  if (Math.abs(daysDiff) < 1) return format(date, 'h:mm a');
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return format(date, 'EEEE');
  return format(date, 'MMM d, yyyy');
}
