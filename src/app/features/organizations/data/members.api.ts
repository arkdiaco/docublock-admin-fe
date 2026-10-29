import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type {
  InviteBody,
  OrgInvitation,
  OrgMember,
  OrgRole,
  Paged,
  RoleSyncReport,
} from './members.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class MembersApi {
  private readonly http = inject(HttpClient);

  members(
    orgId: string,
    page: number,
    limit: number,
    search: string,
  ): Observable<Paged<OrgMember>> {
    return this.http.get<Paged<OrgMember>>(`/platform/organizations/${orgId}/members`, {
      params: toParams({ page, limit, search: search || undefined }),
    });
  }

  invitations(orgId: string): Observable<Paged<OrgInvitation>> {
    return this.http.get<Paged<OrgInvitation>>(`/platform/organizations/${orgId}/invitations`, {
      params: toParams({ limit: 50 }),
    });
  }

  roles(orgId: string): Observable<OrgRole[]> {
    return this.http.get<OrgRole[]>(`/platform/organizations/${orgId}/roles`);
  }

  update(
    orgId: string,
    userId: string,
    body: { roleId?: string; state?: number; reason: string },
  ): Observable<OrgMember> {
    return this.http.patch<OrgMember>(`/platform/organizations/${orgId}/members/${userId}`, body, {
      context: silent(),
    });
  }

  remove(orgId: string, userId: string, reason: string): Observable<unknown> {
    return this.http.delete(`/platform/organizations/${orgId}/members/${userId}`, {
      body: { reason },
      context: silent(),
    });
  }

  invite(orgId: string, body: InviteBody): Observable<OrgInvitation> {
    return this.http.post<OrgInvitation>(`/platform/organizations/${orgId}/invitations`, body, {
      context: silent(),
    });
  }

  resend(orgId: string, id: string, reason: string): Observable<OrgInvitation> {
    return this.http.post<OrgInvitation>(
      `/platform/organizations/${orgId}/invitations/${id}/resend`,
      { reason },
      { context: silent() },
    );
  }

  revoke(orgId: string, id: string, reason: string): Observable<OrgInvitation> {
    return this.http.post<OrgInvitation>(
      `/platform/organizations/${orgId}/invitations/${id}/revoke`,
      { reason },
      { context: silent() },
    );
  }

  syncRoles(orgId: string, reason: string): Observable<RoleSyncReport> {
    return this.http.post<RoleSyncReport>(
      `/platform/organizations/${orgId}/roles/sync`,
      { reason },
      { context: silent() },
    );
  }
}
