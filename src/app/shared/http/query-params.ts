import { HttpParams } from '@angular/common/http';

export const toParams = (query: object): HttpParams =>
  Object.entries(query).reduce(
    (params, [key, value]) =>
      value === undefined || value === null || value === ''
        ? params
        : Array.isArray(value)
          ? value.reduce((acc: HttpParams, item) => acc.append(key, String(item)), params)
          : params.set(key, value instanceof Date ? value.toISOString() : String(value)),
    new HttpParams(),
  );
