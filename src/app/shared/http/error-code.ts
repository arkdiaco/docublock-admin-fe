import { HttpErrorResponse } from '@angular/common/http';

export const errorCodeOf = (error: unknown): string | null => {
  const body = error instanceof HttpErrorResponse ? (error.error as { code?: unknown } | null) : null;
  return body && typeof body.code === 'string' ? body.code : null;
};

export const fileErrorCodeOf = async (error: unknown): Promise<string | null> => {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
    return errorCodeOf(error);
  }
  try {
    const body = JSON.parse(await error.error.text()) as { code?: unknown } | null;
    return typeof body?.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
};

export const errorStatusOf = (error: unknown): number | null =>
  error instanceof HttpErrorResponse ? error.status : null;

export const errorMessageOf = (error: unknown): string | null => {
  const body = error instanceof HttpErrorResponse ? (error.error as { message?: unknown } | null) : null;
  if (typeof body?.message === 'string') return body.message;
  return Array.isArray(body?.message) ? body.message.map(String).join(' · ') : null;
};
