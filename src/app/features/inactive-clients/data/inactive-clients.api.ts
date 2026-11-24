import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { toParams } from '../../../shared/http/query-params';
import type {
  InactiveOrganizationsPage,
  InactiveOrganizationsQuery,
} from './inactive-clients.models';

@Injectable({ providedIn: 'root' })
export class InactiveClientsApi {
  private readonly http = inject(HttpClient);

  list(query: InactiveOrganizationsQuery): Observable<InactiveOrganizationsPage> {
    return this.http.get<InactiveOrganizationsPage>('/platform/inactive-organizations', {
      params: toParams({ ...query }),
    });
  }
}
