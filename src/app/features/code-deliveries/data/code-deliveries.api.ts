import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { CodeDeliveriesQuery, CodeDeliveryReport } from './code-deliveries.models';

const BASE = '/platform/code-deliveries';

@Injectable({ providedIn: 'root' })
export class CodeDeliveriesApi {
  private readonly http = inject(HttpClient);

  list(query: CodeDeliveriesQuery): Observable<CodeDeliveryReport> {
    return this.http.get<CodeDeliveryReport>(BASE, {
      params: toParams({ ...query }),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }
}
