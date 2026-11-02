import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { HistoryEntry, PageOf, PortfolioOrg, Reseller } from './resellers.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);
const BASE = '/platform/resellers';

export const RESELLER_ERRORS: readonly string[] = [
  'RESELLER_CON_CARTERA',
  'RESELLER_PROPIO',
  'NO_ES_RESELLER',
  'ORGANIZACION_NO_ENCONTRADA',
];

@Injectable({ providedIn: 'root' })
export class ResellersApi {
  private readonly http = inject(HttpClient);

  list(query: { search?: string; page: number; limit: number }): Observable<PageOf<Reseller>> {
    return this.http.get<PageOf<Reseller>>(BASE, { params: toParams(query) });
  }

  get(id: string): Observable<Reseller> {
    return this.http.get<Reseller>(`${BASE}/${id}`, { context: silent() });
  }

  setFlag(id: string, isReseller: boolean): Observable<Reseller> {
    return this.http.put<Reseller>(`${BASE}/${id}`, { isReseller }, { context: silent() });
  }

  portfolio(
    id: string,
    query: { search?: string; active?: boolean; page: number; limit: number },
  ): Observable<PageOf<PortfolioOrg>> {
    return this.http.get<PageOf<PortfolioOrg>>(`${BASE}/${id}/portfolio`, {
      params: toParams(query),
    });
  }

  history(resellerId: string, page: number, limit: number): Observable<PageOf<HistoryEntry>> {
    return this.http.get<PageOf<HistoryEntry>>(`${BASE}/history`, {
      params: toParams({ resellerId, page, limit }),
    });
  }

  assign(organizationId: string, resellerId: string | null): Observable<unknown> {
    return this.http.put(
      `/platform/organizations/${organizationId}/reseller`,
      { resellerId },
      { context: silent() },
    );
  }
}
