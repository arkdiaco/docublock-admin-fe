import type { Params } from '@angular/router';
import type { ActionRowTone } from '../../../shared/ui/action-row.component';
import type { DashboardActionGroup, DashboardActionKind, MonthRevenue } from './dashboard.models';

export const SHOWN_KINDS: readonly DashboardActionKind[] = [
  'QUOTA_EXHAUSTED',
  'SUBSCRIPTION_EXPIRING',
  'QUOTA_WARNING',
];
export const ACTION_LIMIT = 5;

export interface ActionRowView {
  key: string;
  tone: ActionRowTone;
  reference: string;
  subject: string;
  textKey: string;
  textParams: Record<string, string | number>;
  ctaKey: string;
  link: string[];
  query: Params;
}

const percent = (used: number, limit: number): number => Math.floor((used / limit) * 100);

const expiringKey = (days: number): string => {
  if (days <= 0) return 'overview.action.expiringToday';
  if (days === 1) return 'overview.action.expiringTomorrow';
  return 'overview.action.expiring';
};

const rowsOf = (group: DashboardActionGroup, orgsPath: string): ActionRowView[] => {
  switch (group.kind) {
    case 'QUOTA_EXHAUSTED':
    case 'QUOTA_WARNING':
      return group.items.map((item) => ({
        key: `${group.kind}:${item.organization.id}`,
        tone: group.kind === 'QUOTA_EXHAUSTED' ? 'bad' : 'warn',
        reference: item.organization.tributaryNumber,
        subject: item.organization.businessName,
        textKey:
          group.kind === 'QUOTA_EXHAUSTED'
            ? 'overview.action.quotaExhausted'
            : 'overview.action.quotaWarning',
        textParams: { used: item.used, limit: item.limit, pct: percent(item.used, item.limit) },
        ctaKey: 'overview.cta.review',
        link: [orgsPath, item.organization.id],
        query: { tab: 'quotas' },
      }));
    case 'SUBSCRIPTION_EXPIRING':
      return group.items.map((item) => ({
        key: `${group.kind}:${item.organization.id}`,
        tone: 'warn',
        reference: item.organization.tributaryNumber,
        subject: item.organization.businessName,
        textKey: expiringKey(item.daysLeft),
        textParams: { n: item.daysLeft },
        ctaKey: 'overview.cta.review',
        link: [orgsPath, item.organization.id],
        query: { tab: 'subscription' },
      }));
    default:
      return [];
  }
};

export const actionRowsOf = (
  groups: readonly DashboardActionGroup[],
  orgsPath: string,
): { total: number; rows: ActionRowView[] } => {
  const shown = groups.filter((group) => SHOWN_KINDS.includes(group.kind));
  return {
    total: shown.reduce((sum, group) => sum + group.total, 0),
    rows: shown.flatMap((group) => rowsOf(group, orgsPath)).slice(0, ACTION_LIMIT),
  };
};

export type DeltaTone = 'plain' | 'good' | 'warn';

export interface RevenueView {
  value: string;
  deltaKey: string;
  deltaParams: Record<string, string | number>;
  tone: DeltaTone;
  others: number;
}

export const revenueViewOf = (
  revenue: MonthRevenue,
  format: (amount: number, currency: string) => string,
  previousMonth: string,
): RevenueView => {
  if (!revenue.currency) {
    return {
      value: '—',
      deltaKey: 'overview.revenueNone',
      deltaParams: {},
      tone: 'plain',
      others: 0,
    };
  }
  const value = format(revenue.gross, revenue.currency);
  if (revenue.previousGross === 0) {
    return {
      value,
      deltaKey: 'overview.revenueNoPrevious',
      deltaParams: { month: previousMonth },
      tone: 'plain',
      others: revenue.otherCurrencies,
    };
  }
  const diff = revenue.gross - revenue.previousGross;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
  return {
    value,
    deltaKey: 'overview.revenueDelta',
    deltaParams: {
      diff: `${sign}${format(Math.abs(diff), revenue.currency)}`,
      month: previousMonth,
    },
    tone: diff > 0 ? 'good' : diff < 0 ? 'warn' : 'plain',
    others: revenue.otherCurrencies,
  };
};

export const eventRef = (id: string): string =>
  id.length > 8 ? `evt ${id.slice(0, 4)}…${id.slice(-4)}` : `evt ${id}`;
