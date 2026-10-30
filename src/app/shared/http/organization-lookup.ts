import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { toParams } from './query-params';

export interface OrganizationOption {
  id: string;
  businessName: string;
  tributaryNumber: string;
}

export const LOOKUP_LIMIT = 8;

@Injectable({ providedIn: 'root' })
export class OrganizationLookup {
  private readonly http = inject(HttpClient);

  search(term: string): Observable<OrganizationOption[]> {
    return this.http
      .get<{ items: OrganizationOption[] }>('/platform/organizations', {
        params: toParams({ search: term || undefined, limit: LOOKUP_LIMIT }),
      })
      .pipe(
        map((page) =>
          page.items.map(({ id, businessName, tributaryNumber }) => ({
            id,
            businessName,
            tributaryNumber,
          })),
        ),
      );
  }

  byId(id: string): Observable<OrganizationOption> {
    return this.http
      .get<OrganizationOption>(`/platform/organizations/${id}`)
      .pipe(map(({ businessName, tributaryNumber }) => ({ id, businessName, tributaryNumber })));
  }
}
