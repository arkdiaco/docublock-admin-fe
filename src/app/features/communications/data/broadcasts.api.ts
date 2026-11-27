import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { toParams } from '../../../shared/http/query-params';
import type { BroadcastDraft, BroadcastView, BroadcastsPage } from './broadcasts.models';

const BASE = '/platform/communications/broadcasts';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

export const publishErrorKey = (error: unknown): string => {
  if (errorCodeOf(error) === 'MENSAJE_VACIO') return 'comm.live.publish.empty';
  if (errorStatusOf(error) === 403) return 'comm.live.publish.forbidden';
  return 'comm.live.publish.failed';
};

export const withdrawErrorKey = (error: unknown): string => {
  const code = errorCodeOf(error);
  if (code === 'MENSAJE_YA_RETIRADO') return 'comm.live.withdraw.already';
  if (code === 'MENSAJE_NO_ENCONTRADO') return 'comm.live.withdraw.missing';
  if (errorStatusOf(error) === 403) return 'comm.live.withdraw.forbidden';
  return 'comm.live.withdraw.failed';
};

@Injectable({ providedIn: 'root' })
export class BroadcastsApi {
  private readonly http = inject(HttpClient);

  list(query: { page: number; limit: number }): Observable<BroadcastsPage> {
    return this.http.get<BroadcastsPage>(BASE, { params: toParams(query), context: silent() });
  }

  publish(draft: BroadcastDraft): Observable<BroadcastView> {
    return this.http.post<BroadcastView>(BASE, draft, { context: silent() });
  }

  withdraw(id: string): Observable<BroadcastView> {
    return this.http.post<BroadcastView>(`${BASE}/${encodeURIComponent(id)}/withdraw`, {}, { context: silent() });
  }
}
