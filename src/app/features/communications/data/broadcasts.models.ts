export type BroadcastState = 'active' | 'withdrawn';

export interface BroadcastView {
  id: string;
  title: string;
  message: string;
  state: BroadcastState;
  createdBy: string;
  createdByName?: string;
  createdAt?: string;
  withdrawnBy?: string;
  withdrawnByName?: string;
  withdrawnAt?: string;
}

export interface BroadcastsPage {
  total: number;
  items: BroadcastView[];
}

export interface BroadcastDraft {
  title: string;
  message: string;
}

export const LIVE_VIEW = 'en-vivo';

export const broadcastDraftOf = (title: string, message: string): BroadcastDraft => ({
  title: title.replace(/\s+/g, ' ').trim(),
  message: message
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim(),
});

export const broadcastsPageOf = (page: Partial<BroadcastsPage> | null | undefined): BroadcastsPage => ({
  total: typeof page?.total === 'number' ? page.total : 0,
  items: Array.isArray(page?.items) ? page.items.filter((item) => typeof item?.id === 'string') : [],
});
