import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { exportedFileOf } from './exported-file';

describe('exportedFileOf', () => {
  it('toma el nombre del Content-Disposition y cae al nombre por defecto si no viene', () => {
    const blob = new Blob(['a']);
    const con = new HttpResponse<Blob>({ body: blob, headers: new HttpHeaders({ 'content-disposition': 'attachment; filename="reporte-atascados-2026-09-26.pdf"' }) });
    expect(exportedFileOf(con, 'x.pdf')).toEqual({ filename: 'reporte-atascados-2026-09-26.pdf', blob });
    const sin = new HttpResponse<Blob>({ body: null });
    const file = exportedFileOf(sin, 'x.pdf');
    expect(file.filename).toBe('x.pdf');
    expect(file.blob.size).toBe(0);
  });
});
