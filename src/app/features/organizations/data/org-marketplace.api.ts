import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import type { OrgAddon, OrgProductPrice, OverrideBody } from './org-marketplace.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);
const base = (orgId: string): string => `/platform/marketplace/organizations/${orgId}`;

@Injectable({ providedIn: 'root' })
export class OrgMarketplaceApi {
  private readonly http = inject(HttpClient);

  prices(orgId: string): Observable<OrgProductPrice[]> {
    return this.http.get<OrgProductPrice[]>(`${base(orgId)}/prices`, { context: silent() });
  }

  setPrice(orgId: string, code: string, body: OverrideBody): Observable<unknown> {
    return this.http.put(`${base(orgId)}/prices/${encodeURIComponent(code)}`, body, {
      context: silent(),
    });
  }

  removePrice(orgId: string, code: string, reason: string): Observable<unknown> {
    return this.http.delete(`${base(orgId)}/prices/${encodeURIComponent(code)}`, {
      body: { reason },
      context: silent(),
    });
  }

  addons(orgId: string): Observable<OrgAddon[]> {
    return this.http.get<OrgAddon[]>(`${base(orgId)}/addons`, { context: silent() });
  }

  setAddon(
    orgId: string,
    addonCode: string,
    active: boolean,
    reason: string,
  ): Observable<OrgAddon> {
    return this.http.put<OrgAddon>(
      `${base(orgId)}/addons/${encodeURIComponent(addonCode)}`,
      { active, reason },
      { context: silent() },
    );
  }

  cancelAddon(orgId: string, addonCode: string, reason: string): Observable<OrgAddon> {
    return this.http.post<OrgAddon>(
      `${base(orgId)}/addons/${encodeURIComponent(addonCode)}/cancel`,
      { reason },
      { context: silent() },
    );
  }
}
