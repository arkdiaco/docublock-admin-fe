import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { toParams } from '../../../shared/http/query-params';
import type { OrgAuditPage } from './org-audit.models';

@Injectable({ providedIn: 'root' })
export class OrgAuditApi {
  private readonly http = inject(HttpClient);

  list(organizationId: string, page: number, limit: number): Observable<OrgAuditPage> {
    return this.http.get<OrgAuditPage>('/platform/audit', {
      params: toParams({ organizationId, page, limit }),
    });
  }
}
