import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import type { LegalEntityDetail } from '../data/legal-entities.models';
import { LegalEntityDetailComponent } from './legal-entity-detail.component';
import { conPermisos, configurar, ficha } from './legal-entities-test-kit';

describe('Entidades jurídicas › Ficha', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<LegalEntityDetailComponent>;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const abrir = async (permisos: string[], over: Partial<LegalEntityDetail> = {}) => {
    conPermisos(permisos);
    fixture = TestBed.createComponent(LegalEntityDetailComponent);
    fixture.componentRef.setInput('id', 'e1');
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/platform/legal-entities/e1').flush(ficha(over));
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Ana Ruiz');
    });
    return host;
  };

  const pulsar = (host: HTMLElement, texto: string): void => {
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))?.click();
  };

  it('con solo lectura se ve todo y no hay acciones ni historial', async () => {
    const host = await abrir(['platform:clients']);
    expect(host.textContent).toContain('Persona Juridica');
    expect(host.textContent).toContain('Representante legal');
    expect(host.textContent).toContain('En el firmante');
    expect(host.textContent).toContain('Ver firmante');
    expect(host.textContent).not.toContain('Editar datos');
    expect(host.textContent).not.toContain('Desactivar');
    expect(host.textContent).not.toContain('Agregar representante');
    expect(host.querySelector('[aria-label^="Acciones de"]')).toBeNull();
    expect(host.textContent).not.toContain('Historial');
    expect(host.textContent).not.toMatch(/\bjur\.[a-z]/);
  });

  it('con permiso de plataforma aparece el historial', async () => {
    const host = await abrir(['platform:clients', 'platform:platform']);
    expect(host.textContent).toContain('Historial');
  });

  it('desactivar pide motivo y envía a la ruta', async () => {
    const dialogs = TestBed.inject(DialogService);
    const abrirDialogo = vi
      .spyOn(dialogs, 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Cerrada' });
    const host = await abrir(['platform:clients:manage']);
    pulsar(host, 'Desactivar');
    const pedido = await vi.waitFor(() => http.expectOne('/platform/legal-entities/e1/deactivate'));
    expect(abrirDialogo).toHaveBeenCalled();
    expect(pedido.request.body).toEqual({ reason: 'Cerrada' });
    pedido.flush(ficha({ active: false }));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Activar');
    });
  });

  it('cancelar el diálogo no llama a nadie', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({ answer: 'cancel' });
    const host = await abrir(['platform:clients:manage'], { active: false });
    pulsar(host, 'Activar');
    await fixture.whenStable();
    http.expectNone('/platform/legal-entities/e1/activate');
  });

  it('una entidad que no existe lo dice', async () => {
    conPermisos(['platform:clients']);
    fixture = TestBed.createComponent(LegalEntityDetailComponent);
    fixture.componentRef.setInput('id', 'e9');
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/platform/legal-entities/e9').flush({}, { status: 404, statusText: 'No' });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Esta entidad no existe');
    });
  });
});
