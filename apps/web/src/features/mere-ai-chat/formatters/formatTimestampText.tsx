import { differenceInDays, parseISO } from 'date-fns';
import { formatTimestampToDay } from './formatTimestampToDay';
import { formatTimestampToTime } from './formatTimestampToTime';

export function formatTimestampText(isoDate: string) {
  return Math.abs(differenceInDays(parseISO(isoDate), new Date())) >= 1
    ? `${formatTimestampToDay(isoDate)}`
    : `${formatTimestampToTime(isoDate)}`;
}
