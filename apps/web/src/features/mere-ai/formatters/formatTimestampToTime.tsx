import { format, parseISO } from 'date-fns';

export function formatTimestampToTime(isoDate: string) {
  return format(parseISO(isoDate), 'p');
}
