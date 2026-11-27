import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { IdenticaReportApi } from './identica-report.api';

describe('API del reporte de Identica', () => {
  let api: IdenticaReportApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(IdenticaReportApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la lista con el periodo, los filtros y la página', async () => {
    const respuesta = firstValueFrom(
      api.queries({
        from: '2026-11-01',
        to: '2026-11-26',
        tz: 'America/Bogota',
        group: 'identica',
        page: 2,
        limit: 20,
      }),
    );
    const req = http.expectOne((r) => r.url === '/platform/identica-report/queries');
    expect(req.request.params.toString()).toBe(
      'from=2026-11-01&to=2026-11-26&tz=America/Bogota&group=identica&page=2&limit=20',
    );
    req.flush({ page: 2, total: 0, items: [] });
    expect((await respuesta).page).toBe(2);
  });

  it('baja el CSV con el periodo y los filtros y toma el nombre que manda el core', async () => {
    const archivo = firstValueFrom(
      api.queriesCsv({ from: '2026-11-01', tz: 'America/Bogota', service: 'ani' }),
    );
    const req = http.expectOne((r) => r.url === '/platform/identica-report/queries.csv');
    expect(req.request.params.toString()).toBe('from=2026-11-01&tz=America/Bogota&service=ani');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['a,b\n']), {
      headers: {
        'content-disposition':
          'attachment; filename="consultas-identica-2026-11-01-a-2026-11-26.csv"',
      },
    });
    expect((await archivo).filename).toBe('consultas-identica-2026-11-01-a-2026-11-26.csv');
  });
});
