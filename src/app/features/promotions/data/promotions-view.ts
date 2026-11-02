import type { FilterPill } from '../../../shared/ui/filter-pills.component';
import type { PromoCode } from './promotions.models';

export type CodeState = 'available' | 'inactive' | 'expired' | 'exhausted';

export const CODE_FAMILY: Record<CodeState, string> = {
  available: 'active',
  inactive: 'closed',
  expired: 'warning',
  exhausted: 'suspended',
};

export const codeStateOf = (
  code: Pick<PromoCode, 'active' | 'expiresAt' | 'remaining'>,
  now: Date,
): CodeState => {
  if (!code.active) return 'inactive';
  if (code.expiresAt && new Date(code.expiresAt).getTime() <= now.getTime()) return 'expired';
  return code.remaining <= 0 ? 'exhausted' : 'available';
};

export type ActiveView = 'all' | 'active' | 'inactive';

export const activeViews = (prefix: string): readonly FilterPill[] => [
  { key: 'all', labelKey: `${prefix}.view.all` },
  { key: 'active', labelKey: `${prefix}.view.active` },
  { key: 'inactive', labelKey: `${prefix}.view.inactive` },
];

export const activeParamOf = (view: string): boolean | undefined =>
  view === 'all' ? undefined : view === 'active';

export const CODE_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_QUANTITY = 1_000_000;

const pad = (value: number): string => String(value).padStart(2, '0');

export const dayOf = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const dayInputOf = (iso?: string | null): string => (iso ? dayOf(new Date(iso)) : '');

export const startOfDayIso = (day: string): string => new Date(`${day}T00:00:00`).toISOString();

export const endOfDayIso = (day: string): string => new Date(`${day}T23:59:59`).toISOString();

export const firstOfMonth = (now: Date): string =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

export const isWhole = (value: string, min: number, max: number): boolean => {
  const parsed = Number(value);
  return /^\d+$/.test(value.trim()) && parsed >= min && parsed <= max;
};

export const PROMO_ERRORS: readonly string[] = [
  'CODIGO_EN_USO',
  'CANTIDAD_BAJO_CANJES',
  'CODIGO_NO_ENCONTRADO',
  'PAIS_NO_ENCONTRADO',
  'REFERIDO_EMAIL_EN_USO',
  'REFERIDO_NO_ENCONTRADO',
  'CODIGO_CON_DUENO',
  'CODIGO_REQUERIDO',
];
