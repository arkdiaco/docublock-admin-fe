import type { OrgState } from '../../../shared/domain/org-state';
import type { PlanRow, PlanStripeIssue, PlanStripeStatus, PlanStripeSync } from './plans.models';

export interface StripeCell {
  state: OrgState;
  labelKey: string;
  issues: PlanStripeIssue[];
}

export interface StripeSyncResult {
  code: string;
  name: string;
  ok: boolean;
  message: string;
}

const CHECKED: Record<PlanStripeStatus, OrgState> = {
  synced: 'active',
  pending: 'warning',
  drifted: 'suspended',
  not_applicable: 'closed',
  unknown: 'warning',
};

export const KNOWN_ISSUES: readonly string[] = [
  'STRIPE_PRECIO_NO_EXISTE',
  'STRIPE_PRECIO_INACTIVO',
  'STRIPE_INTERVALO_DISTINTO',
  'STRIPE_MONEDA_DISTINTA',
  'STRIPE_MONTO_DISTINTO',
];

export const stripeCellOf = (
  row: Pick<PlanRow, 'state' | 'stripeReady'>,
  checked: PlanStripeSync | undefined,
): StripeCell => {
  if (checked && row.state === 'ACTIVE') {
    return {
      state: CHECKED[checked.status],
      labelKey: `plans.sync.status.${checked.status}`,
      issues: checked.issues,
    };
  }
  if (row.stripeReady === null) {
    return { state: 'closed', labelKey: 'plans.stripe.na', issues: [] };
  }
  return row.stripeReady
    ? { state: 'active', labelKey: 'plans.sync.status.linked', issues: [] }
    : { state: 'warning', labelKey: 'plans.stripe.pending', issues: [] };
};

export const issueKeyOf = (issue: PlanStripeIssue): string =>
  KNOWN_ISSUES.includes(issue.code) ? `plans.sync.issue.${issue.code}` : 'plans.sync.issue.other';

export const pendingOf = (rows: readonly PlanStripeSync[]): PlanStripeSync[] =>
  rows.filter((row) => row.status === 'pending');

export const syncCounts = (
  rows: readonly PlanStripeSync[],
): Record<PlanStripeStatus, number> => {
  const counts: Record<PlanStripeStatus, number> = {
    synced: 0,
    pending: 0,
    drifted: 0,
    not_applicable: 0,
    unknown: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
};
