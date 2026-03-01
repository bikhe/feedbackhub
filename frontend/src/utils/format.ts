import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.locale('ru');

export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—';
  return dayjs(date).format('DD.MM.YYYY');
};

export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '—';
  return dayjs(date).format('DD.MM.YYYY HH:mm');
};

export const formatRelative = (date: string | null | undefined): string => {
  if (!date) return '—';
  return dayjs(date).fromNow();
};

export const formatPercent = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};