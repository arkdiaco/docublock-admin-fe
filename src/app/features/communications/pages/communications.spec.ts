import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { parseNumbers, toggled, withAll } from '../data/recipient-selection';
import { CommunicationsComponent } from './communications.component';

const LLAVE_CRUDA = /\b(comm|nav|common)\.[a-zA-Z]/;
const LEER = ['platform:catalogs'];
const GESTIONAR = ['platform:catalogs:manage'];
const FILAS = {
  total: 42,
  items: [
    { id: 'u1', name: 'Ana Ruiz', phone: '+573000000001', email: 'ana@x.co' },
    { id: 'u2', name: 'Luis Gómez', phone: '3001234567', phoneIssue: 'SIN_INDICATIVO' },
  ],
};

const elegirImagen = (host: HTMLElement, file: File): void => {
  const campo = host.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(campo, 'files', { value: [file], configurable: true });
  campo.dispatchEvent(new Event('change'));
};

describe('parseNumbers', () => {
  it('lee un número por línea con nombre opcional y separa por la primera coma', () => {
    expect(
      parseNumbers('+573001234567, Ana, de Ventas\n\n  +573001234568 \n3001;Luis\n5\tEva\n, solo nombre'),
    ).toEqual([
      { phone: '+573001234567', name: 'Ana, de Ventas' },
      { phone: '+573001234568' },
      { phone: '3001', name: 'Luis' },
      { phone: '5', name: 'Eva' },
    ]);
  });

  it('recorta lo que el servidor rechazaría completo', () => {
    const [largo] = parseNumbers(`${'1'.repeat(60)},${'n'.repeat(200)}`);
    expect(largo.phone).toHaveLength(40);
    expect(largo.name).toHaveLength(120);
  });
});

describe('selección', () => {
  it('marca y desmarca sin tocar el conjunto original', () => {
    const base = new Set(['a']);
    expect([...toggled(base, 'b')]).toEqual(['a', 'b']);
    expect([...toggled(base, 'a')]).toEqual([]);
    expect([...base]).toEqual(['a']);
  });

  it('no pasa del tope', () => {
    const muchos = Array.from({ length: 10_005 }, (_, n) => `id${n}`);
    expect(withAll(new Set(), muchos).size).toBe(10_000);
  });
});

describe('Comunicaciones', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const abrir = (permisos: string[]): ComponentFixture<CommunicationsComponent> => {
    conPermisos(permisos);
    const fixture = TestBed.createComponent(CommunicationsComponent);
    fixture.detectChanges();
    return fixture;
  };

  const ver = async (fixture: ComponentFixture<unknown>, texto: string): Promise<HTMLElement> => {
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain(texto);
    });
    return host;
  };

  const lista = (kind = 'user') =>
    http.expectOne((req) => req.url.endsWith('/platform/communications/recipients') && req.params.get('kind') === kind);

  const boton = (host: HTMLElement, texto: string): HTMLButtonElement =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

  it('solo lectura: busca y revisa, sin subir imagen ni llaves crudas', async () => {
    const fixture = abrir(LEER);
    lista().flush(FILAS);
    const host = await ver(fixture, 'Ana Ruiz');
    expect(host.textContent).toContain('Sin indicativo');
    expect(host.textContent).not.toContain('Subir imagen');
    expect(host.textContent ?? '').not.toMatch(LLAVE_CRUDA);
  });

  it('marca, revisa y muestra enviables y no enviables', async () => {
    const fixture = abrir(LEER);
    lista().flush(FILAS);
    const host = await ver(fixture, 'Ana Ruiz');
    expect(boton(host, 'Revisar').disabled).toBe(true);
    boton(host, 'Marcar esta página').click();
    fixture.detectChanges();
    boton(host, 'Revisar').click();
    const peticion = http.expectOne('/platform/communications/whatsapp/preview');
    expect(peticion.request.body).toEqual({ userIds: ['u1', 'u2'], signerIds: [], numbers: [] });
    peticion.flush({
      sendable: [{ source: 'user', sourceId: 'u1', phone: '+573000000001', name: 'Ana Ruiz' }],
      excluded: [{ source: 'user', sourceId: 'u2', rawPhone: '3001234567', name: 'Luis Gómez', reason: 'SIN_INDICATIVO' }],
      duplicates: 0,
    });
    await ver(fixture, 'Se pueden enviar');
    boton(host, 'No enviables').click();
    await ver(fixture, 'Sin indicativo');
    expect(host.textContent ?? '').not.toMatch(LLAVE_CRUDA);
  });

  it('avisa si la selección cambió después de revisar', async () => {
    const fixture = abrir(LEER);
    lista().flush(FILAS);
    const host = await ver(fixture, 'Ana Ruiz');
    boton(host, 'Marcar esta página').click();
    fixture.detectChanges();
    boton(host, 'Revisar').click();
    http.expectOne('/platform/communications/whatsapp/preview').flush({ sendable: [], excluded: [], duplicates: 0 });
    await ver(fixture, 'Se pueden enviar');
    expect(host.textContent).not.toContain('Vuelve a revisar');
    (host.querySelector('dba-check input') as HTMLInputElement).dispatchEvent(new Event('change'));
    await ver(fixture, 'Vuelve a revisar');
  });

  it('marcar todos recorre las páginas de la búsqueda', async () => {
    const fixture = abrir(LEER);
    lista().flush({ ...FILAS, total: 150 });
    const host = await ver(fixture, 'Ana Ruiz');
    boton(host, 'Marcar los 150').click();
    const primera = http.expectOne((req) => req.params.get('limit') === '100' && req.params.get('page') === '1');
    primera.flush({ total: 150, items: Array.from({ length: 100 }, (_, n) => ({ id: `a${n}`, name: 'x' })) });
    await vi.waitFor(() => {
      http
        .expectOne((req) => req.params.get('limit') === '100' && req.params.get('page') === '2')
        .flush({ total: 150, items: Array.from({ length: 50 }, (_, n) => ({ id: `b${n}`, name: 'x' })) });
    });
    await ver(fixture, 'Quitar los 150');
  });

  it('los números pegados cuentan en su pestaña y van a la revisión', async () => {
    const fixture = abrir(LEER);
    lista().flush(FILAS);
    const host = await ver(fixture, 'Ana Ruiz');
    boton(host, 'Números').click();
    fixture.detectChanges();
    const area = host.querySelector('textarea') as HTMLTextAreaElement;
    area.value = '+573001234567, Ana\n+573001234568';
    area.dispatchEvent(new Event('input'));
    const nombre = host.querySelector('dba-field input') as HTMLInputElement;
    nombre.value = ' Cliente ';
    nombre.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(host, 'Revisar').click();
    const peticion = http.expectOne('/platform/communications/whatsapp/preview');
    expect(peticion.request.body).toEqual({
      userIds: [],
      signerIds: [],
      numbers: [{ phone: '+573001234567', name: 'Ana' }, { phone: '+573001234568' }],
      defaultName: 'Cliente',
    });
    peticion.flush({ sendable: [], excluded: [], duplicates: 0 });
    await ver(fixture, 'Se pueden enviar');
  });

  it('si la revisión falla lo dice', async () => {
    const fixture = abrir(LEER);
    lista().flush(FILAS);
    const host = await ver(fixture, 'Ana Ruiz');
    boton(host, 'Marcar esta página').click();
    fixture.detectChanges();
    boton(host, 'Revisar').click();
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    http.expectOne('/platform/communications/whatsapp/preview').flush({}, { status: 500, statusText: 'x' });
    await vi.waitFor(() => expect(avisos).toHaveBeenCalled());
  });

  describe('imagen', () => {
    const elegir = elegirImagen;

    it('sube el archivo y muestra la miniatura', async () => {
      const fixture = abrir(GESTIONAR);
      lista().flush(FILAS);
      const host = await ver(fixture, 'Subir imagen');
      elegir(host, new File(['x'], 'a.png', { type: 'image/png' }));
      const peticion = http.expectOne('/platform/communications/whatsapp/image');
      expect(peticion.request.body).toBeInstanceOf(FormData);
      peticion.flush({ id: 'k', url: 'https://cdn.test/a.png' });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.querySelector('dba-campaign-image img')?.getAttribute('src')).toMatch(/^data:image\/png/);
      });
    });

    it('rechaza sin llamar al servidor lo que no es PNG o JPG, o pasa de 5 MB', async () => {
      const fixture = abrir(GESTIONAR);
      lista().flush(FILAS);
      const host = await ver(fixture, 'Subir imagen');
      elegir(host, new File(['x'], 'a.gif', { type: 'image/gif' }));
      await ver(fixture, 'PNG o JPG');
      elegir(host, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }));
      await ver(fixture, 'supera los 5 MB');
    });

    it('muestra el motivo si el servidor la rechaza', async () => {
      const fixture = abrir(GESTIONAR);
      lista().flush(FILAS);
      const host = await ver(fixture, 'Subir imagen');
      elegir(host, new File(['x'], 'a.png', { type: 'image/png' }));
      http
        .expectOne('/platform/communications/whatsapp/image')
        .flush({ code: 'ALMACENAMIENTO_NO_DISPONIBLE' }, { status: 503, statusText: 'x' });
      await ver(fixture, 'No se pudo subir');
    });
  });

  describe('envío', () => {
    const IMG = { id: 'k', url: 'https://cdn.test/a.png' };
    const REVISION = {
      sendable: [{ source: 'number', phone: '+573001234567', name: 'Ana' }],
      excluded: [{ source: 'number', rawPhone: '300', reason: 'SIN_INDICATIVO' }],
      duplicates: 0,
    };
    const CAMPANA = {
      id: 'c1',
      state: 'queued',
      duplicates: 0,
      counts: { pending: 1, sending: 0, sent: 0, failed: 0, excluded: 1, total: 2 },
    };

    const preparar = async (fixture: ComponentFixture<CommunicationsComponent>): Promise<HTMLElement> => {
      lista().flush(FILAS);
      const host = await ver(fixture, 'Ana Ruiz');
      boton(host, 'Números').click();
      fixture.detectChanges();
      const numeros = host.querySelector('dba-text-area textarea') as HTMLTextAreaElement;
      numeros.value = '+573001234567, Ana\n300';
      numeros.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      elegirImagen(host, new File(['x'], 'a.png', { type: 'image/png' }));
      http.expectOne('/platform/communications/whatsapp/image').flush(IMG);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.querySelector('dba-campaign-image img')).toBeTruthy();
      });
      const texto = [...host.querySelectorAll('textarea')].at(-1) as HTMLTextAreaElement;
      texto.value = 'Hola\ncon   salto';
      texto.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      return host;
    };

    const abrirConfirmacion = async (
      fixture: ComponentFixture<CommunicationsComponent>,
      host: HTMLElement,
    ): Promise<void> => {
      boton(host, 'Preparar envío').click();
      http.expectOne('/platform/communications/whatsapp/preview').flush(REVISION);
      await ver(fixture, 'Confirmar envío');
    };

    const confirmar = (host: HTMLElement): HTMLButtonElement => boton(host, 'Enviar ahora');

    const motivo = (host: HTMLElement, fixture: ComponentFixture<unknown>, valor: string): void => {
      const campo = host.querySelector('dba-send-confirm dba-field input') as HTMLInputElement;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('solo lectura no ve el mensaje ni el envío', async () => {
      const fixture = abrir(LEER);
      lista().flush(FILAS);
      const host = await ver(fixture, 'Ana Ruiz');
      expect(boton(host, 'Preparar envío')).toBeUndefined();
    });

    it('dice qué falta antes de preparar', async () => {
      const fixture = abrir(GESTIONAR);
      lista().flush(FILAS);
      const host = await ver(fixture, 'Ana Ruiz');
      expect(boton(host, 'Preparar envío').disabled).toBe(true);
      expect(host.textContent).toContain('Falta: destinatarios, imagen, texto');
    });

    it('muestra lo que saldrá, con el texto limpio', async () => {
      const fixture = abrir(GESTIONAR);
      const host = await preparar(fixture);
      const vista = host.querySelector('dba-message-preview') as HTMLElement;
      expect(vista.textContent).toContain('Hola con salto');
      expect(vista.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png/);
    });

    it('confirma con cifras y aviso, y sin motivo no envía', async () => {
      const fixture = abrir(GESTIONAR);
      const host = await preparar(fixture);
      await abrirConfirmacion(fixture, host);
      const modal = host.querySelector('dba-send-confirm') as HTMLElement;
      expect(modal.textContent).toContain('Se enviará a 1 destinatario.');
      expect(modal.textContent).toContain('1 queda fuera');
      expect(modal.textContent).toContain('autorización');
      expect(confirmar(host).disabled).toBe(true);
      expect(host.textContent ?? '').not.toMatch(LLAVE_CRUDA);
    });

    it('cuenta en plural a los que quedan fuera', async () => {
      const fixture = abrir(GESTIONAR);
      const host = await preparar(fixture);
      boton(host, 'Preparar envío').click();
      http.expectOne('/platform/communications/whatsapp/preview').flush({
        ...REVISION,
        excluded: [...REVISION.excluded, { source: 'number', rawPhone: '301', reason: 'SIN_INDICATIVO' }],
      });
      await ver(fixture, 'Confirmar envío');
      expect(host.querySelector('dba-send-confirm')?.textContent).toContain('2 quedan fuera');
    });

    it('envía el texto limpio, la imagen pública y el motivo, una sola vez', async () => {
      const fixture = abrir(GESTIONAR);
      const host = await preparar(fixture);
      await abrirConfirmacion(fixture, host);
      motivo(host, fixture, ' Lanzamiento ');
      confirmar(host).click();
      confirmar(host).click();
      const peticion = http.expectOne('/platform/communications/whatsapp/campaigns');
      expect(peticion.request.body).toEqual({
        userIds: [],
        signerIds: [],
        numbers: [{ phone: '+573001234567', name: 'Ana' }, { phone: '300' }],
        text: 'Hola con salto',
        imageUrl: IMG.url,
        reason: 'Lanzamiento',
      });
      peticion.flush({ ...CAMPANA, state: 'finished', counts: { ...CAMPANA.counts, pending: 0, sent: 1 } });
      await ver(fixture, 'Envío terminado');
      expect(boton(host, 'Preparar envío')).toBeUndefined();
    });

    it('si hay fallo incierto avisa y deja la confirmación abierta', async () => {
      const fixture = abrir(GESTIONAR);
      const host = await preparar(fixture);
      await abrirConfirmacion(fixture, host);
      motivo(host, fixture, 'Motivo');
      const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
      confirmar(host).click();
      http.expectOne('/platform/communications/whatsapp/campaigns').flush({}, { status: 500, statusText: 'x' });
      await vi.waitFor(() =>
        expect(avisos).toHaveBeenCalledWith(
          expect.objectContaining({ detail: expect.stringContaining('verifica') as string }),
        ),
      );
      fixture.detectChanges();
      expect(host.querySelector('dba-send-confirm')).toBeTruthy();
    });

    it('si nadie se puede enviar no abre la confirmación', async () => {
      const fixture = abrir(GESTIONAR);
      const host = await preparar(fixture);
      boton(host, 'Preparar envío').click();
      http
        .expectOne('/platform/communications/whatsapp/preview')
        .flush({ sendable: [], excluded: REVISION.excluded, duplicates: 0 });
      await ver(fixture, 'Se pueden enviar');
      expect(host.querySelector('dba-send-confirm')).toBeNull();
    });

    it('sigue el avance hasta terminar y deja empezar otro envío limpio', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const fixture = abrir(GESTIONAR);
        const host = await preparar(fixture);
        await abrirConfirmacion(fixture, host);
        motivo(host, fixture, 'Motivo');
        confirmar(host).click();
        http.expectOne('/platform/communications/whatsapp/campaigns').flush(CAMPANA);
        await ver(fixture, 'Enviando');
        await vi.advanceTimersByTimeAsync(3000);
        http.expectOne('/platform/communications/whatsapp/campaigns/c1').flush({
          ...CAMPANA,
          state: 'sending',
          counts: { ...CAMPANA.counts, pending: 0, sending: 1 },
        });
        await vi.advanceTimersByTimeAsync(3000);
        http.expectOne('/platform/communications/whatsapp/campaigns/c1').flush({
          ...CAMPANA,
          state: 'finished',
          counts: { ...CAMPANA.counts, pending: 0, failed: 1 },
        });
        await ver(fixture, 'Envío terminado');
        await vi.advanceTimersByTimeAsync(9000);
        http.expectNone('/platform/communications/whatsapp/campaigns/c1');
        boton(host, 'Nuevo envío').click();
        fixture.detectChanges();
        lista().flush(FILAS);
        await ver(fixture, 'Ana Ruiz');
        expect(boton(host, 'Preparar envío').disabled).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('si no puede actualizar lo dice y sigue intentando', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const fixture = abrir(GESTIONAR);
        const host = await preparar(fixture);
        await abrirConfirmacion(fixture, host);
        motivo(host, fixture, 'Motivo');
        confirmar(host).click();
        http.expectOne('/platform/communications/whatsapp/campaigns').flush(CAMPANA);
        await ver(fixture, 'Enviando');
        await vi.advanceTimersByTimeAsync(3000);
        http.expectOne('/platform/communications/whatsapp/campaigns/c1').flush({}, { status: 500, statusText: 'x' });
        await ver(fixture, 'No se pudo actualizar');
        await vi.advanceTimersByTimeAsync(3000);
        http
          .expectOne('/platform/communications/whatsapp/campaigns/c1')
          .flush({ ...CAMPANA, state: 'finished', counts: { ...CAMPANA.counts, pending: 0, sent: 1 } });
        await ver(fixture, 'Envío terminado');
        expect(host.textContent).not.toContain('No se pudo actualizar');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
