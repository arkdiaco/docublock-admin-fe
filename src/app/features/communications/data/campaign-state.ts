import type { CampaignView } from './communications.models';

export const HISTORY_VIEW = 'historial';

export interface CampaignStateView {
  state: 'active' | 'trial' | 'warning';
  labelKey: string;
}

export const campaignStateOf = (campaign: CampaignView): CampaignStateView => {
  if (campaign.state === 'queued') return { state: 'trial', labelKey: 'comm.state.queued' };
  if (campaign.state === 'sending') return { state: 'trial', labelKey: 'comm.state.sending' };
  return campaign.counts.failed > 0
    ? { state: 'warning', labelKey: 'comm.state.finishedWithFailures' }
    : { state: 'active', labelKey: 'comm.state.finished' };
};
