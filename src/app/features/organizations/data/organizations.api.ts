import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type { PlatformOrgDetail, PlatformOrgPage, PlatformOrgQuery } from './organizations.models';

@Injectable({ providedIn: 'root' })
export class OrganizationsApi {
  private readonly http = inject(HttpClient);

  list(query: PlatformOrgQuery): Observable<PlatformOrgPage> {
    return this.http.get<PlatformOrgPage>('/platform/organizations', { params: toParams(query) });
  }

  detail(id: string): Observable<PlatformOrgDetail> {
    return this.http.get<PlatformOrgDetail>(`/platform/organizations/${id}`);
  }

  exportCsv(query: Omit<PlatformOrgQuery, 'page' | 'limit'>): Observable<ExportedFile> {
    return this.http
      .get('/platform/organizations/export.csv', {
        params: toParams(query),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(map((response) => exportedFileOf(response, 'organizaciones.csv')));
  }
}
