import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { toParams } from '../../../shared/http/query-params';
import type {
  DeliveriesPage,
  DeliveriesQuery,
  DeliveryDetail,
  EndpointsPage,
  EndpointsQuery,
  KeyCounts,
  KeyRow,
  KeysPage,
  KeysQuery,
  OpenDeliveryCounts,
  ReplayResult,
  RetryFilter,
  RetryOutcome,
  RetryPreview,
} from './integrations.models';

const BASE = '/platform/integrations/deliveries';
const RETRIES = '/platform/integrations/delivery-retries';
const KEYS = '/platform/integrations/keys';
const ENDPOINTS = '/platform/integrations/endpoints';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

const REPLAY_ERRORS: Record<string, string> = {
  WEBHOOK_LEGACY_UNAVAILABLE: 'dlv.replay.error.classicOff',
  WEBHOOK_LEGACY_DESTINATION_REMOVED: 'dlv.replay.error.classicRemoved',
  WEBHOOK_ENDPOINT_NOT_FOUND: 'dlv.replay.error.endpointGone',
  WEBHOOK_DELIVERY_NOT_FOUND: 'dlv.replay.error.gone',
  BRIDGE_NO_DISPONIBLE: 'dlv.replay.error.unavailable',
};

export const replayErrorKey = (error: unknown): string => {
  const known = REPLAY_ERRORS[errorCodeOf(error) ?? ''];
  if (known) return known;
  if (errorStatusOf(error) === 403) return 'dlv.replay.error.forbidden';
  return 'dlv.replay.error.failed';
};

const present = (filter: RetryFilter): Record<string, string> =>
  Object.fromEntries(Object.entries(filter).filter(([, value]) => !!value)) as Record<string, string>;

export const actionErrorKey = (error: unknown, prefix: string): string => {
  if (errorStatusOf(error) === 503) return 'dlv.replay.error.unavailable';
  if (errorStatusOf(error) === 403) return `${prefix}.forbidden`;
  if (errorStatusOf(error) === 404) return `${prefix}.gone`;
  return `${prefix}.failed`;
};

export const isBridgeDown = (error: unknown): boolean => errorStatusOf(error) === 503;

@Injectable({ providedIn: 'root' })
export class IntegrationsApi {
  private readonly http = inject(HttpClient);

  deliveries(query: DeliveriesQuery): Observable<DeliveriesPage> {
    return this.http.get<DeliveriesPage>(BASE, { params: toParams({ ...query }), context: silent() });
  }

  summary(organizationId: string | null = null): Observable<OpenDeliveryCounts> {
    return this.http.get<OpenDeliveryCounts>(`${BASE}/summary`, {
      params: toParams({ organizationId }),
      context: silent(),
    });
  }

  detail(id: string): Observable<DeliveryDetail> {
    return this.http.get<DeliveryDetail>(`${BASE}/${id}`, { context: silent() });
  }

  replay(id: string, reason: string): Observable<ReplayResult> {
    return this.http.post<ReplayResult>(`${BASE}/${id}/replay`, { reason }, { context: silent() });
  }

  retryPreview(filter: RetryFilter): Observable<RetryPreview> {
    return this.http.get<RetryPreview>(RETRIES, { params: toParams({ ...filter }), context: silent() });
  }

  retryFailed(filter: RetryFilter, reason: string): Observable<RetryOutcome> {
    return this.http.post<RetryOutcome>(RETRIES, { ...present(filter), reason }, { context: silent() });
  }

  keys(query: KeysQuery): Observable<KeysPage> {
    return this.http.get<KeysPage>(KEYS, { params: toParams({ ...query }), context: silent() });
  }

  keySummary(organizationId: string | null = null): Observable<KeyCounts> {
    return this.http.get<KeyCounts>(`${KEYS}/summary`, {
      params: toParams({ organizationId }),
      context: silent(),
    });
  }

  revokeKey(id: string, reason: string): Observable<KeyRow> {
    return this.http.post<KeyRow>(`${KEYS}/${id}/revoke`, { reason }, { context: silent() });
  }

  endpoints(query: EndpointsQuery): Observable<EndpointsPage> {
    return this.http.get<EndpointsPage>(ENDPOINTS, { params: toParams({ ...query }), context: silent() });
  }

  setEndpointEnabled(id: string, enabled: boolean, reason: string): Observable<unknown> {
    return this.http.patch(`${ENDPOINTS}/${id}`, { enabled, reason }, { context: silent() });
  }
}
