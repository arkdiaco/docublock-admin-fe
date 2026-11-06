import { HttpErrorResponse } from '@angular/common/http';
import { fileErrorCodeOf } from './error-code';

describe('fileErrorCodeOf', () => {
  it('lee el código de un error que llega como archivo', async () => {
    const error = new HttpErrorResponse({
      status: 404,
      error: new Blob([JSON.stringify({ code: 'ARCHIVO_NO_DISPONIBLE' })]),
    });
    expect(await fileErrorCodeOf(error)).toBe('ARCHIVO_NO_DISPONIBLE');
  });

  it('sin JSON o sin código no inventa nada, y un error con cuerpo normal usa su código', async () => {
    expect(
      await fileErrorCodeOf(new HttpErrorResponse({ status: 502, error: new Blob(['<html>']) })),
    ).toBeNull();
    expect(
      await fileErrorCodeOf(new HttpErrorResponse({ status: 404, error: new Blob(['{}']) })),
    ).toBeNull();
    expect(
      await fileErrorCodeOf(new HttpErrorResponse({ status: 404, error: { code: 'X' } })),
    ).toBe('X');
    expect(await fileErrorCodeOf(new Error('x'))).toBeNull();
  });
});
