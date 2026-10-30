import { emailHandle } from '../../../shared/domain/audit-link';
import type { AuditActor, AuditFilters } from './audit.models';

export type AuditFilterProblem =
  | { kind: 'unknownKey'; token: string }
  | { kind: 'unknownActor'; value: string }
  | { kind: 'badValue'; key: string; value: string };

export interface ParsedAuditFilter {
  filters: AuditFilters;
  problems: AuditFilterProblem[];
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const ACTION = /^[a-z][a-z_.]*$/;
const TYPE = /^[a-z][a-z_]*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const KEYS: Record<string, keyof AuditFilters | 'actor'> = {
  actor: 'actor',
  org: 'organizationId',
  accion: 'action',
  acción: 'action',
  objeto: 'targetType',
  id: 'targetId',
  desde: 'from',
  hasta: 'to',
};

const localPart = emailHandle;

export const actorHandle = (actor: AuditActor): string => localPart(actor.email) || actor.id;

const findActor = (value: string, actors: readonly AuditActor[]): AuditActor | undefined => {
  const wanted = value.toLowerCase();
  return (
    actors.find((a) => a.id === value || a.email?.toLowerCase() === wanted) ??
    actors.find((a) => localPart(a.email).toLowerCase() === wanted)
  );
};

const dayBound = (day: string, end: boolean): string | null => {
  if (!DAY.test(day)) return null;
  const date = new Date(`${day}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const parseAuditFilter = (
  text: string,
  actors: readonly AuditActor[],
): ParsedAuditFilter => {
  const filters: AuditFilters = {};
  const problems: AuditFilterProblem[] = [];
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    const at = token.indexOf(':');
    const key = at > 0 ? KEYS[token.slice(0, at).toLowerCase()] : undefined;
    const value = at > 0 ? token.slice(at + 1) : '';
    if (!key || !value) {
      problems.push({ kind: 'unknownKey', token });
      continue;
    }
    if (key === 'actor') {
      const actor = findActor(value, actors);
      if (actor) filters.adminId = actor.id;
      else problems.push({ kind: 'unknownActor', value });
      continue;
    }
    const valid =
      key === 'organizationId'
        ? OBJECT_ID.test(value)
        : key === 'action'
          ? ACTION.test(value)
          : key === 'targetType'
            ? TYPE.test(value)
            : key === 'from' || key === 'to'
              ? dayBound(value, key === 'to') !== null
              : value.length <= 80;
    if (!valid) {
      problems.push({ kind: 'badValue', key: token.slice(0, at), value });
      continue;
    }
    filters[key] =
      key === 'from' || key === 'to' ? (dayBound(value, key === 'to') as string) : value;
  }
  return { filters, problems };
};

export const withToken = (text: string, key: string, value: string): string => {
  const others = text
    .trim()
    .split(/\s+/)
    .filter((token) => token && !token.toLowerCase().startsWith(`${key}:`));
  return [...others, `${key}:${value}`].join(' ');
};
