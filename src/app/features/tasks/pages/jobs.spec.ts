import { HttpErrorResponse } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { durationOf, jobMetricsOf, jobStateOf } from '../data/job-view';
import { runJobErrorKey } from '../data/tasks.api';
import type { FinishedJobRun, JobView } from '../data/tasks.models';
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
  ...overrides,
});

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
});
