import { HttpClient, HttpContext } from '@angular/common/http';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  GrantAccess,
  StaffChange,
  StaffList,
  StaffMember,
  StaffRemoval,
} from './staff.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class StaffApi {
  private readonly http = inject(HttpClient);

  list(): Observable<StaffList> {
    return this.http.get<StaffList>('/platform/staff');
  }

  grant(body: GrantAccess): Observable<StaffMember> {
    return this.http.post<StaffMember>('/platform/staff', body, { context: silent() });
  }

  change(id: string, body: StaffChange): Observable<StaffMember> {
    return this.http.patch<StaffMember>(`/platform/staff/${id}`, body, { context: silent() });
  }

  remove(id: string, reason: string): Observable<StaffRemoval> {
    return this.http.delete<StaffRemoval>(`/platform/staff/${id}`, { body: { reason }, context: silent() });
  }
}
