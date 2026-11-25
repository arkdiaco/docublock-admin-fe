import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { conPermisos, configurar, ficha } from '../pages/signers-test-kit';
import { SignerDocumentsTabComponent, signerStateOf } from './signer-documents-tab.component';
import { SignerIntegrationChangesTabComponent } from './signer-integration-changes-tab.component';
import { SignerLegalEntitiesTabComponent } from './signer-legal-entities-tab.component';
import { SignerOneTouchTabComponent } from './signer-one-touch-tab.component';
import { SignerOrganizationsTabComponent } from './signer-organizations-tab.component';

describe('Firmantes › Pestañas de la ficha', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  it('Empresas lista lo que representa con enlace a la entidad', async () => {
    conPermisos(['platform:clients']);
    const fixture = TestBed.createComponent(SignerLegalEntitiesTabComponent);
    fixture.componentRef.setInput('signerId', 's1');
    fixture.detectChanges();
    await fixture.whenStable();
    http
      .expectOne('/platform/legal-entities/by-signer/s1')
      .flush([
        {
          id: 'e1',
          businessName: 'Acme SAS',
          identification: '900',
          active: false,
          isLegalRep: true,
        },
      ]);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Acme SAS');
    });
    expect(host.textContent).toContain('Representante legal');
    expect(host.textContent).toContain('Inactiva');
    expect(host.textContent).not.toMatch(/\bsig\.[a-z]/);
  });

  it('Empresas vacía lo dice', async () => {
    conPermisos(['platform:clients']);
    const fixture = TestBed.createComponent(SignerLegalEntitiesTabComponent);
    fixture.componentRef.setInput('signerId', 's1');
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/platform/legal-entities/by-signer/s1').flush([]);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('No representa a ninguna empresa');
    });
  });

  describe('Cambios por integración', () => {
    const abrir = async () => {
      conPermisos(['platform:clients']);
      const fixture = TestBed.createComponent(SignerIntegrationChangesTabComponent);
      fixture.componentRef.setInput('signerId', 's1');
      fixture.detectChanges();
      await fixture.whenStable();
      return { fixture, host: fixture.nativeElement as HTMLElement };
    };

    it('muestra quién lo envió, cuándo y cada campo con su antes y después', async () => {
      const { fixture, host } = await abrir();
      const pedido = http.expectOne((req) => req.url === '/platform/signers/s1/changes');
      expect(pedido.request.params.get('page')).toBe('1');
      expect(pedido.request.params.get('limit')).toBe('20');
      pedido.flush({
        total: 2,
        items: [
          {
            id: 'l2',
            source: 'integracion',
            organization: { id: 'o1', name: 'Constructora Uno' },
            changes: [
              { field: 'email', before: 'vale@correo.co', after: 'valentina@correo.co' },
              { field: 'expeditionDate', after: '1995-06-13' },
            ],
            createdAt: '2026-11-25T15:30:00Z',
          },
          {
            id: 'l1',
            source: 'integracion',
            organization: { id: 'o2', name: null },
            changes: [{ field: 'firstName', before: 'Vale', after: 'Valentina' }],
            createdAt: '2026-11-24T10:00:00Z',
          },
        ],
      });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.textContent).toContain('Constructora Uno');
      });
      const texto = host.textContent ?? '';
      expect(texto).toContain('actualizó los datos por la integración');
      expect(texto).toContain('Correo');
      expect(texto).toContain('vale@correo.co');
      expect(texto).toContain('valentina@correo.co');
      expect(texto).toContain('Fecha de expedición');
      expect(texto).toContain('13/06/1995');
      expect(texto).toContain('Organización eliminada');
      expect(texto).toContain('25/11/2026 15:30 UTC');
      expect(texto).toContain('2 de 2');
      expect(texto).not.toMatch(/\bsig\.[a-z]/);
    });

    it('sin cambios lo explica', async () => {
      const { fixture, host } = await abrir();
      http
        .expectOne((req) => req.url === '/platform/signers/s1/changes')
        .flush({
          total: 0,
          items: [],
        });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.textContent).toContain('Sin cambios por integración');
      });
    });

    it('si falla deja reintentar', async () => {
      const { fixture, host } = await abrir();
      http
        .expectOne((req) => req.url === '/platform/signers/s1/changes')
        .flush({ code: 'X' }, { status: 500, statusText: 'Error' });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.textContent).toContain('No pudimos cargar los cambios por integración');
      });
    });
  });

  const pulsar = (host: HTMLElement, texto: string): void => {
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(texto))?.click();
  };

  describe('Organizaciones', () => {
    const abrir = (permisos: string[], over = {}) => {
      conPermisos(permisos);
      const fixture = TestBed.createComponent(SignerOrganizationsTabComponent);
      fixture.componentRef.setInput('signer', ficha(over));
      fixture.componentRef.setInput('signerName', 'Ana Ruiz');
      fixture.detectChanges();
      return { fixture, host: fixture.nativeElement as HTMLElement };
    };

    it('desvincular pide el documento, manda el motivo y avisa', async () => {
      const open = vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
        answer: 'confirm',
        reason: 'Salió de la empresa',
      });
      const { fixture, host } = abrir(['platform:clients:manage']);
      const cambios: unknown[] = [];
      fixture.componentInstance.changed.subscribe((value) => cambios.push(value));
      pulsar(host, 'Desvincular');
      const pedido = await vi.waitFor(() =>
        http.expectOne('/platform/signers/s1/organizations/o1'),
      );
      expect(open.mock.calls[0][0].challenge?.identifier).toBe('1032456789');
      expect(pedido.request.method).toBe('DELETE');
      expect(pedido.request.body).toEqual({ reason: 'Salió de la empresa' });
      pedido.flush(ficha({ organizations: [] }));
      await vi.waitFor(() => expect(cambios).toHaveLength(1));
    });

    it('un error conocido se dice con su mensaje y no aplica cambios', async () => {
      vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
        answer: 'confirm',
        reason: 'x',
      });
      const { fixture, host } = abrir(['platform:clients:manage']);
      const cambios: unknown[] = [];
      fixture.componentInstance.changed.subscribe((value) => cambios.push(value));
      pulsar(host, 'Desvincular');
      const pedido = await vi.waitFor(() =>
        http.expectOne('/platform/signers/s1/organizations/o1'),
      );
      pedido.flush({ code: 'FIRMANTE_NO_VINCULADO' }, { status: 409, statusText: 'No' });
      await fixture.whenStable();
      expect(cambios).toEqual([]);
    });

    it('sin organizaciones lo explica', () => {
      const { host } = abrir(['platform:clients:read'], { organizations: [] });
      expect(host.textContent).toContain('Sin organizaciones.');
    });
  });

  describe('Documentos', () => {
    it('pide los documentos de la identidad y muestra el estado del firmante', async () => {
      const fixture = TestBed.createComponent(SignerDocumentsTabComponent);
      fixture.componentRef.setInput('identityId', 'i1');
      fixture.detectChanges();
      await fixture.whenStable();
      const pedido = http.expectOne((req) => req.url === '/platform/documents');
      expect(pedido.request.params.get('identity')).toBe('i1');
      pedido.flush({
        total: 1,
        items: [
          {
            id: 'd1',
            name: 'Contrato',
            organization: { id: 'o1', businessName: 'Notaría Central' },
            status: { state: 0, progress: 1 },
            signer: { identityId: 'i1', checked: false, signingAttempts: 3, blocked: true },
          },
        ],
      });
      const host = fixture.nativeElement as HTMLElement;
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.textContent).toContain('Contrato');
      });
      expect(host.textContent).toContain('Bloqueado');
      expect(host.textContent).toContain('3 intentos');
    });

    it('sin identidad no pide nada y lo explica', async () => {
      const fixture = TestBed.createComponent(SignerDocumentsTabComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Sin identidad de firma.',
      );
    });

    it('bloqueado pesa más que firmado', () => {
      const fila = (signer: { checked: boolean; blocked: boolean }) => ({
        id: 'd',
        name: 'd',
        organization: { id: 'o' },
        status: { state: 0, progress: 1 },
        signer: { identityId: 'i', signingAttempts: 0, ...signer },
      });
      expect(signerStateOf(fila({ checked: true, blocked: true })).labelKey).toContain('blocked');
      expect(signerStateOf(fila({ checked: true, blocked: false })).labelKey).toContain('signed');
      expect(signerStateOf(fila({ checked: false, blocked: false })).labelKey).toContain('pending');
    });
  });

  describe('One Touch', () => {
    const abrir = async (
      permisos: string[],
      estado: { enabled: boolean; credentials: unknown[] },
      texto: string,
    ) => {
      conPermisos(permisos);
      const fixture = TestBed.createComponent(SignerOneTouchTabComponent);
      fixture.componentRef.setInput('signerId', 's1');
      fixture.componentRef.setInput('signerName', 'Ana Ruiz');
      fixture.detectChanges();
      await fixture.whenStable();
      http.expectOne('/platform/signers/s1/one-touch').flush(estado);
      const host = fixture.nativeElement as HTMLElement;
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.textContent).toContain(texto);
      });
      return { fixture, host };
    };

    const LLAVE = { credentialId: 'c/1', deviceName: 'iPhone', backedUp: true };

    it('avisa del indicador encendido sin llaves', async () => {
      await abrir(['platform:clients:read'], { enabled: true, credentials: [] }, 'no tiene llaves');
    });

    it('sin permiso de administrar las llaves se ven pero no se revocan', async () => {
      const { host } = await abrir(
        ['platform:clients:read'],
        { enabled: true, credentials: [LLAVE] },
        'iPhone',
      );
      expect(host.querySelector('button')).toBeNull();
    });

    it('revocar manda el motivo, codifica la llave y avisa a la ficha', async () => {
      vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
        answer: 'confirm',
        reason: 'Teléfono perdido',
      });
      const { fixture, host } = await abrir(
        ['platform:clients:manage'],
        { enabled: true, credentials: [LLAVE] },
        'iPhone',
      );
      let avisos = 0;
      fixture.componentInstance.changed.subscribe(() => (avisos += 1));
      pulsar(host, 'Revocar');
      const pedido = await vi.waitFor(() =>
        http.expectOne('/platform/signers/s1/one-touch/credentials/c%2F1'),
      );
      expect(pedido.request.body).toEqual({ reason: 'Teléfono perdido' });
      pedido.flush({ enabled: false, credentials: [] });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.textContent).toContain('Sin llaves de One Touch.');
      });
      expect(avisos).toBe(1);
    });
  });
});
