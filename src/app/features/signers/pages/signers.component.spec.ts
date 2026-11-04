import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { conPermisos, configurar, firmante } from './signers-test-kit';
import { SignersComponent } from './signers.component';

const COUNTS = { all: 175, identified: 11, unidentified: 164, without: 61 };

describe('Firmantes › Lista', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SignersComponent>;

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:clients:read']);
    fixture = TestBed.createComponent(SignersComponent);
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
  });

  afterEach(() => http.verify());

  const primerPedido = () => http.expectOne((req) => req.url === '/platform/signers');

  it('pinta firmantes, conteos y estado sin llaves crudas', async () => {
    primerPedido().flush({
      total: 2,
      counts: COUNTS,
      items: [
        firmante(),
        firmante({ id: 's2', fullName: '', businessName: 'Acme', identified: false, email: undefined }),
      ],
    });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Ana Ruiz');
    });
    expect(host.textContent).toContain('Acme');
    expect(host.textContent).toContain('Identificado');
    expect(host.textContent).toContain('Sin identificar');
    expect(host.textContent).toContain('Sin organización');
    expect(host.textContent).toContain('61');
    expect(host.textContent).not.toMatch(/\bsig\.[a-z]/);
  });

  it('elegir una vista vuelve a la primera página y filtra', async () => {
    primerPedido().flush({ total: 1, counts: COUNTS, items: [firmante()] });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Ana Ruiz');
    });
    const pill = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Sin organización'),
    );
    pill?.click();
    const pedido = await vi.waitFor(() => primerPedido());
    expect(pedido.request.params.get('view')).toBe('without');
    expect(pedido.request.params.get('page')).toBe('1');
    pedido.flush({ total: 0, counts: COUNTS, items: [] });
  });

  it('un fallo ofrece reintentar', async () => {
    primerPedido().flush({}, { status: 500, statusText: 'Error' });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('No pudimos cargar los firmantes.');
    });
  });
});
