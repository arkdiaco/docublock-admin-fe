import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { mayHaveBeenSent, uncertainTotal } from '../data/campaign-failures';
import { CampaignDetailComponent } from './campaign-detail.component';

const LLAVE_CRUDA = /\b(comm|nav|common)\.[a-zA-Z]/;
const LEER = ['platform:catalogs'];
const GESTIONAR = ['platform:catalogs:manage'];
const BASE = '/platform/communications/whatsapp/campaigns/c1';

const CAMPANA = {
  id: 'c1',
  state: 'finished',
  text: 'Hola a todos',
  imageUrl: 'https://cdn.test/a.png',
  reason: 'Lanzamiento',
  duplicates: 3,
  retries: 0,
  createdAt: '2026-11-04T15:00:00.000Z',
  finishedAt: '2026-11-04T15:01:00.000Z',
  createdByName: 'Ada Paz',
  counts: { pending: 0, sending: 0, sent: 7, failed: 2, excluded: 1, total: 10 },
  failures: [
    { code: 'WHATSAPP_PROVIDER_FAILED', total: 1 },
    { code: 'ENVIO_INTERRUMPIDO', total: 1 },
  ],
};

const NUMEROS = {
  total: 3,
  items: [
    { id: 'r1', state: 'sent', source: 'number', phone: '+573000000001', name: 'Ana', messageId: 'wamid.1' },
    { id: 'r2', state: 'failed', source: 'user', phone: '+573000000002', name: 'Luis', error: 'WHATSAPP_PROVIDER_FAILED' },
    { id: 'r3', state: 'excluded', source: 'signer', rawPhone: '300', name: 'Eva', reason: 'SIN_INDICATIVO' },
  ],
};

describe('mayHaveBeenSent', () => {
  it('separa los rechazos seguros de los fallos inciertos', () => {
    expect(mayHaveBeenSent('WHATSAPP_PROVIDER_FAILED')).toBe(false);
    expect(mayHaveBeenSent('BLOCKED_URL')).toBe(false);
    expect(mayHaveBeenSent('COMMONS_400')).toBe(false);
    expect(mayHaveBeenSent('ENVIO_INTERRUMPIDO')).toBe(true);
    expect(mayHaveBeenSent('COMMONS_SIN_RESPUESTA')).toBe(true);
    expect(mayHaveBeenSent('COMMONS_500')).toBe(true);
    expect(mayHaveBeenSent('CODIGO_NUEVO')).toBe(true);
  });

  it('suma solo los inciertos', () => {
    expect(uncertainTotal(CAMPANA.failures)).toBe(1);
  });
});

describe('Ficha de un envío', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const abrir = (permisos: string[]): ComponentFixture<CampaignDetailComponent> => {
    conPermisos(permisos);
    const fixture = TestBed.createComponent(CampaignDetailComponent);
    fixture.componentRef.setInput('id', 'c1');
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

  const boton = (host: HTMLElement, texto: string): HTMLButtonElement =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

  const detalle = (): TestRequest => http.expectOne(BASE);
  const numeros = (): TestRequest => http.expectOne((req) => req.url.endsWith(`${BASE}/recipients`));

  const cargar = async (permisos: string[], campana: unknown = CAMPANA) => {
    const fixture = abrir(permisos);
    detalle().flush(campana as object);
    const host = await ver(fixture, 'Ada Paz');
    numeros().flush(NUMEROS);
    await ver(fixture, 'Luis');
    return { fixture, host };
  };

  it('muestra datos, conteos, motivos de falla y resultado por número', async () => {
    const { host } = await cargar(LEER);
    expect(host.textContent).toContain('Lanzamiento');
    expect(host.textContent).toContain('Hola a todos');
    expect(host.textContent).toContain('WhatsApp rechazó el mensaje');
    expect(host.textContent).toContain('Sin indicativo de país');
    expect(host.textContent).toContain('wamid.1');
    expect(host.textContent ?? '').not.toMatch(LLAVE_CRUDA);
  });

  it('un código desconocido se ve legible, sin llave cruda', async () => {
    const { host } = await cargar(LEER, { ...CAMPANA, failures: [{ code: 'COMMONS_500', total: 2 }] });
    expect(host.textContent).toContain('Otro error: COMMONS_500');
    expect(host.textContent ?? '').not.toMatch(LLAVE_CRUDA);
  });

  it('solo lectura no puede reenviar', async () => {
    const { host } = await cargar(LEER);
    expect(boton(host, 'Reenviar')).toBeUndefined();
  });

  it('sin fallidos no ofrece reenviar', async () => {
    const { host } = await cargar(GESTIONAR, {
      ...CAMPANA,
      failures: [],
      counts: { ...CAMPANA.counts, failed: 0, sent: 9 },
    });
    expect(boton(host, 'Reenviar')).toBeUndefined();
  });

  it('filtra por estado y busca', async () => {
    const { fixture, host } = await cargar(LEER);
    boton(host, 'Fallidos').click();
    const filtro = numeros();
    expect(filtro.request.params.get('state')).toBe('failed');
    filtro.flush({ total: 1, items: [NUMEROS.items[1]] });
    await ver(fixture, 'Luis');
    vi.useFakeTimers();
    try {
      const campo = host.querySelector('dba-campaign-recipients input[type=search]') as HTMLInputElement;
      campo.value = '3000';
      campo.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(400);
    } finally {
      vi.useRealTimers();
    }
    const busqueda = numeros();
    expect(busqueda.request.params.get('search')).toBe('3000');
    expect(busqueda.request.params.get('state')).toBe('failed');
    busqueda.flush({ total: 0, items: [] });
    await ver(fixture, 'Sin resultados');
  });

  it('avisa del posible duplicado, exige motivo y sigue el reenvío hasta terminar', async () => {
    const { fixture, host } = await cargar(GESTIONAR);
    boton(host, 'Reenviar a fallidos (2)').click();
    await ver(fixture, 'Se reenviará a 2 números.');
    const modal = host.querySelector('dba-retry-confirm') as HTMLElement;
    expect(modal.textContent).toContain('1 pudo haber salido');
    expect(boton(host, 'Reenviar ahora').disabled).toBe(true);
    const campo = modal.querySelector('dba-field input') as HTMLInputElement;
    campo.value = ' Otra vez ';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      boton(host, 'Reenviar ahora').click();
      boton(host, 'Reenviar ahora').click();
      const reintento = http.expectOne(`${BASE}/retry`);
      expect(reintento.request.body).toEqual({ reason: 'Otra vez' });
      reintento.flush({
        ...CAMPANA,
        failures: undefined,
        state: 'sending',
        retries: 1,
        counts: { ...CAMPANA.counts, failed: 0, pending: 2 },
      });
      await ver(fixture, 'Enviando');
      expect(host.querySelector('dba-retry-confirm')).toBeNull();
      numeros().flush(NUMEROS);
      await vi.advanceTimersByTimeAsync(3000);
      detalle().flush({ ...CAMPANA, retries: 1, failures: [], counts: { ...CAMPANA.counts, failed: 0, sent: 9 } });
      await ver(fixture, 'Envío terminado');
      numeros().flush(NUMEROS);
      await vi.advanceTimersByTimeAsync(9000);
      http.expectNone(BASE);
      expect(boton(host, 'Reenviar')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('si el reenvío no se puede confirmar avisa y vuelve a leer el estado', async () => {
    const { fixture, host } = await cargar(GESTIONAR);
    boton(host, 'Reenviar a fallidos').click();
    await ver(fixture, 'Se reenviará');
    const campo = host.querySelector('dba-retry-confirm dba-field input') as HTMLInputElement;
    campo.value = 'Motivo';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    boton(host, 'Reenviar ahora').click();
    http.expectOne(`${BASE}/retry`).flush({}, { status: 500, statusText: 'x' });
    await vi.waitFor(() => {
      expect(avisos).toHaveBeenCalledWith(
        expect.objectContaining({ detail: expect.stringContaining('confirmar') as string }),
      );
    });
    await vi.waitFor(() => detalle().flush(structuredClone(CAMPANA)));
    fixture.detectChanges();
    expect(host.querySelector('dba-retry-confirm')).toBeNull();
    await vi.waitFor(() => {
      fixture.detectChanges();
      numeros().flush(NUMEROS);
    });
  });

  it('mientras envía actualiza el avance y si falla la lectura lo dice y sigue', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const enviando = { ...CAMPANA, state: 'sending', failures: [], counts: { ...CAMPANA.counts, failed: 0, pending: 2 } };
      const { fixture, host } = await cargar(GESTIONAR, enviando);
      expect(boton(host, 'Reenviar')).toBeUndefined();
      await vi.advanceTimersByTimeAsync(3000);
      detalle().flush({}, { status: 500, statusText: 'x' });
      await ver(fixture, 'No se pudo actualizar');
      expect(host.textContent).toContain('Luis');
      await vi.advanceTimersByTimeAsync(3000);
      detalle().flush(CAMPANA);
      await ver(fixture, 'Envío terminado');
      numeros().flush(NUMEROS);
      expect(host.textContent).not.toContain('No se pudo actualizar');
      await vi.advanceTimersByTimeAsync(9000);
      http.expectNone(BASE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('una dirección sin envío lo dice y deja volver', async () => {
    const fixture = abrir(LEER);
    detalle().flush({ code: 'CAMPANA_NO_ENCONTRADA' }, { status: 404, statusText: 'x' });
    const host = await ver(fixture, 'Este envío no existe');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/catalogos/comunicaciones?vista=historial');
  });

  it('si falla la carga deja reintentar', async () => {
    const fixture = abrir(LEER);
    detalle().flush({}, { status: 500, statusText: 'x' });
    const host = await ver(fixture, 'No se pudo cargar el envío');
    boton(host, 'Reintentar').click();
    detalle().flush(CAMPANA);
    await ver(fixture, 'Ada Paz');
    numeros().flush(NUMEROS);
    await ver(fixture, 'Luis');
  });
});
