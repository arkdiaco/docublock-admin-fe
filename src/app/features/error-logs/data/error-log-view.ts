import type { Params } from '@angular/router';
import type { OrgState } from '../../../shared/domain/org-state';
import type { FilterPill } from '../../../shared/ui/filter-pills.component';
import {
  ERROR_GROUP_STATES,
  ERROR_SERVICES,
  type ErrorActor,
  type ErrorContext,
  type ErrorGroupAffected,
  type ErrorGroupState,
  type ErrorGroupTotals,
  type ErrorLogFilters,
} from './error-logs.models';

const HOUR = 3_600_000;

export const PERIODS: Readonly<Record<string, number>> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
};

export const ALL = '';

const PARAM = {
  state: 'estado',
  service: 'servicio',
  search: 'buscar',
  period: 'periodo',
  group: 'grupo',
  page: 'pagina',
} as const;

export const GROUP_PARAM = PARAM.group;

const MONGO_ID = /^[a-f\d]{24}$/i;
export const SEARCH_MAX = 200;

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const searchOf = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= SEARCH_MAX ? text : null;
};

export const filtersOf = (params: Params): ErrorLogFilters => {
  const group = params[PARAM.group];
  const page = Number(params[PARAM.page]);
  return {
    state: oneOf(ERROR_GROUP_STATES, params[PARAM.state]),
    service: oneOf(ERROR_SERVICES, params[PARAM.service]),
    search: searchOf(params[PARAM.search]),
    period: oneOf(Object.keys(PERIODS), params[PARAM.period]),
    group: typeof group === 'string' && MONGO_ID.test(group) ? group : null,
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
  };
};

export const queryParamsOf = (filters: ErrorLogFilters): Params => ({
  [PARAM.state]: filters.state,
  [PARAM.service]: filters.service,
  [PARAM.search]: filters.search,
  [PARAM.period]: filters.period,
  [PARAM.group]: filters.group,
  [PARAM.page]: filters.page > 1 ? filters.page : null,
});

export const fromOf = (period: string | null, now: number): string | null => {
  const span = period ? PERIODS[period] : undefined;
  return span ? new Date(now - span).toISOString() : null;
};

export const statePills = (totals: ErrorGroupTotals | null): FilterPill[] => [
  {
    key: ALL,
    labelKey: 'errl.filter.all',
    count: totals ? totals.open + totals.resolved + totals.silenced : undefined,
  },
  {
    key: 'open',
    labelKey: 'errl.state.open',
    count: totals?.open,
    danger: (totals?.open ?? 0) > 0,
  },
  { key: 'resolved', labelKey: 'errl.state.resolved', count: totals?.resolved },
  { key: 'silenced', labelKey: 'errl.state.silenced', count: totals?.silenced },
];

const STATE_TONES: Record<ErrorGroupState, OrgState> = {
  open: 'suspended',
  resolved: 'active',
  silenced: 'closed',
};

export const groupStateOf = (state: ErrorGroupState): OrgState => STATE_TONES[state];

export const groupLabelKeyOf = (state: ErrorGroupState): string => `errl.state.${state}`;

export interface StateAction {
  to: ErrorGroupState;
  labelKey: string;
}

export const stateActionsOf = (state: ErrorGroupState): StateAction[] =>
  state === 'open'
    ? [
        { to: 'resolved', labelKey: 'errl.action.resolve' },
        { to: 'silenced', labelKey: 'errl.action.silence' },
      ]
    : [{ to: 'open', labelKey: 'errl.action.reopen' }];

export const STATE_ERRORS: readonly string[] = [
  'ERROR_GROUP_NOT_FOUND',
  'ERROR_GROUP_SAME_STATE',
  'ERROR_GROUP_CHANGED',
];

const ACTOR_PARTS: readonly (keyof ErrorActor)[] = [
  'organizationId',
  'userId',
  'platformAdminId',
  'integrationKeyId',
  'callerService',
];

export const actorPartsOf = (
  actor: ErrorActor | undefined,
  context?: ErrorContext,
): { key: string; value: string }[] =>
  ACTOR_PARTS.flatMap((key) => {
    const value = actor?.[key];
    const known = key === 'organizationId' && !!context?.organization;
    return value && !known ? [{ key, value }] : [];
  });

export type ContextSection = 'documents' | 'signers' | 'organizations';

export interface ContextLine {
  key: 'document' | 'signer' | 'organization';
  section: ContextSection;
  id: string | null;
  title: string | null;
  detail: string | null;
  nit: string | null;
}

const filled = (value: string | undefined): string | null => value?.trim() || null;

const line = (
  key: ContextLine['key'],
  section: ContextSection,
  id: string | null,
  parts: { title?: string; detail?: string; nit?: string; fallback?: string },
): ContextLine => {
  const detail = filled(parts.detail);
  const nit = filled(parts.nit);
  const title = filled(parts.title) ?? (detail || nit ? null : (filled(parts.fallback) ?? id));
  return { key, section, id, title, detail, nit };
};

export const contextLinesOf = (context: ErrorContext | undefined): ContextLine[] => {
  const lines: ContextLine[] = [];
  const { document, signer, organization } = context ?? {};
  if (document) {
    lines.push(
      line('document', 'documents', document.id, { title: document.code, detail: document.name }),
    );
  }
  if (signer && (signer.id || signer.identityId)) {
    lines.push(
      line('signer', 'signers', signer.id ?? null, {
        title: signer.name,
        detail: signer.identification,
        fallback: signer.identityId,
      }),
    );
  }
  if (organization) {
    lines.push(
      line('organization', 'organizations', organization.id, {
        title: organization.name,
        nit: organization.tributaryNumber,
      }),
    );
  }
  return lines;
};

export const affectedOf = (
  affected: ErrorGroupAffected | undefined,
): { key: string; n: number } | null => {
  if (!affected || affected.documents <= 0) return null;
  const variant = affected.capped ? 'capped' : affected.documents === 1 ? 'one' : 'many';
  return { key: `errl.affected.${variant}`, n: affected.documents };
};

export const prettyJson = (value: unknown): string =>
  value === undefined ? '—' : JSON.stringify(value, null, 2);
