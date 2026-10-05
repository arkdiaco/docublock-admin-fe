import type { PlatformOrgState } from './organizations.models';

export interface OrgStateView {
  family: 'active' | 'warning' | 'suspended' | 'closed';
  labelKey: string;
}

const VIEWS: Record<PlatformOrgState, OrgStateView> = {
  active: { family: 'active', labelKey: 'orgs.state.active' },
  suspended: { family: 'suspended', labelKey: 'orgs.state.suspended' },
  expired: { family: 'warning', labelKey: 'orgs.state.expired' },
  no_subscription: { family: 'closed', labelKey: 'orgs.state.no_subscription' },
};

export const orgStateView = (state: PlatformOrgState): OrgStateView => VIEWS[state];
