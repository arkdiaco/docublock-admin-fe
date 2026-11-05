import { HttpErrorResponse } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { durationOf, jobMetricsOf, jobStateOf } from '../data/job-view';
import { pauseJobErrorKey, runJobErrorKey } from '../data/tasks.api';
import type { FinishedJobRun, JobPause, JobView } from '../data/tasks.models';
import { JOB_POLL_MS, JobsComponent } from './jobs.component';

const LLAVE_CRUDA = /\b(task|nav|common)\.[a-zA-Z]/;
const BASE = '/platform/tasks/jobs';

const CORRIDA: FinishedJobRun = {
  startedAt: '2026-11-04T10:00:00.000Z',
  finishedAt: '2026-11-04T10:00:02.000Z',
  durationMs: 2000,
  trigger: 'schedule',
  result: 'ok',
  metrics: { scanned: 3, failed: 0 },
  error: null,
};

const job = (overrides: Partial<JobView> & Pick<JobView, 'key'>): JobView => ({
  enabled: true,
  manual: false,
  running: null,
  last: null,
  lastFailure: null,
  pause: null,
  ...overrides,
});

const PAUSA: JobPause = {
  at: '2026-11-05T15:00:00.000Z',
  adminName: 'Ana Ops',
  reason: 'Cierres duplicados',
};

const TRABAJOS: JobView[] = [
  job({ key: 'closing', last: CORRIDA }),
  job({ key: 'seals', manual: true, last: { ...CORRIDA, result: 'failed', metrics: {}, error: 'El cofre no respondió' } }),
  job({ key: 'payments', manual: true, enabled: false }),
  job({ key: 'planReminders', manual: true }),
];

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const montar = async (
  permisos: string[],
  trabajos: JobView[] = TRABAJOS,
): Promise<{ fixture: ComponentFixture<JobsComponent>; http: HttpTestingController; root: HTMLElement }> => {
  const http = await configurar();
  conPermisos(permisos);
  const fixture = TestBed.createComponent(JobsComponent);
  http.expectOne(BASE).flush({ jobs: trabajos });
  await asentar(fixture);
  return { fixture, http, root: fixture.nativeElement as HTMLElement };
};

const abrir = (root: HTMLElement, indice: number): void => {
  root.querySelectorAll<HTMLButtonElement>('button.bl-row')[indice].click();
};

const botonCon = (texto: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === texto);

const escribirMotivo = async (fixture: ComponentFixture<unknown>, motivo: string): Promise<void> => {
  const campo = document.querySelector<HTMLInputElement>('.form input, .form textarea');
  if (!campo) throw new Error('Falta el campo de motivo');
  campo.value = motivo;
  campo.dispatchEvent(new Event('input'));
  await asentar(fixture);
};

describe('Tareas: trabajos automáticos', () => {
  it('lista cada trabajo con su resultado, sin llaves crudas', async () => {
    const { root } = await montar(['platform:operations']);
    const texto = root.textContent ?? '';
    expect(root.querySelectorAll('button.bl-row')).toHaveLength(4);
    expect(texto).toContain('Sellos de títulos');
    expect(texto).toContain('Cada 5 minutos');
    expect(texto).toContain('Correcto');
    expect(texto).toContain('Falló');
    expect(texto).toContain('Apagado');
    expect(texto).toContain('Sin registro');
    expect(texto).toContain('Revisados 3');
    expect(texto).toContain('El cofre no respondió');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('muestra error con reintento si la lista falla', async () => {
    const http = await configurar();
    conPermisos(['platform:operations']);
    const fixture = TestBed.createComponent(JobsComponent);
    http.expectOne(BASE).flush({}, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No pudimos cargar los trabajos');
  });

  it('sin permiso de administrar no ofrece ejecutar', async () => {
    const { fixture, root } = await montar(['platform:operations']);
    abrir(root, 1);
    await asentar(fixture);
    expect(botonCon('Ejecutar ahora')).toBeUndefined();
    expect(botonCon('Cerrar')).toBeDefined();
  });

  it('una corrida fallida muestra su error y no dice que no había nada que hacer', async () => {
    const { fixture, root } = await montar(
      ['platform:operations'],
      [
        job({
          key: 'seals',
          manual: true,
          last: { ...CORRIDA, result: 'failed', metrics: {}, error: 'El cofre no respondió' },
          lastFailure: { at: CORRIDA.finishedAt, error: 'El cofre no respondió' },
        }),
      ],
    );
    abrir(root, 0);
    await asentar(fixture);
    const detalle = document.querySelector('dba-job-detail')?.textContent ?? '';
    expect(detalle).toContain('Último fallo');
    expect(detalle).toContain('El cofre no respondió');
    expect(detalle).not.toContain('Sin nada que hacer');
  });

  it('un trabajo sin salida manual no ofrece ejecutar y lo explica', async () => {
    const { fixture, root } = await montar(['platform:operations:manage']);
    abrir(root, 0);
    await asentar(fixture);
    expect(botonCon('Ejecutar ahora')).toBeUndefined();
    expect(document.body.textContent).toContain('Este trabajo solo corre en su horario.');
  });

  it('no deja ejecutar mientras el trabajo está corriendo', async () => {
    const { fixture, root } = await montar(
      ['platform:operations:manage'],
      [job({ key: 'seals', manual: true, running: { since: CORRIDA.startedAt, trigger: 'manual' } })],
    );
    abrir(root, 0);
    await asentar(fixture);
    expect(botonCon('Ejecutar ahora')?.disabled).toBe(true);
  });

  it('avisa que el recordatorio llega a personas reales y exige motivo', async () => {
    const { fixture, root } = await montar(['platform:operations:manage']);
    abrir(root, 3);
    await asentar(fixture);
    botonCon('Ejecutar ahora')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('Los mensajes llegan a personas reales.');
    expect(botonCon('Ejecutar')?.disabled).toBe(true);
  });

  it('avisa si el trabajo está apagado en el ambiente y deja seguir', async () => {
    const { fixture, root } = await montar(['platform:operations:manage']);
    abrir(root, 2);
    await asentar(fixture);
    botonCon('Ejecutar ahora')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('Este trabajo está apagado en este ambiente');
  });

  it('ejecuta con el motivo y sigue la corrida hasta que termina', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    abrir(root, 1);
    await asentar(fixture);
    botonCon('Ejecutar ahora')?.click();
    await asentar(fixture);
    const campo = document.querySelector<HTMLInputElement>('.form input, .form textarea');
    if (!campo) throw new Error('Falta el campo de motivo');
    campo.value = 'Revisión de sellos';
    campo.dispatchEvent(new Event('input'));
    await asentar(fixture);

    vi.useFakeTimers();
    try {
      botonCon('Ejecutar')?.click();
      const envio = http.expectOne(`${BASE}/seals/run`);
      expect(envio.request.body).toEqual({ reason: 'Revisión de sellos' });
      envio.flush({ key: 'seals', state: 'running' });
      await vi.advanceTimersByTimeAsync(0);
      http
        .expectOne(BASE)
        .flush({ jobs: [job({ key: 'seals', manual: true, running: { since: CORRIDA.startedAt, trigger: 'manual' } })] });
      await vi.advanceTimersByTimeAsync(JOB_POLL_MS);
      http.expectOne(BASE).flush({ jobs: [job({ key: 'seals', manual: true, last: CORRIDA })] });
      await vi.advanceTimersByTimeAsync(JOB_POLL_MS * 2);
      http.expectNone(BASE);
    } finally {
      vi.useRealTimers();
    }
    http.verify();
  });
});

describe('Tareas: pausar y reanudar trabajos', () => {
  it('un trabajo en pausa lo dice en la lista y el detalle cuenta quién, cuándo y por qué', async () => {
    const { fixture, root } = await montar(
      ['platform:operations'],
      [job({ key: 'closing', last: CORRIDA, pause: PAUSA }), job({ key: 'purge', pause: { ...PAUSA, adminName: null } })],
    );
    expect(root.textContent).toContain('En pausa');
    abrir(root, 0);
    await asentar(fixture);
    const detalle = document.querySelector('dba-job-detail')?.textContent ?? '';
    expect(detalle).toContain('En pausa desde');
    expect(detalle).toContain('Ana Ops');
    expect(detalle).toContain('Cierres duplicados');
    expect(detalle).not.toMatch(LLAVE_CRUDA);
    botonCon('Cerrar')?.click();
    await asentar(fixture);
    abrir(root, 1);
    await asentar(fixture);
    expect(document.querySelector('dba-job-detail')?.textContent).toContain('Persona ya sin acceso');
  });

  it('solo quien administra la plataforma ve pausar', async () => {
    const soporte = await montar(['platform:operations', 'platform:operations:manage']);
    abrir(soporte.root, 0);
    await asentar(soporte.fixture);
    expect(botonCon('Pausar')).toBeUndefined();
    TestBed.resetTestingModule();
    const admin = await montar(['platform:operations', 'platform:platform:manage']);
    abrir(admin.root, 0);
    await asentar(admin.fixture);
    expect(botonCon('Pausar')).toBeDefined();
  });

  it('un trabajo apagado por el ambiente no ofrece pausar, pero si quedó en pausa se puede reanudar', async () => {
    const { fixture, root } = await montar(
      ['platform:platform:manage'],
      [job({ key: 'payments', manual: true, enabled: false }), job({ key: 'seals', enabled: false, pause: PAUSA })],
    );
    abrir(root, 0);
    await asentar(fixture);
    expect(botonCon('Pausar')).toBeUndefined();
    botonCon('Cerrar')?.click();
    await asentar(fixture);
    abrir(root, 1);
    await asentar(fixture);
    expect(botonCon('Reanudar')).toBeDefined();
  });

  it('pausar el cierre avisa del riesgo, exige motivo y recarga la lista', async () => {
    const { fixture, http, root } = await montar(['platform:operations', 'platform:platform:manage']);
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    abrir(root, 0);
    await asentar(fixture);
    botonCon('Pausar')?.click();
    await asentar(fixture);
    const texto = document.body.textContent ?? '';
    expect(texto).toContain('De este trabajo depende la operación de los clientes');
    expect(texto).toContain('La corrida en curso termina');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    const confirmar = [...document.querySelectorAll<HTMLButtonElement>('dba-job-pause-confirm button')].find(
      (b) => b.textContent?.trim() === 'Pausar',
    );
    expect(confirmar?.disabled).toBe(true);
    await escribirMotivo(fixture, 'Cierres duplicados');
    confirmar?.click();
    const envio = http.expectOne(`${BASE}/closing/pause`);
    expect(envio.request.body).toEqual({ reason: 'Cierres duplicados' });
    envio.flush({ key: 'closing', paused: true });
    await vi.waitFor(() => http.expectOne(BASE).flush({ jobs: [job({ key: 'closing', last: CORRIDA, pause: PAUSA })] }));
    await asentar(fixture);
    expect(avisos).toHaveBeenCalledWith(expect.objectContaining({ detail: 'El trabajo quedó en pausa.' }));
    expect(document.querySelector('dba-job-detail')?.textContent).toContain('Cierres duplicados');
    expect(botonCon('Reanudar')).toBeDefined();
  });

  it('reanudar manda el motivo; si otro ya lo había cambiado lo dice y recarga', async () => {
    const { fixture, http, root } = await montar(
      ['platform:platform:manage'],
      [job({ key: 'seals', manual: true, pause: PAUSA })],
    );
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    abrir(root, 0);
    await asentar(fixture);
    botonCon('Reanudar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('Vuelve a arrancar en su próximo horario.');
    expect(document.body.textContent).not.toContain('De este trabajo depende');
    await escribirMotivo(fixture, 'Resuelto');
    [...document.querySelectorAll<HTMLButtonElement>('dba-job-pause-confirm button')]
      .find((b) => b.textContent?.trim() === 'Reanudar')
      ?.click();
    const envio = http.expectOne(`${BASE}/seals/resume`);
    expect(envio.request.body).toEqual({ reason: 'Resuelto' });
    envio.flush({ code: 'TRABAJO_SIN_PAUSA' }, { status: 409, statusText: 'Conflict' });
    await vi.waitFor(() => http.expectOne(BASE).flush({ jobs: [job({ key: 'seals', manual: true })] }));
    await asentar(fixture);
    expect(avisos).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Alguien cambió este trabajo mientras tanto. La lista ya está al día.' }),
    );
    expect(botonCon('Pausar')).toBeDefined();
  });

  it('ejecutar a mano un trabajo en pausa avisa que la pausa sigue', async () => {
    const { fixture, root } = await montar(
      ['platform:operations:manage'],
      [job({ key: 'seals', manual: true, pause: PAUSA })],
    );
    abrir(root, 0);
    await asentar(fixture);
    botonCon('Ejecutar ahora')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('Este trabajo está en pausa: esto lo corre una sola vez y la pausa sigue.');
  });
});

describe('Vista de los trabajos', () => {
  it('traduce el estado del trabajo', () => {
    expect(jobStateOf(job({ key: 'closing', last: CORRIDA })).labelKey).toBe('task.job.state.ok');
    expect(jobStateOf(job({ key: 'closing', last: { ...CORRIDA, result: 'partial' } })).state).toBe('warning');
    expect(jobStateOf(job({ key: 'closing' })).labelKey).toBe('task.job.state.never');
    expect(jobStateOf(job({ key: 'closing', enabled: false, last: CORRIDA })).labelKey).toBe('task.job.state.off');
    expect(
      jobStateOf(job({ key: 'closing', last: CORRIDA, running: { since: CORRIDA.startedAt, trigger: 'schedule' } }))
        .labelKey,
    ).toBe('task.job.state.running');
    expect(jobStateOf(job({ key: 'closing', last: CORRIDA, pause: PAUSA }))).toEqual({
      state: 'warning',
      labelKey: 'task.job.state.paused',
    });
    expect(jobStateOf(job({ key: 'closing', enabled: false, pause: PAUSA })).labelKey).toBe('task.job.state.off');
  });

  it('solo muestra cifras conocidas y mayores que cero', () => {
    expect(jobMetricsOf({ scanned: 2, failed: 0, inventada: 4 })).toEqual([
      { labelKey: 'task.job.metric.scanned', value: 2 },
    ]);
  });

  it('formatea la duración', () => {
    expect(durationOf(840)).toBe('840 ms');
    expect(durationOf(6200)).toBe('6.2 s');
    expect(durationOf(75000)).toBe('1 min 15 s');
  });

  it('elige el mensaje de error de ejecutar', () => {
    const con = (status: number): HttpErrorResponse => new HttpErrorResponse({ status });
    expect(runJobErrorKey(con(409))).toBe('task.job.run.busy');
    expect(runJobErrorKey(con(403))).toBe('task.job.run.forbidden');
    expect(runJobErrorKey(con(500))).toBe('task.job.run.failed');
  });

  it('elige el mensaje de error de pausar', () => {
    const con = (status: number): HttpErrorResponse => new HttpErrorResponse({ status });
    expect(pauseJobErrorKey(con(409))).toBe('task.job.pause.stale');
    expect(pauseJobErrorKey(con(403))).toBe('task.job.pause.forbidden');
    expect(pauseJobErrorKey(con(500))).toBe('task.job.pause.failed');
  });
});
