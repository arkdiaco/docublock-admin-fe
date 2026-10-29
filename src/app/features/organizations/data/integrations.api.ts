import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import type { OrgIntegrations, RotatedApiKey } from './integrations.models';

@Injectable({ providedIn: 'root' })
export class IntegrationsApi {
  private readonly http = inject(HttpClient);

  overview(orgId: string): Observable<OrgIntegrations> {
    return this.http.get<OrgIntegrations>(`/platform/organizations/${orgId}/integrations`);
  }

  rotateApiKey(orgId: string, reason: string): Observable<RotatedApiKey> {
    return this.http.post<RotatedApiKey>(
      `/platform/organizations/${orgId}/integrations/api-key/rotate`,
      { reason },
      { context: new HttpContext().set(SILENT_ERRORS, true) },
    );
  }
}
