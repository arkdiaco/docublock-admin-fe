import type { Params } from '@angular/router';
import type {
  SeriesGranularity,
  SignatureChannel,
  SignaturesRequest,
} from './platform-signatures.models';

export const SIGNATURE_PERIODS = [
  'hoy',
  '7-dias',
  '30-dias',
  'este-mes',
  'mes-pasado',
  'este-anio',
  'anio-pasado',
  'personalizado',
] as const;
export type SignaturePeriod = (typeof SIGNATURE_PERIODS)[number];

export const SIGNATURE_CHANNEL_KEYS = ['todos', 'plataforma', 'integracion'] as const;
export type SignatureChannelKey = (typeof SIGNATURE_CHANNEL_KEYS)[number];

const CHANNEL_OF: Record<SignatureChannelKey, SignatureChannel> = {
  todos: 'all',
  plataforma: 'platform',
  integracion: 'integration',
};

export type SignatureRangeIssue = 'RANGO_INVERTIDO' | 'RANGO_MUY_LARGO';

export interface SignatureFilters {
  period: SignaturePeriod;
  from: string | null;
  to: string | null;
  organizationId: string | null;
  channel: SignatureChannelKey;
}

export interface DayRange {
  from?: string;
  to?: string;
}

const PARAM = {
  period: 'periodo',
  from: 'desde',
  to: 'hasta',
  organization: 'organizacion',
  channel: 'canal',
} as const;

const DEFAULT_PERIOD: SignaturePeriod = '30-dias';
const MAX_RANGE_DAYS = 731;
const DAY_MS = 86_400_000;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONGO_ID = /^[a-f\d]{24}$/i;

const dayOf = (value: unknown): string | null =>
  typeof value === 'string' && DAY.test(value) ? value : null;

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00.000Z`);
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const shiftDay = (day: string, days: number): string => isoDay(dayMs(day) + days * DAY_MS);
const daysIn = (from: string, to: string): number =>
  Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1;
const monthStart = (day: string): string => `${day.slice(0, 7)}-01`;

export const signatureFiltersOf = (params: Params): SignatureFilters => {
  const from = dayOf(params[PARAM.from]);
  const to = dayOf(params[PARAM.to]);
  const asked = params[PARAM.period] as SignaturePeriod;
  const period = SIGNATURE_PERIODS.includes(asked)
    ? asked
    : from || to
      ? 'personalizado'
      : DEFAULT_PERIOD;
  const organization = params[PARAM.organization];
  const channel = params[PARAM.channel] as SignatureChannelKey;
  return {
    period,
    from: period === 'personalizado' ? from : null,
    to: period === 'personalizado' ? to : null,
    organizationId:
      typeof organization === 'string' && MONGO_ID.test(organization) ? organization : null,
    channel: SIGNATURE_CHANNEL_KEYS.includes(channel) ? channel : 'todos',
  };
};

export const signatureQueryParamsOf = (filters: SignatureFilters): Params => {
  const custom = filters.period === 'personalizado';
  return {
    [PARAM.period]: filters.period === DEFAULT_PERIOD ? null : filters.period,
    [PARAM.from]: custom ? filters.from : null,
    [PARAM.to]: custom ? filters.to : null,
    [PARAM.organization]: filters.organizationId,
    [PARAM.channel]: filters.channel === 'todos' ? null : filters.channel,
  };
};

export const periodRangeOf = (filters: SignatureFilters, today: string): DayRange => {
  switch (filters.period) {
    case 'hoy':
      return { from: today, to: today };
    case '7-dias':
      return { from: shiftDay(today, -6), to: today };
    case '30-dias':
      return { from: shiftDay(today, -29), to: today };
    case 'este-mes':
      return { from: monthStart(today), to: today };
    case 'mes-pasado': {
      const end = shiftDay(monthStart(today), -1);
      return { from: monthStart(end), to: end };
    }
    case 'este-anio':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'anio-pasado': {
      const year = Number(today.slice(0, 4)) - 1;
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    default:
      return {
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      };
  }
};

export const signatureRangeIssue = (
  filters: SignatureFilters,
  today: string,
): SignatureRangeIssue | null => {
  const { from, to } = periodRangeOf(filters, today);
  if (!from || !to) return null;
  if (from > to) return 'RANGO_INVERTIDO';
  return daysIn(from, to) > MAX_RANGE_DAYS ? 'RANGO_MUY_LARGO' : null;
};

export const signaturesRequestOf = (
  filters: SignatureFilters,
  today: string,
  tz: string,
): SignaturesRequest => ({
  ...periodRangeOf(filters, today),
  tz,
  ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
  channel: CHANNEL_OF[filters.channel],
});

export const changeOf = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

export const todayIn = (now: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const bucketLabelOf = (
  bucket: string,
  granularity: SeriesGranularity,
  locale: string,
  spansYears: boolean,
): string => {
  const [year, month, day] = bucket.split('-').map(Number);
  if (granularity === 'day') return String(day);
  if (granularity === 'week') return `${day}/${month}`;
  const name = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 15)))
    .replace('.', '');
  return spansYears ? `${name} ${String(year).slice(2)}` : name;
};
