import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type {
  CityOption,
  CountryOption,
  OrganizationRole,
  PageOf,
  PlatformUserDetail,
  UserAccess,
  UserChanges,
  UserHistoryEvent,
  UserPasskey,
  UserSession,
  UsersPage,
  UserView,
} from './users.models';

const BASE = '/platform/users';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

export const USER_ERRORS: readonly string[] = [
  'MIEMBRO_YA_EXISTE',
  'ROL_INVALIDO',
  'ROL_RESERVADO',
  'ULTIMO_ADMIN',
  'ORGANIZACION_NO_ENCONTRADA',
  'NO_ES_DUPLICADO',
  'NOMBRE_REQUERIDO',
  'APELLIDO_REQUERIDO',
  'CORREO_INVALIDO',
  'CELULAR_INVALIDO',
  'FECHA_INVALIDA',
  'FECHA_FUTURA',
  'PAIS_NO_EXISTE',
  'CIUDAD_NO_EXISTE',
];

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  list(query: {
    search?: string;
    view?: UserView;
    countryId?: string;
    page: number;
    limit: number;
  }): Observable<UsersPage> {
    return this.http.get<UsersPage>(BASE, { params: toParams(query) });
  }

  get(id: string): Observable<PlatformUserDetail> {
    return this.http.get<PlatformUserDetail>(`${BASE}/${id}`, { context: silent() });
  }

  update(id: string, changes: UserChanges, reason: string): Observable<PlatformUserDetail> {
    return this.http.patch<PlatformUserDetail>(
      `${BASE}/${id}`,
      { ...changes, reason },
      { context: silent() },
    );
  }

  addMembership(
    id: string,
    orgId: string,
    roleId: string,
    reason: string,
  ): Observable<PlatformUserDetail> {
    return this.http.post<PlatformUserDetail>(
      `${BASE}/${id}/memberships/${orgId}`,
      { roleId, reason },
      { context: silent() },
    );
  }

  updateMembership(
    id: string,
    orgId: string,
    fields: { roleId?: string; state?: number },
    reason: string,
  ): Observable<PlatformUserDetail> {
    return this.http.patch<PlatformUserDetail>(
      `${BASE}/${id}/memberships/${orgId}`,
      { ...fields, reason },
      { context: silent() },
    );
  }

  removeMembership(id: string, orgId: string, reason: string): Observable<PlatformUserDetail> {
    return this.http.delete<PlatformUserDetail>(`${BASE}/${id}/memberships/${orgId}`, {
      body: { reason },
      context: silent(),
    });
  }

  removeDuplicate(
    id: string,
    orgId: string,
    membershipId: string,
    reason: string,
  ): Observable<PlatformUserDetail> {
    return this.http.delete<PlatformUserDetail>(
      `${BASE}/${id}/memberships/${orgId}/duplicates/${membershipId}`,
      { body: { reason }, context: silent() },
    );
  }

  block(id: string, reason: string): Observable<UserAccess> {
    return this.http.post<UserAccess>(`${BASE}/${id}/block`, { reason }, { context: silent() });
  }

  unblock(id: string, reason: string): Observable<UserAccess> {
    return this.http.post<UserAccess>(`${BASE}/${id}/unblock`, { reason }, { context: silent() });
  }

  sessions(id: string): Observable<UserSession[]> {
    return this.http.get<UserSession[]>(`${BASE}/${id}/sessions`, { context: silent() });
  }

  revokeSession(id: string, sid: string, reason: string): Observable<unknown> {
    return this.http.delete(`${BASE}/${id}/sessions/${encodeURIComponent(sid)}`, {
      body: { reason },
      context: silent(),
    });
  }

  revokeSessions(id: string, reason: string): Observable<{ revoked: number }> {
    return this.http.delete<{ revoked: number }>(`${BASE}/${id}/sessions`, {
      body: { reason },
      context: silent(),
    });
  }

  passkeys(id: string): Observable<UserPasskey[]> {
    return this.http.get<UserPasskey[]>(`${BASE}/${id}/passkeys`, { context: silent() });
  }

  revokePasskey(id: string, credentialId: string, reason: string): Observable<unknown> {
    return this.http.delete(`${BASE}/${id}/passkeys/${encodeURIComponent(credentialId)}`, {
      body: { reason },
      context: silent(),
    });
  }

  history(id: string, page: number, limit: number): Observable<PageOf<UserHistoryEvent>> {
    return this.http.get<PageOf<UserHistoryEvent>>('/platform/audit', {
      params: toParams({ targetType: 'user', targetId: id, page, limit }),
      context: silent(),
    });
  }

  roles(orgId: string): Observable<OrganizationRole[]> {
    return this.http.get<OrganizationRole[]>(`/platform/organizations/${orgId}/roles`, {
      context: silent(),
    });
  }

  cities(countryId: string, search: string): Observable<CityOption[]> {
    return this.http.get<CityOption[]>(`/catalogs/countries/${countryId}/cities`, {
      params: toParams({ search: search || undefined, limit: 50 }),
    });
  }

  countries(): Observable<CountryOption[]> {
    return this.http
      .get<{ id: string; name: string }[]>('/catalogs/countries')
      .pipe(
        map((countries) => countries.map((country) => ({ id: country.id, label: country.name }))),
      );
  }
}
