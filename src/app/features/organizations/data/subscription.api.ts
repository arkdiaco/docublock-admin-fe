import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import type {
  AssignPlanBody,
  CounterBody,
  PeriodBody,
  PlanResource,
  SubscriptionView,
} from './subscription.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class SubscriptionApi {
  private readonly http = inject(HttpClient);

  get(orgId: string): Observable<SubscriptionView> {
    return this.http.get<SubscriptionView>(`/platform/organizations/${orgId}/subscription`);
  }

  assign(orgId: string, body: AssignPlanBody): Observable<SubscriptionView> {
    return this.http.post<SubscriptionView>(
      `/platform/organizations/${orgId}/subscription/assign`,
      body,
      { context: silent() },
    );
  }

  setPeriod(orgId: string, body: PeriodBody): Observable<SubscriptionView> {
    return this.http.post<SubscriptionView>(
      `/platform/organizations/${orgId}/subscription/period`,
      body,
      { context: silent() },
    );
  }

  setCounter(
    orgId: string,
    resource: PlanResource,
    body: CounterBody,
  ): Observable<SubscriptionView> {
    return this.http.patch<SubscriptionView>(
      `/platform/organizations/${orgId}/subscription/counters/${resource}`,
      body,
      {
        context: silent(),
      },
    );
  }

  expire(orgId: string, reason: string): Observable<SubscriptionView> {
    return this.http.post<SubscriptionView>(
      `/platform/organizations/${orgId}/subscription/expire`,
      { reason },
      { context: silent() },
    );
  }
}
