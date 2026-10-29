import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  GrantAccess,
  StaffChange,
  StaffList,
  StaffMember,
  StaffRemoval,
} from './staff.models';

@Injectable({ providedIn: 'root' })
export class StaffApi {
  private readonly http = inject(HttpClient);

  list(): Observable<StaffList> {
    return this.http.get<StaffList>('/platform/staff');
  }

  grant(body: GrantAccess): Observable<StaffMember> {
    return this.http.post<StaffMember>('/platform/staff', body);
  }

  change(id: string, body: StaffChange): Observable<StaffMember> {
    return this.http.patch<StaffMember>(`/platform/staff/${id}`, body);
  }

  remove(id: string, reason: string): Observable<StaffRemoval> {
    return this.http.delete<StaffRemoval>(`/platform/staff/${id}`, { body: { reason } });
  }
}
