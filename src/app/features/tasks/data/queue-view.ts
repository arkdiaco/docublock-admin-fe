import type { FilterPill } from '../../../shared/ui/filter-pills.component';
import { QUEUE_KEYS, QUEUE_STATES, type QueueCounts, type QueueKey } from './tasks.models';

const KNOWN_KINDS = new Set([
  'DEFAULT_DIRECTORY_AND_TEMPLATE',
  'LEDGER_CONTRACT',
  'API_KEY',
  'email',
  'whatsapp',
  'sms',
  'push',
]);

const WITH_RETRIES = new Set<QueueKey>(['closing', 'provisioning']);
const WITHOUT_ORGANIZATION = new Set<QueueKey>(['campaigns']);
const WITHOUT_ERROR = new Set<QueueKey>(['campaigns', 'seals']);

export const isQueueKey = (value: string): value is QueueKey => (QUEUE_KEYS as readonly string[]).includes(value);

export const hasRetries = (queue: QueueKey): boolean => WITH_RETRIES.has(queue);

export const hasOrganization = (queue: QueueKey): boolean => !WITHOUT_ORGANIZATION.has(queue);

export const hasError = (queue: QueueKey): boolean => !WITHOUT_ERROR.has(queue);

export const kindKeyOf = (kind: string): string | null => (KNOWN_KINDS.has(kind) ? `task.kind.${kind}` : null);

export const statePills = (counts: QueueCounts): FilterPill[] =>
  QUEUE_STATES.flatMap((state) => {
    const count = counts[state];
    if (count === null) return [];
    return [
      {
        key: state,
        labelKey: `task.state.${state}`,
        count,
        ...(state === 'failed' && count > 0 ? { danger: true } : {}),
      },
    ];
  });
