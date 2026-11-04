import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import type { PlatformSignerDetail } from '../data/signers.models';
import { SignerDetailComponent } from './signer-detail.component';
import { conPermisos, configurar, ficha } from './signers-test-kit';

describe('Firmantes › Ficha', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SignerDetailComponent>;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const abrir = async (permisos: string[], over: Partial<PlatformSignerDetail> = {}) => {
    conPermisos(permisos);
    fixture = TestBed.createComponent(SignerDetailComponent);
    fixture.componentRef.setInput('id', 's1');
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/platform/signers/s1').flush(ficha(over));
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Notaría Central');
    });
    return host;
  };

  const pulsar = (host: HTMLElement, texto: string): void => {
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))?.click();
  };

  it('con solo lectura se ve todo y no hay acciones', async () => {
    const host = await abrir(['platform:clients:read'], {
      autoSign: true,
      autoSignAuth: { ip: '10.0.0.1' },
    });
    expect(host.textContent).toContain('10.0.0.1');
    expect(host.textContent).not.toContain('Editar datos');
    expect(host.textContent).not.toContain('Desactivar');
    expect(host.textContent).not.toContain('Desvincular');
    expect(host.textContent).not.toContain('Vincular a una organización');
  });

  it('las pestañas dependen del permiso, sin pedidos que den 403', async () => {
    const host = await abrir(['platform:clients:read']);
    const pestanas = host.querySelector('db-underline-tabs')?.textContent ?? '';
    expect(pestanas).toContain('One Touch');
    expect(pestanas).not.toContain('Documentos');
    expect(pestanas).not.toContain('Historial');
  });

  it('con operaciones y plataforma aparecen Documentos e Historial', async () => {
    const host = await abrir(['platform:clients', 'platform:operations', 'platform:platform']);
    const pestanas = host.querySelector('db-underline-tabs')?.textContent ?? '';
    expect(pestanas).toContain('Documentos');
    expect(pestanas).toContain('Historial');
  });

  it('sin firma automática explica que no se activa desde la consola', async () => {
    const host = await abrir(['platform:clients:manage']);
    expect(host.textContent).toContain('no se enciende desde la consola');
    expect(host.textContent).not.toContain('Desactivar');
  });

  it('desactivar la firma automática manda el motivo y aplica la ficha', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Lo pidió el firmante',
    });
    const host = await abrir(['platform:clients:manage'], {
      autoSign: true,
      autoSignAuth: { ip: '10.0.0.1' },
    });
    pulsar(host, 'Desactivar');
    const pedido = await vi.waitFor(() => http.expectOne('/platform/signers/s1/auto-sign/disable'));
    expect(pedido.request.body).toEqual({ reason: 'Lo pidió el firmante' });
    pedido.flush(ficha());
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).not.toContain('10.0.0.1');
    });
  });

  it('cancelar el diálogo no desactiva', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({ answer: 'cancel' });
    const host = await abrir(['platform:clients:manage'], { autoSign: true });
    pulsar(host, 'Desactivar');
    await fixture.whenStable();
    http.expectNone('/platform/signers/s1/auto-sign/disable');
  });

  it('un firmante que no existe ofrece volver', async () => {
    conPermisos(['platform:clients:read']);
    fixture = TestBed.createComponent(SignerDetailComponent);
    fixture.componentRef.setInput('id', 's9');
    fixture.detectChanges();
    await fixture.whenStable();
    http
      .expectOne('/platform/signers/s9')
      .flush({ code: 'FIRMANTE_NO_ENCONTRADO' }, { status: 404, statusText: 'No' });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Este firmante no existe.');
    });
  });
});
