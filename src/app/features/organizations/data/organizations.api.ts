import { HttpClient, HttpContext } from '@angular/common/http';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type {
  CityOption,
  PlatformOrgDetail,
  PlatformOrgPage,
  PlatformOrgQuery,
  PlatformOrgUpdate,
  ResellerOption,
} from './organizations.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class OrganizationsApi {
  private readonly http = inject(HttpClient);

  list(query: PlatformOrgQuery): Observable<PlatformOrgPage> {
    return this.http.get<PlatformOrgPage>('/platform/organizations', { params: toParams(query) });
  }

  detail(id: string): Observable<PlatformOrgDetail> {
    return this.http.get<PlatformOrgDetail>(`/platform/organizations/${id}`);
  }

  update(id: string, body: PlatformOrgUpdate): Observable<PlatformOrgDetail> {
    return this.http.patch<PlatformOrgDetail>(`/platform/organizations/${id}`, body, { context: silent() });
  }

  suspend(id: string, reason: string): Observable<PlatformOrgDetail> {
    return this.http.post<PlatformOrgDetail>(`/platform/organizations/${id}/suspend`, { reason }, { context: silent() });
  }

  reactivate(id: string, reason: string): Observable<PlatformOrgDetail> {
    return this.http.post<PlatformOrgDetail>(`/platform/organizations/${id}/reactivate`, { reason }, { context: silent() });
  }

  setModules(id: string, modules: string[]): Observable<unknown> {
    return this.http.patch(`/platform/organizations/${id}/modules`, { modules }, { context: silent() });
  }

  assignReseller(id: string, resellerId: string | null): Observable<unknown> {
    return this.http.put(`/platform/organizations/${id}/reseller`, { resellerId }, { context: silent() });
  }

  resellers(search: string): Observable<ResellerOption[]> {
    return this.http
      .get<{ items: ResellerOption[] }>('/platform/resellers', { params: toParams({ search: search || undefined, limit: 30 }) })
      .pipe(map((page) => page.items));
  }

  cities(countryId: string, search: string): Observable<CityOption[]> {
    return this.http.get<CityOption[]>(`/catalogs/countries/${countryId}/cities`, {
      params: toParams({ search: search || undefined, limit: 30 }),
    });
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
