import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type {
  CountryOption,
  CreatePlanBody,
  LegacyPlanChoice,
  PlanDetail,
  PlanQuery,
  PlanRow,
  StripeLinkBody,
  VersionedPlan,
  VersionPlanBody,
} from './plans.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class PlansApi {
  private readonly http = inject(HttpClient);

  list(query: PlanQuery): Observable<PlanRow[]> {
    return this.http.get<PlanRow[]>('/platform/plans', { params: toParams({ ...query }) });
  }

  detail(code: string): Observable<PlanDetail> {
    return this.http.get<PlanDetail>(`/platform/plans/${encodeURIComponent(code)}`, {
      context: silent(),
    });
  }

  create(body: CreatePlanBody): Observable<PlanDetail> {
    return this.http.post<PlanDetail>('/platform/plans', body, { context: silent() });
  }

  version(code: string, body: VersionPlanBody): Observable<VersionedPlan> {
    return this.http.post<VersionedPlan>(
      `/platform/plans/${encodeURIComponent(code)}/versions`,
      body,
      {
        context: silent(),
      },
    );
  }

  setVisible(code: string, visible: boolean, reason: string): Observable<PlanDetail> {
    return this.http.patch<PlanDetail>(
      `/platform/plans/${encodeURIComponent(code)}/visibility`,
      { visible, reason },
      { context: silent() },
    );
  }

  retire(code: string, reason: string): Observable<PlanDetail> {
    return this.http.post<PlanDetail>(
      `/platform/plans/${encodeURIComponent(code)}/retire`,
      { reason },
      { context: silent() },
    );
  }

  reactivate(code: string, reason: string): Observable<PlanDetail> {
    return this.http.post<PlanDetail>(
      `/platform/plans/${encodeURIComponent(code)}/reactivate`,
      { reason },
      { context: silent() },
    );
  }

  linkStripe(code: string, body: StripeLinkBody): Observable<PlanDetail> {
    return this.http.put<PlanDetail>(`/platform/plans/${encodeURIComponent(code)}/stripe`, body, {
      context: silent(),
    });
  }

  legacyPlans(): Observable<LegacyPlanChoice[]> {
    return this.http.get<LegacyPlanChoice[]>('/platform/plans/legacy');
  }

  linkLegacy(code: string, legacyPlanId: string | null, reason: string): Observable<PlanDetail> {
    return this.http.put<PlanDetail>(
      `/platform/plans/${encodeURIComponent(code)}/legacy`,
      { legacyPlanId, reason },
      { context: silent() },
    );
  }

  countries(): Observable<CountryOption[]> {
    return this.http.get<CountryOption[]>('/catalogs/countries');
  }
}
