import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type {
  CreateProductBody,
  CurrencyCountry,
  ProductDetail,
  ProductQuery,
  ProductRow,
  ProductTexts,
  VersionProductBody,
} from './marketplace.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);
const product = (code: string): string =>
  `/platform/marketplace/products/${encodeURIComponent(code)}`;

@Injectable({ providedIn: 'root' })
export class MarketplaceApi {
  private readonly http = inject(HttpClient);

  list(query: ProductQuery): Observable<ProductRow[]> {
    return this.http.get<ProductRow[]>('/platform/marketplace/products', {
      params: toParams({ ...query }),
    });
  }

  detail(code: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(product(code), { context: silent() });
  }

  create(body: CreateProductBody): Observable<ProductDetail> {
    return this.http.post<ProductDetail>('/platform/marketplace/products', body, {
      context: silent(),
    });
  }

  version(code: string, body: VersionProductBody): Observable<ProductDetail> {
    return this.http.post<ProductDetail>(`${product(code)}/versions`, body, { context: silent() });
  }

  setTexts(code: string, texts: ProductTexts, reason: string): Observable<ProductDetail> {
    return this.http.put<ProductDetail>(
      `${product(code)}/texts`,
      { ...texts, reason },
      { context: silent() },
    );
  }

  setVisible(code: string, visible: boolean, reason: string): Observable<ProductDetail> {
    return this.http.patch<ProductDetail>(
      `${product(code)}/visibility`,
      { visible, reason },
      { context: silent() },
    );
  }

  retire(code: string, reason: string): Observable<ProductDetail> {
    return this.http.post<ProductDetail>(
      `${product(code)}/retire`,
      { reason },
      { context: silent() },
    );
  }

  reactivate(code: string, reason: string): Observable<ProductDetail> {
    return this.http.post<ProductDetail>(
      `${product(code)}/reactivate`,
      { reason },
      { context: silent() },
    );
  }

  countries(): Observable<CurrencyCountry[]> {
    return this.http.get<CurrencyCountry[]>('/catalogs/countries');
  }
}
