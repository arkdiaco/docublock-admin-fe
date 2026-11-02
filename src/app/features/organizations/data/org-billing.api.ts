import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { toParams } from '../../../shared/http/query-params';
import type { OrgBillingPage, OrgInvoiceRow, OrgTransactionRow } from './org-billing.models';

@Injectable({ providedIn: 'root' })
export class OrgBillingApi {
  private readonly http = inject(HttpClient);

  transactions(
    organizationId: string,
    limit: number,
  ): Observable<OrgBillingPage<OrgTransactionRow>> {
    return this.http.get<OrgBillingPage<OrgTransactionRow>>('/platform/transactions', {
      params: toParams({ organizationId, page: 1, limit }),
    });
  }

  invoices(organizationId: string, limit: number): Observable<OrgBillingPage<OrgInvoiceRow>> {
    return this.http.get<OrgBillingPage<OrgInvoiceRow>>('/platform/invoices', {
      params: toParams({ organizationId, page: 1, limit }),
    });
  }
}
