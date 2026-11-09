import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { toParams } from './query-params';

export interface OrganizationOption {
  id: string;
  businessName: string;
  tributaryNumber: string;
  isReseller?: boolean;
  resellerId?: string;
  resellerName?: string;
}

export type LookupScope = 'clients' | 'commercial' | 'resellers';

export const LOOKUP_LIMIT = 8;

const ROUTES: Record<LookupScope, string> = {
  clients: '/platform/organizations',
  commercial: '/platform/commercial/organizations',
  resellers: '/platform/intelligence/resellers',
};

@Injectable({ providedIn: 'root' })
export class OrganizationLookup {
  private readonly http = inject(HttpClient);

  search(term: string, scope: LookupScope = 'clients'): Observable<OrganizationOption[]> {
    return this.http
      .get<{ items: OrganizationOption[] }>(ROUTES[scope], {
        params: toParams({ search: term || undefined, limit: LOOKUP_LIMIT }),
      })
      .pipe(
        map((page) =>
          page.items.map(
            ({ id, businessName, tributaryNumber, isReseller, resellerId, resellerName }) => ({
              id,
              businessName,
              tributaryNumber,
              isReseller,
              resellerId,
              resellerName,
            }),
          ),
        ),
      );
  }

  byId(id: string, scope: LookupScope = 'clients'): Observable<OrganizationOption> {
    return this.http.get<OrganizationOption>(`${ROUTES[scope]}/${id}`).pipe(
      map(({ businessName, tributaryNumber, isReseller, resellerId, resellerName }) => ({
        id,
        businessName,
        tributaryNumber,
        isReseller,
        resellerId,
        resellerName,
      })),
    );
  }
}
