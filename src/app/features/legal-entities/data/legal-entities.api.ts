import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { TargetHistoryEvent } from '../../../shared/ui/target-history.component';
import type {
  CountryOption,
  KindOption,
  LegalEntitiesPage,
  LegalEntityChanges,
  LegalEntityDetail,
  LegalEntityView,
  NewLegalEntity,
  PendingLegalEntitiesPage,
  SignerOption,
} from './legal-entities.models';

const BASE = '/platform/legal-entities';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

export const LEGAL_ENTITY_ERRORS: readonly string[] = [
  'ENTIDAD_NO_ENCONTRADA',
  'ENTIDAD_YA_EXISTE',
  'ENTIDAD_YA_ACTIVA',
  'ENTIDAD_YA_INACTIVA',
  'RAZON_SOCIAL_REQUERIDA',
  'NIT_REQUERIDO',
  'PAIS_NO_ENCONTRADO',
  'TIPO_PERSONA_INVALIDO',
  'FIRMANTE_NO_ENCONTRADO',
  'REPRESENTANTE_YA_VINCULADO',
  'REPRESENTANTE_NO_VINCULADO',
];

@Injectable({ providedIn: 'root' })
export class LegalEntitiesApi {
  private readonly http = inject(HttpClient);

  list(query: {
    search?: string;
    view?: LegalEntityView;
    countryId?: string;
    page: number;
    limit: number;
  }): Observable<LegalEntitiesPage> {
    return this.http.get<LegalEntitiesPage>(BASE, { params: toParams(query) });
  }

  pending(query: {
    search?: string;
    countryId?: string;
    page: number;
    limit: number;
  }): Observable<PendingLegalEntitiesPage> {
    return this.http.get<PendingLegalEntitiesPage>(`${BASE}/pending`, { params: toParams(query) });
  }

  get(id: string): Observable<LegalEntityDetail> {
    return this.http.get<LegalEntityDetail>(`${BASE}/${id}`, { context: silent() });
  }

  create(data: NewLegalEntity, reason: string): Observable<LegalEntityDetail> {
    return this.http.post<LegalEntityDetail>(BASE, { ...data, reason }, { context: silent() });
  }

  update(id: string, changes: LegalEntityChanges, reason: string): Observable<LegalEntityDetail> {
    return this.http.patch<LegalEntityDetail>(
      `${BASE}/${id}`,
      { ...changes, reason },
      { context: silent() },
    );
  }

  setActive(id: string, active: boolean, reason: string): Observable<LegalEntityDetail> {
    return this.http.post<LegalEntityDetail>(
      `${BASE}/${id}/${active ? 'activate' : 'deactivate'}`,
      { reason },
      { context: silent() },
    );
  }

  addRepresentative(
    id: string,
    signerId: string,
    isLegalRep: boolean,
    reason: string,
  ): Observable<LegalEntityDetail> {
    return this.http.post<LegalEntityDetail>(
      `${BASE}/${id}/representatives`,
      { signerId, isLegalRep, reason },
      { context: silent() },
    );
  }

  updateRepresentative(
    id: string,
    signerId: string,
    isLegalRep: boolean,
    reason: string,
  ): Observable<LegalEntityDetail> {
    return this.http.patch<LegalEntityDetail>(
      `${BASE}/${id}/representatives/${signerId}`,
      { isLegalRep, reason },
      { context: silent() },
    );
  }

  removeRepresentative(
    id: string,
    signerId: string,
    reason: string,
  ): Observable<LegalEntityDetail> {
    return this.http.delete<LegalEntityDetail>(`${BASE}/${id}/representatives/${signerId}`, {
      body: { reason },
      context: silent(),
    });
  }

  history(
    id: string,
    page: number,
    limit: number,
  ): Observable<{ total: number; items: TargetHistoryEvent[] }> {
    return this.http.get<{ total: number; items: TargetHistoryEvent[] }>('/platform/audit', {
      params: toParams({ targetType: 'legal_entity', targetId: id, page, limit }),
      context: silent(),
    });
  }

  searchSigners(term: string): Observable<SignerOption[]> {
    return this.http
      .get<{
        items: {
          id: string;
          fullName?: string;
          businessName?: string;
          identification?: string;
        }[];
      }>('/platform/signers', {
        params: toParams({ search: term || undefined, page: 1, limit: 20 }),
        context: silent(),
      })
      .pipe(
        map((page) =>
          page.items.map((signer) => ({
            id: signer.id,
            label: [signer.fullName || signer.businessName, signer.identification]
              .filter(Boolean)
              .join(' · '),
          })),
        ),
      );
  }

  companyKinds(countryId: string): Observable<KindOption[]> {
    return this.http
      .get<{ id: string; name: string; type?: string }[]>(
        `/catalogs/countries/${countryId}/kind-persons`,
      )
      .pipe(map((kinds) => kinds.filter((kind) => kind.type !== 'natural')));
  }

  countries(): Observable<CountryOption[]> {
    return this.http
      .get<{ id: string; name: string }[]>('/catalogs/countries')
      .pipe(
        map((countries) => countries.map((country) => ({ id: country.id, label: country.name }))),
      );
  }
}
