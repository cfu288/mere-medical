import { format, parseISO } from 'date-fns';

export function formatTimestampToDay(isoDate: string) {
  return format(parseISO(isoDate), 'MMM dd');
}
