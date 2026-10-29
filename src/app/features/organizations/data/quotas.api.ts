import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type {
  AssignQuotaBody,
  QuotaHistoryPage,
  QuotaTree,
  TransferQuotaBody,
} from './quotas.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class QuotasApi {
  private readonly http = inject(HttpClient);

  tree(orgId: string): Observable<QuotaTree> {
    return this.http.get<QuotaTree>(`/platform/organizations/${orgId}/quotas/tree`);
  }

  history(orgId: string, page: number, limit: number): Observable<QuotaHistoryPage> {
    return this.http.get<QuotaHistoryPage>(`/platform/organizations/${orgId}/quotas/history`, {
      params: toParams({ page, limit }),
    });
  }

  assign(orgId: string, body: AssignQuotaBody): Observable<unknown> {
    return this.http.post(`/platform/organizations/${orgId}/quotas/assign`, body, {
      context: silent(),
    });
  }

  transfer(orgId: string, body: TransferQuotaBody): Observable<unknown> {
    return this.http.post(`/platform/organizations/${orgId}/quotas/transfer`, body, {
      context: silent(),
    });
  }

  reset(orgId: string, reason: string): Observable<{ consumedBefore: number }> {
    return this.http.post<{ consumedBefore: number }>(
      `/platform/organizations/${orgId}/quotas/reset`,
      { reason },
      { context: silent() },
    );
  }
}
