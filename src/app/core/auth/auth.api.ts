import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS, SKIP_AUTH } from '../http/http.interceptors';
import type { IssuedSession, Me, RequestOtpResult } from './auth.models';

const publicContext = (): { context: HttpContext } => ({
  context: new HttpContext().set(SKIP_AUTH, true),
});

const silentPublicContext = (): { context: HttpContext } => ({
  context: new HttpContext().set(SKIP_AUTH, true).set(SILENT_ERRORS, true),
});

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  requestOtp(input: { identification: string; resend?: boolean }): Observable<RequestOtpResult> {
    return this.http.post<RequestOtpResult>('/auth/request-otp', input, silentPublicContext());
  }

  login(input: { identification: string; code: string }): Observable<IssuedSession> {
    return this.http.post<IssuedSession>('/auth/login', input, publicContext());
  }

  me(): Observable<Me> {
    return this.http.get<Me>('/auth/me');
  }

  logout(): Observable<{ loggedOut: boolean }> {
    return this.http.post<{ loggedOut: boolean }>('/auth/logout', {});
  }
}
