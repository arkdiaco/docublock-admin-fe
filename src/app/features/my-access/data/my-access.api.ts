import { HttpClient, HttpContext } from '@angular/common/http';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

export interface MySession {
  sid: string;
  device: string | null;
  ip: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  current: boolean;
}

@Injectable({ providedIn: 'root' })
export class MyAccessApi {
  private readonly http = inject(HttpClient);

  sessions(): Observable<{ items: MySession[] }> {
    return this.http.get<{ items: MySession[] }>('/platform/auth/sessions');
  }

  revoke(sid: string): Observable<{ revoked: boolean }> {
    return this.http.delete<{ revoked: boolean }>(`/platform/auth/sessions/${sid}`, {
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }
}
