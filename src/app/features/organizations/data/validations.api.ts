import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type { Paged } from './members.models';
import type {
  CreditChange,
  CreditLogEntry,
  CreditType,
  OrgCredits,
  OrgSettings,
  PricingBody,
  ValidationKey,
  ValidationPricing,
} from './validations.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class ValidationsApi {
  private readonly http = inject(HttpClient);

  settings(orgId: string): Observable<OrgSettings> {
    return this.http.get<OrgSettings>(`/platform/organizations/${orgId}/settings`);
  }

  setValidation(
    orgId: string,
    key: ValidationKey,
    value: boolean,
    reason: string,
  ): Observable<OrgSettings> {
    return this.http.patch<OrgSettings>(
      `/platform/organizations/${orgId}/settings`,
      { [key]: value, reason },
      { context: silent() },
    );
  }

  credits(orgId: string): Observable<OrgCredits> {
    return this.http.get<OrgCredits>(`/platform/validation-credits/${orgId}`);
  }

  updateCredit(
    orgId: string,
    type: CreditType,
    change: CreditChange,
    reason: string,
  ): Observable<OrgCredits> {
    return this.http.put<OrgCredits>(
      `/platform/validation-credits/${orgId}`,
      { [type]: change, reason },
      { context: silent() },
    );
  }

  log(orgId: string, page: number, limit: number): Observable<Paged<CreditLogEntry>> {
    return this.http.get<Paged<CreditLogEntry>>(`/platform/validation-credits/${orgId}/log`, {
      params: toParams({ page, limit }),
    });
  }

  pricing(orgId: string): Observable<ValidationPricing> {
    return this.http.get<ValidationPricing>(`/platform/validation-credits/${orgId}/pricing`);
  }

  setPricing(orgId: string, body: PricingBody): Observable<ValidationPricing> {
    return this.http.put<ValidationPricing>(`/platform/validation-credits/${orgId}/pricing`, body, {
      context: silent(),
    });
  }

  billingPdf(orgId: string, from?: string, to?: string): Observable<ExportedFile> {
    return this.http
      .post(
        `/platform/validation-credits/${orgId}/billing/pdf`,
        { from, to },
        { responseType: 'blob', observe: 'response', context: silent() },
      )
      .pipe(map((response) => exportedFileOf(response, 'cuenta-de-cobro.pdf')));
  }
}
