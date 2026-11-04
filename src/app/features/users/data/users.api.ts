import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { CountryOption, PlatformUserDetail, UsersPage, UserView } from './users.models';

const BASE = '/platform/users';

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
    return this.http.get<PlatformUserDetail>(`${BASE}/${id}`, {
      context: new HttpContext().set(SILENT_ERRORS, true),
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
