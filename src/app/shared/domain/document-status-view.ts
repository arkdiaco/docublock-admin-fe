import type { OrgState } from './org-state';

export interface StatusView {
  family: OrgState;
  labelKey: string;
}

export interface DocumentStatusParts {
  state: number;
  progress: number;
  label?: string;
}

export const statusViewOf = (status: DocumentStatusParts): StatusView => {
  if (status.state === 4) return { family: 'suspended', labelKey: 'docs.status.cancelled' };
  if (status.state === 5) return { family: 'closed', labelKey: 'docs.status.lapsed' };
  if (status.state === 1) return { family: 'closed', labelKey: 'docs.status.archived' };
  switch (status.progress) {
    case 3:
      return { family: 'active', labelKey: 'docs.status.signed' };
    case 2:
      return { family: 'warning', labelKey: 'docs.status.partial' };
    case 0:
      return { family: 'suspended', labelKey: 'docs.status.rejected' };
    default:
      return { family: 'trial', labelKey: 'docs.status.pending' };
  }
};
