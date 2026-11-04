import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { errorCodeOf } from '../../../shared/http/error-code';
import { toParams } from '../../../shared/http/query-params';
import type { TargetHistoryEvent } from '../../../shared/ui/target-history.component';
import type {
  CapabilitiesInput,
  CatalogLabels,
  CatalogPage,
  CityRow,
  ConsentDraft,
  ConsentPolicy,
  CountryChanges,
  CountryDetail,
  CountryOption,
  CountryRow,
  FieldRules,
  DirectoryMode,
  IdentificationTypeRow,
  KindPersonRow,
  KindType,
  PolicyLocale,
  PropertyCatalog,
  PropertyCategory,
  SignerPolicy,
} from './catalogs.models';

const BASE = '/platform/catalogs';
const PROPERTY = '/platform/real-estate/catalog';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

const CATALOG_ERRORS: readonly string[] = [
  'PAIS_NO_ENCONTRADO',
  'NOMBRE_REQUERIDO',
  'ABREVIATURA_REQUERIDA',
  'ZONA_HORARIA_INVALIDA',
  'LOCALE_INVALIDO',
  'MONEDA_INVALIDA',
  'INDICATIVO_INVALIDO',
  'PATRON_INVALIDO',
  'CIUDAD_NO_ENCONTRADA',
  'CODIGO_CIUDAD_EN_USO',
  'TIPO_PERSONA_NO_ENCONTRADO',
  'TIPO_PERSONA_OTRO_PAIS',
  'TIPO_IDENTIFICACION_NO_ENCONTRADO',
  'CATALOGO_EN_USO',
  'ITEM_YA_EXISTE',
  'ITEM_NO_EXISTE',
  'POLITICA_INCOMPLETA',
  'POLITICA_SIN_CAMBIOS',
  'POLITICA_CODIGO_INVALIDO',
];

export const catalogErrorKey = (error: unknown): string => {
  const code = errorCodeOf(error);
  return code !== null && CATALOG_ERRORS.includes(code)
    ? `cat.error.${code}`
    : 'cat.error.generic';
};

export const catalogUsageOf = (error: unknown): number => {
  const body = (error as { error?: { usage?: unknown } } | null)?.error;
  return typeof body?.usage === 'number' ? body.usage : 0;
};

@Injectable({ providedIn: 'root' })
export class CatalogsApi {
  private readonly http = inject(HttpClient);

  countryOptions(): Observable<CountryOption[]> {
    return this.http
      .get<{ id: string; name: string }[]>('/catalogs/countries')
      .pipe(map((rows) => rows.map((row) => ({ id: row.id, label: row.name }))));
  }

  countries(search?: string): Observable<CatalogPage<CountryRow>> {
    return this.http.get<CatalogPage<CountryRow>>(`${BASE}/countries`, {
      params: toParams({ search }),
    });
  }

  country(id: string): Observable<CountryDetail> {
    return this.http.get<CountryDetail>(`${BASE}/countries/${id}`, { context: silent() });
  }

  createCountry(
    draft: CountryChanges & { name: string; abbreviation: string },
    reason: string,
  ): Observable<CountryDetail> {
    return this.http.post<CountryDetail>(
      `${BASE}/countries`,
      { ...draft, reason },
      { context: silent() },
    );
  }

  updateCountry(id: string, changes: CountryChanges, reason: string): Observable<CountryDetail> {
    return this.http.patch<CountryDetail>(
      `${BASE}/countries/${id}`,
      { ...changes, reason },
      { context: silent() },
    );
  }

  updateCapabilities(
    id: string,
    input: CapabilitiesInput,
    reason: string,
  ): Observable<CountryDetail> {
    return this.http.patch<CountryDetail>(
      `${BASE}/countries/${id}/capabilities`,
      { ...input, reason },
      { context: silent() },
    );
  }

  removeCountry(id: string, reason: string): Observable<unknown> {
    return this.http.delete(`${BASE}/countries/${id}`, { body: { reason }, context: silent() });
  }

  countryHistory(
    id: string,
    page: number,
    limit: number,
  ): Observable<{ total: number; items: TargetHistoryEvent[] }> {
    return this.http.get<{ total: number; items: TargetHistoryEvent[] }>('/platform/audit', {
      params: toParams({ targetType: 'country', targetId: id, page, limit }),
      context: silent(),
    });
  }

  cities(query: {
    countryId?: string;
    search?: string;
    page: number;
    limit: number;
  }): Observable<CatalogPage<CityRow>> {
    return this.http.get<CatalogPage<CityRow>>(`${BASE}/cities`, { params: toParams(query) });
  }

  createCity(
    draft: { countryId: string; name: string; code?: string },
    reason: string,
  ): Observable<CityRow> {
    return this.http.post<CityRow>(`${BASE}/cities`, { ...draft, reason }, { context: silent() });
  }

  updateCity(
    id: string,
    changes: { name?: string; code?: string | null },
    reason: string,
  ): Observable<CityRow> {
    return this.http.patch<CityRow>(
      `${BASE}/cities/${id}`,
      { ...changes, reason },
      { context: silent() },
    );
  }

  removeCity(id: string, reason: string): Observable<unknown> {
    return this.http.delete(`${BASE}/cities/${id}`, { body: { reason }, context: silent() });
  }

  kindPersons(query: {
    countryId?: string;
    page: number;
    limit: number;
  }): Observable<CatalogPage<KindPersonRow>> {
    return this.http.get<CatalogPage<KindPersonRow>>(`${BASE}/kind-persons`, {
      params: toParams(query),
    });
  }

  createKindPerson(
    draft: { countryId: string; name: string; type: KindType; labels?: CatalogLabels },
    reason: string,
  ): Observable<KindPersonRow> {
    return this.http.post<KindPersonRow>(
      `${BASE}/kind-persons`,
      { ...draft, reason },
      { context: silent() },
    );
  }

  updateKindPerson(
    id: string,
    changes: { name?: string; type?: KindType; labels?: CatalogLabels },
    reason: string,
  ): Observable<KindPersonRow> {
    return this.http.patch<KindPersonRow>(
      `${BASE}/kind-persons/${id}`,
      { ...changes, reason },
      { context: silent() },
    );
  }

  removeKindPerson(id: string, reason: string): Observable<unknown> {
    return this.http.delete(`${BASE}/kind-persons/${id}`, { body: { reason }, context: silent() });
  }

  identificationTypes(query: {
    countryId?: string;
    kindPersonId?: string;
    page: number;
    limit: number;
  }): Observable<CatalogPage<IdentificationTypeRow>> {
    return this.http.get<CatalogPage<IdentificationTypeRow>>(`${BASE}/identification-types`, {
      params: toParams(query),
    });
  }

  createIdentificationType(
    draft: {
      kindPersonId: string;
      name: string;
      abbreviation: string;
      alphanumeric: boolean;
      labels?: CatalogLabels;
    },
    reason: string,
  ): Observable<IdentificationTypeRow> {
    return this.http.post<IdentificationTypeRow>(
      `${BASE}/identification-types`,
      { ...draft, reason },
      { context: silent() },
    );
  }

  updateIdentificationType(
    id: string,
    changes: {
      kindPersonId?: string;
      name?: string;
      abbreviation?: string;
      alphanumeric?: boolean;
      labels?: CatalogLabels;
    },
    reason: string,
  ): Observable<IdentificationTypeRow> {
    return this.http.patch<IdentificationTypeRow>(
      `${BASE}/identification-types/${id}`,
      { ...changes, reason },
      { context: silent() },
    );
  }

  removeIdentificationType(id: string, reason: string): Observable<unknown> {
    return this.http.delete(`${BASE}/identification-types/${id}`, {
      body: { reason },
      context: silent(),
    });
  }

  signerPolicy(countryId: string): Observable<SignerPolicy> {
    return this.http.get<SignerPolicy>(`${BASE}/signer-policies/${countryId}`, {
      context: silent(),
    });
  }

  saveSignerPolicy(
    countryId: string,
    policy: { directory: DirectoryMode; natural: FieldRules; legal: FieldRules },
    reason: string,
  ): Observable<SignerPolicy> {
    return this.http.put<SignerPolicy>(
      `${BASE}/signer-policies/${countryId}`,
      { ...policy, reason },
      { context: silent() },
    );
  }

  resetSignerPolicy(countryId: string, reason: string): Observable<SignerPolicy> {
    return this.http.delete<SignerPolicy>(`${BASE}/signer-policies/${countryId}`, {
      body: { reason },
      context: silent(),
    });
  }

  propertyCatalog(): Observable<PropertyCatalog> {
    return this.http.get<PropertyCatalog>(PROPERTY);
  }

  addPropertyItem(
    category: PropertyCategory,
    item: { key: string; label: string },
    reason: string,
  ): Observable<PropertyCatalog> {
    return this.http.post<PropertyCatalog>(
      `${PROPERTY}/${category}/items`,
      { ...item, reason },
      { context: silent() },
    );
  }

  updatePropertyItem(
    category: PropertyCategory,
    key: string,
    label: string,
    reason: string,
  ): Observable<PropertyCatalog> {
    return this.http.put<PropertyCatalog>(
      `${PROPERTY}/${category}/items/${encodeURIComponent(key)}`,
      { key, label, reason },
      { context: silent() },
    );
  }

  removePropertyItem(
    category: PropertyCategory,
    key: string,
    reason: string,
  ): Observable<PropertyCatalog> {
    return this.http.delete<PropertyCatalog>(
      `${PROPERTY}/${category}/items/${encodeURIComponent(key)}`,
      { body: { reason }, context: silent() },
    );
  }

  consentPolicies(locale: PolicyLocale): Observable<{ locale: string; policies: ConsentPolicy[] }> {
    return this.http.get<{ locale: string; policies: ConsentPolicy[] }>(
      `${BASE}/consent-policies`,
      { params: toParams({ locale }) },
    );
  }

  consentVersions(code: string, locale: PolicyLocale): Observable<ConsentPolicy[]> {
    return this.http.get<ConsentPolicy[]>(`${BASE}/consent-policies/${code}/versions`, {
      params: toParams({ locale }),
      context: silent(),
    });
  }

  publishConsent(draft: ConsentDraft, reason: string): Observable<ConsentPolicy> {
    return this.http.post<ConsentPolicy>(
      `${BASE}/consent-policies`,
      { ...draft, reason },
      { context: silent() },
    );
  }
}
