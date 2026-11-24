import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { toParams } from '../../../shared/http/query-params';
import type {
  InactiveExportView,
  InactiveOrganizationsPage,
  InactiveOrganizationsQuery,
} from './inactive-clients.models';

@Injectable({ providedIn: 'root' })
export class InactiveClientsApi {
  private readonly http = inject(HttpClient);

  list(query: InactiveOrganizationsQuery): Observable<InactiveOrganizationsPage> {
    return this.http.get<InactiveOrganizationsPage>('/platform/inactive-organizations', {
      params: toParams({ ...query }),
    });
  }

  latestExport(organizationId: string): Observable<InactiveExportView | null> {
    return this.http.get<InactiveExportView | null>(this.exportPath(organizationId));
  }

  startExport(organizationId: string, reason: string): Observable<InactiveExportView> {
    return this.http.post<InactiveExportView>(this.exportPath(organizationId), { reason });
  }

  private exportPath(organizationId: string): string {
    return `/platform/inactive-organizations/${encodeURIComponent(organizationId)}/export`;
  }
}
