import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { PaymentLogDetail, PaymentLogReport, PaymentLogsQuery } from './payment-logs.models';

const BASE = '/platform/payment-logs';

@Injectable({ providedIn: 'root' })
export class PaymentLogsApi {
  private readonly http = inject(HttpClient);

  list(query: PaymentLogsQuery): Observable<PaymentLogReport> {
    return this.http.get<PaymentLogReport>(BASE, {
      params: toParams({ ...query }),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }

  detail(id: string): Observable<PaymentLogDetail> {
    return this.http.get<PaymentLogDetail>(`${BASE}/${encodeURIComponent(id)}`, {
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }
}
