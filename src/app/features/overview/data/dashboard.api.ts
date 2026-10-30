import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import type { PlatformDashboard } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);

  load(): Observable<PlatformDashboard> {
    return this.http.get<PlatformDashboard>('/platform/dashboard', {
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }
}
