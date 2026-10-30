import { TestBed } from '@angular/core/testing';
import type { HttpTestingController } from '@angular/common/http/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import type { SlaPolicy } from '../data/support.models';
import { DEFAULT_MATRIX } from '../data/ticket-view';
import { SlaPoliciesComponent } from './sla-policies.component';
import { conPermisos, configurar } from './support-test-kit';

const policies: SlaPolicy[] = [
  {
    id: 'p2',
    name: 'Premium',
    planId: 'lp1',
    isDefault: false,
    active: false,
    matrix: DEFAULT_MATRIX,
  },
  {
    id: 'p1',
    name: 'Default',
    isDefault: true,
    active: true,
    matrix: { high: { firstResponseMinutes: 30, resolutionMinutes: 120 } },
  },
];

describe('Operación › Soporte › políticas de SLA', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (permisos: string[], lista = policies) => {
    conPermisos(permisos);
    const fixture = TestBed.createComponent(SlaPoliciesComponent);
    fixture.detectChanges();
    http.expectOne('/platform/support/sla-policies').flush(lista);
    if (permisos.includes('platform:commercial'))
      http
        .expectOne('/platform/plans/legacy')
        .flush([{ id: 'lp1', name: 'Corporativo', plansLinked: [] }]);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-section-loader')).toBeNull();
    });
    return { fixture, host };
  };

  it('tarjetas con la predeterminada primero, el plan por nombre y la matriz en duraciones', async () => {
    const { host } = await montar(['platform:operations', 'platform:commercial']);
    const cards = [...host.querySelectorAll('.pc')];
    expect(cards[0].textContent).toContain('Default');
    expect(cards[0].textContent).toContain('Predeterminada');
    expect(cards[0].textContent).toContain('30 min');
    expect(cards[0].textContent).toContain('Cualquier plan');
    expect(cards[1].textContent).toContain('Corporativo');
    expect(cards[1].textContent).toContain('Inactiva');
    expect(host.querySelector('.sp__actions')).toBeNull();
    expect(host.querySelector('.pc__actions')).toBeNull();
    expect(host.textContent).not.toMatch(/\b(support|nav|common)\.[a-zA-Z]/);
  });

  it('con gestión la predeterminada no se desactiva y la inactiva se reactiva', async () => {
    const { fixture, host } = await montar(['platform:operations', 'platform:operations:manage']);
    const [first, second] = [...host.querySelectorAll('.pc')];
    expect(first.querySelectorAll('.pc__actions button').length).toBe(1);
    expect(second.querySelectorAll('.pc__actions button').length).toBe(2);
    expect(second.textContent).toContain('lp1');
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const ok = vi.spyOn(TestBed.inject(NotificationService), 'success');
    second.querySelectorAll<HTMLButtonElement>('.pc__actions button')[1].click();
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'PUT' && r.url === '/platform/support/sla-policies/p2',
      );
    });
    expect(req.request.body).toEqual({ active: true });
    req.flush({});
    await vi.waitFor(() => http.expectOne('/platform/support/sla-policies').flush(policies));
    await vi.waitFor(() => expect(ok).toHaveBeenCalledWith('Política reactivada'));
    fixture.detectChanges();
  });

  it('sin predeterminada ofrece crearla; si ya existe lo dice en frase', async () => {
    const { host } = await montar(
      ['platform:operations', 'platform:operations:manage'],
      [policies[0]],
    );
    expect(host.querySelector('.sp__warn')?.textContent).toContain(
      'No hay política predeterminada',
    );
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const mal = vi.spyOn(TestBed.inject(NotificationService), 'error');
    host.querySelector<HTMLButtonElement>('.sp__actions button')!.click();
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/platform/support/sla-policies/seed-default',
      );
    });
    req.flush({ code: 'DEFAULT_EXISTE' }, { status: 409, statusText: 'Conflict' });
    await vi.waitFor(() =>
      expect(mal).toHaveBeenCalledWith('Ya existe una política predeterminada.'),
    );
  });

  it('crear una política manda la matriz en minutos', async () => {
    const { fixture, host } = await montar(['platform:operations', 'platform:operations:manage']);
    const cmp = fixture.componentInstance as unknown as {
      save: (p: SlaPolicy | null, body: unknown) => Promise<void>;
    };
    void cmp.save(null, { name: 'Oro', isDefault: false, active: true, matrix: DEFAULT_MATRIX });
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/platform/support/sla-policies',
      );
    });
    expect(req.request.body.matrix.critical).toEqual({
      firstResponseMinutes: 60,
      resolutionMinutes: 480,
    });
    req.flush({});
    await vi.waitFor(() => http.expectOne('/platform/support/sla-policies').flush(policies));
    fixture.detectChanges();
    expect(host.querySelector('dba-sla-policy-form')).toBeNull();
  });
});
