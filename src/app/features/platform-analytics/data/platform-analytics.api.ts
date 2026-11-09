import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { PlatformOverview } from './platform-analytics.models';

@Injectable({ providedIn: 'root' })
export class PlatformAnalyticsApi {
  private readonly http = inject(HttpClient);

  overview(year: number, tz: string): Observable<PlatformOverview> {
    return this.http.get<PlatformOverview>('/platform/intelligence/overview', {
      params: toParams({ year, tz }),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }
}
