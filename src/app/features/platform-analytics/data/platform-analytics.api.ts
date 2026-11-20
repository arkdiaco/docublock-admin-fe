import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type {
  DocumentsRequest,
  OrganizationsRequest,
  PlatformDocuments,
  PlatformOrganizationActivity,
} from './platform-activity.models';
import type { PlatformOverview } from './platform-analytics.models';
import type { PlatformSignatures, SignaturesRequest } from './platform-signatures.models';

@Injectable({ providedIn: 'root' })
export class PlatformAnalyticsApi {
  private readonly http = inject(HttpClient);

  overview(year: number, tz: string): Observable<PlatformOverview> {
    return this.http.get<PlatformOverview>('/platform/intelligence/overview', {
      params: toParams({ year, tz }),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }

  signatures(request: SignaturesRequest): Observable<PlatformSignatures> {
    return this.http.get<PlatformSignatures>('/platform/intelligence/signatures', {
      params: toParams(request),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }

  documents(request: DocumentsRequest): Observable<PlatformDocuments> {
    return this.http.get<PlatformDocuments>('/platform/intelligence/documents', {
      params: toParams(request),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }

  organizations(request: OrganizationsRequest): Observable<PlatformOrganizationActivity> {
    return this.http.get<PlatformOrganizationActivity>('/platform/intelligence/organizations', {
      params: toParams(request),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }

  signaturesCsv(request: SignaturesRequest): Observable<ExportedFile> {
    return this.http
      .get('/platform/intelligence/signatures.csv', {
        params: toParams(request),
        responseType: 'blob',
        observe: 'response',
        context: new HttpContext().set(SILENT_ERRORS, true),
      })
      .pipe(map((response) => exportedFileOf(response, 'firmas.csv')));
  }

  organizationsCsv(request: OrganizationsRequest): Observable<ExportedFile> {
    return this.http
      .get('/platform/intelligence/organizations.csv', {
        params: toParams(request),
        responseType: 'blob',
        observe: 'response',
        context: new HttpContext().set(SILENT_ERRORS, true),
      })
      .pipe(map((response) => exportedFileOf(response, 'organizaciones.csv')));
  }
}
