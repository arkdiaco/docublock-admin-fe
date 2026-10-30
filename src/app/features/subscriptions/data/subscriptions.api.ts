import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type {
  Option,
  SubscriptionsFilter,
  SubscriptionsPage,
  SubscriptionsQuery,
} from './subscriptions.models';

const paramsOf = (filter: SubscriptionsFilter) =>
  toParams({
    ...filter,
    includeTest: filter.includeTest || undefined,
    includeAutoRenew: filter.includeAutoRenew || undefined,
  });

@Injectable({ providedIn: 'root' })
export class SubscriptionsApi {
  private readonly http = inject(HttpClient);

  list(query: SubscriptionsQuery): Observable<SubscriptionsPage> {
    return this.http.get<SubscriptionsPage>('/platform/subscriptions', { params: paramsOf(query) });
  }

  exportCsv(filter: SubscriptionsFilter): Observable<ExportedFile> {
    return this.http
      .get('/platform/subscriptions/export.csv', {
        params: paramsOf(filter),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(map((response) => exportedFileOf(response, 'suscripciones.csv')));
  }

  plans(): Observable<Option[]> {
    return this.http
      .get<{ code: string; name: string }[]>('/platform/plans', {
        params: toParams({ state: 'all' }),
      })
      .pipe(
        map((plans) =>
          plans.map((plan) => ({ id: plan.code, label: `${plan.name} · ${plan.code}` })),
        ),
      );
  }

  countries(): Observable<Option[]> {
    return this.http
      .get<{ id: string; name: string }[]>('/catalogs/countries')
      .pipe(
        map((countries) => countries.map((country) => ({ id: country.id, label: country.name }))),
      );
  }
}
