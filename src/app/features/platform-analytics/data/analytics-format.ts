import { formatNumber } from '@angular/common';
import type { StatTrend } from '../../../shared/ui/stat-band.component';
import { changeOf } from './signature-filters';

export interface Change {
  percent: number;
  tone: 'up' | 'down' | 'flat';
}

export const toneOfChange = (
  current: number,
  previous: number,
  lowerIsBetter = false,
): Change | null => {
  const percent = changeOf(current, previous);
  if (percent === null) return null;
  const better = lowerIsBetter ? percent < 0 : percent > 0;
  const worse = lowerIsBetter ? percent > 0 : percent < 0;
  return { percent, tone: better ? 'up' : worse ? 'down' : 'flat' };
};

export const statTrendOf = (
  current: number,
  previous: number,
  locale: string,
  lowerIsBetter = false,
): StatTrend | undefined => {
  const change = toneOfChange(current, previous, lowerIsBetter);
  if (!change) return undefined;
  const sign = change.percent > 0 ? '+' : change.percent < 0 ? '−' : '';
  return {
    label: `${sign}${formatNumber(Math.abs(change.percent), locale, '1.0-0')} %`,
    tone: change.tone,
  };
};

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
}

const MINUTE_MS = 60_000;

export const durationPartsOf = (ms: number): DurationParts => {
  const minutes = Math.max(0, Math.round(ms / MINUTE_MS));
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
  };
};

export const durationKeyOf = (parts: DurationParts): string => {
  if (parts.days > 0) return 'pan.duration.daysHours';
  if (parts.hours > 0) return 'pan.duration.hoursMinutes';
  return 'pan.duration.minutes';
};
