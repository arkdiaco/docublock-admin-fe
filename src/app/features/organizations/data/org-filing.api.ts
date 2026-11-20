import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import type { FilingCreditsBody, FilingPrefixBody, PlatformFilingView } from './org-filing.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);
const base = (orgId: string): string => `/platform/organizations/${orgId}/filing`;

@Injectable({ providedIn: 'root' })
export class OrgFilingApi {
  private readonly http = inject(HttpClient);

  view(orgId: string): Observable<PlatformFilingView> {
    return this.http.get<PlatformFilingView>(base(orgId), { context: silent() });
  }

  changePrefix(orgId: string, body: FilingPrefixBody): Observable<PlatformFilingView> {
    return this.http.put<PlatformFilingView>(`${base(orgId)}/prefix`, body, { context: silent() });
  }

  adjustCredits(orgId: string, body: FilingCreditsBody): Observable<PlatformFilingView> {
    return this.http.put<PlatformFilingView>(`${base(orgId)}/credits`, body, { context: silent() });
  }
}
