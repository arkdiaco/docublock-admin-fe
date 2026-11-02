import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type {
  CountryOption,
  CreatePromoBody,
  CreateReferralBody,
  ListQuery,
  PageOf,
  PromoCode,
  PromoReport,
  Redemption,
  Referral,
  ReportRange,
  UpdatePromoBody,
  UpdateReferralBody,
} from './promotions.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);
const CODES = '/platform/promotional-codes';
const REFERRALS = '/platform/referrals';

export type ReportOwner = 'code' | 'referral';

@Injectable({ providedIn: 'root' })
export class PromotionsApi {
  private readonly http = inject(HttpClient);

  codes(query: ListQuery): Observable<PageOf<PromoCode>> {
    return this.http.get<PageOf<PromoCode>>(CODES, { params: toParams(query) });
  }

  code(id: string): Observable<PromoCode> {
    return this.http.get<PromoCode>(`${CODES}/${id}`, { context: silent() });
  }

  createCode(body: CreatePromoBody): Observable<PromoCode> {
    return this.http.post<PromoCode>(CODES, body, { context: silent() });
  }

  updateCode(id: string, body: UpdatePromoBody): Observable<PromoCode> {
    return this.http.put<PromoCode>(`${CODES}/${id}`, body, { context: silent() });
  }

  redemptions(id: string, page: number, limit: number): Observable<PageOf<Redemption>> {
    return this.http.get<PageOf<Redemption>>(`${CODES}/${id}/redemptions`, {
      params: toParams({ page, limit }),
    });
  }

  report(owner: ReportOwner, id: string, range: ReportRange): Observable<PromoReport> {
    const base = owner === 'code' ? CODES : REFERRALS;
    return this.http.get<PromoReport>(`${base}/${id}/report`, { params: toParams(range) });
  }

  referrals(query: ListQuery): Observable<PageOf<Referral>> {
    return this.http.get<PageOf<Referral>>(REFERRALS, { params: toParams(query) });
  }

  referral(id: string): Observable<Referral> {
    return this.http.get<Referral>(`${REFERRALS}/${id}`, { context: silent() });
  }

  createReferral(body: CreateReferralBody): Observable<Referral> {
    return this.http.post<Referral>(REFERRALS, body, { context: silent() });
  }

  updateReferral(id: string, body: UpdateReferralBody): Observable<Referral> {
    return this.http.put<Referral>(`${REFERRALS}/${id}`, body, { context: silent() });
  }

  countries(): Observable<CountryOption[]> {
    return this.http.get<CountryOption[]>('/catalogs/countries');
  }
}
