import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { toParams } from '../../../shared/http/query-params';
import type { ConsumptionReport } from './consumption.models';

@Injectable({ providedIn: 'root' })
export class ConsumptionApi {
  private readonly http = inject(HttpClient);

  report(range: { from?: string; to?: string }): Observable<ConsumptionReport> {
    return this.http.get<ConsumptionReport>('/platform/validation-credits/report', {
      params: toParams(range),
    });
  }
}
