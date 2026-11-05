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
  OpenDeliveryCounts,
  ReplayResult,
} from './integrations.models';

const BASE = '/platform/integrations/deliveries';
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

export const isBridgeDown = (error: unknown): boolean => errorStatusOf(error) === 503;

@Injectable({ providedIn: 'root' })
export class IntegrationsApi {
  private readonly http = inject(HttpClient);

  deliveries(query: DeliveriesQuery): Observable<DeliveriesPage> {
    return this.http.get<DeliveriesPage>(BASE, { params: toParams({ ...query }), context: silent() });
  }

  summary(): Observable<OpenDeliveryCounts> {
    return this.http.get<OpenDeliveryCounts>(`${BASE}/summary`, { context: silent() });
  }

  detail(id: string): Observable<DeliveryDetail> {
    return this.http.get<DeliveryDetail>(`${BASE}/${id}`, { context: silent() });
  }

  replay(id: string, reason: string): Observable<ReplayResult> {
    return this.http.post<ReplayResult>(`${BASE}/${id}/replay`, { reason }, { context: silent() });
  }
}
