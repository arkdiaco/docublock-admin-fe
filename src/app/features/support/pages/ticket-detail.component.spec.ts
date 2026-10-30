import { TestBed } from '@angular/core/testing';
import type { HttpTestingController } from '@angular/common/http/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import type { TicketDetail } from '../data/support.models';
import { TicketDetailComponent } from './ticket-detail.component';
import { conPermisos, configurar, ficha } from './support-test-kit';

describe('Operación › Soporte › ficha del ticket', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (body: TicketDetail | null = ficha(), gestiona = false) => {
    const fixture = TestBed.createComponent(TicketDetailComponent);
    fixture.componentRef.setInput('id', 't1');
    fixture.detectChanges();
    if (gestiona)
      http
        .expectOne('/platform/support/agents')
        .flush([{ id: 'a1', name: 'Sam Soporte', email: 'sam@docublock.co' }]);
    const req = http.expectOne('/platform/support/tickets/t1');
    if (body) req.flush(body);
    else req.flush({ code: 'TICKET_NO_ENCONTRADO' }, { status: 404, statusText: 'Not Found' });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-section-loader')).toBeNull();
    });
    return { fixture, host };
  };

  const tab = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('db-underline-tabs .tab')].find((t) =>
      t.textContent?.includes(label),
    )!;

  it('solo lectura: cabecera, conversación con la nota marcada y sin gestión ni composer', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar();
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('No llega la clave');
    expect(host.querySelector('.rec__card')?.textContent).toContain('Abierto');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('TKT-2026-000001');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('Flujo de firma');
    expect(host.querySelector('db-underline-tabs')?.textContent).toContain('Conversación2');
    expect(host.querySelectorAll('.msg').length).toBe(2);
    expect(host.querySelector('.msg--note')?.textContent).toContain('Nota interna');
    expect(host.querySelector('.msg__files')?.textContent).toContain('captura.png');
    expect(host.querySelector('.td__manage')).toBeNull();
    expect(host.querySelector('.th__composer')).toBeNull();
    expect(host.textContent).not.toMatch(/\b(support|nav|common)\.[a-zA-Z]/);
  });

  it('un ticket inexistente lo dice y vuelve a la bandeja', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar(null);
    expect(host.querySelector('dba-empty-state')?.textContent).toContain('Este ticket no existe');
    expect(host.querySelector('a[dba-button]')?.getAttribute('href')).toBe('/operacion/soporte');
  });

  it('SLA, historial y datos salen en frases', async () => {
    conPermisos(['platform:operations', 'platform:clients']);
    const { fixture, host } = await montar();
    tab(host, 'SLA').click();
    fixture.detectChanges();
    expect(host.querySelector('.sla')?.textContent).toContain('Matriz por defecto');
    expect(host.querySelector('.sla')?.textContent).toContain('4 h');
    expect(host.querySelector('.sla')?.textContent).toContain('1 d');
    tab(host, 'Historial').click();
    fixture.detectChanges();
    expect(host.querySelector('.hi')?.textContent).toContain('Cambió la prioridad');
    expect(host.querySelector('.hi')?.textContent).toContain('Normal → Alta');
    tab(host, 'Datos').click();
    fixture.detectChanges();
    expect(host.querySelector('.td__dl')?.textContent).toContain('ana@x.co');
    expect(host.querySelector('.td__link')?.getAttribute('href')).toBe(
      '/clientes/organizaciones/o1',
    );
    expect(host.textContent).not.toMatch(/\b(support|nav|common)\.[a-zA-Z]/);
  });

  it('con gestión responde como nota interna y recarga', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const { fixture, host } = await montar(ficha(), true);
    const ok = vi.spyOn(TestBed.inject(NotificationService), 'success');
    expect(host.querySelector('.td__manage')).not.toBeNull();
    const area = host.querySelector<HTMLTextAreaElement>('.th__composer textarea')!;
    area.value = '  Escalado al operador  ';
    area.dispatchEvent(new Event('input'));
    host.querySelector<HTMLElement>('#ticket-internal')!.click();
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.th__bar button[dba-button]')!.click();
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/platform/support/tickets/t1/messages',
      );
    });
    expect(req.request.body).toEqual({ body: 'Escalado al operador', internalNote: true });
    req.flush({});
    await vi.waitFor(() => http.expectOne('/platform/support/tickets/t1').flush(ficha()));
    await vi.waitFor(() => expect(ok).toHaveBeenCalledWith('Nota guardada'));
  });

  it('cambiar la prioridad confirma; si se cancela, el selector vuelve al valor real', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const { fixture } = await montar(ficha(), true);
    const confirmar = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(false);
    const cmp = fixture.componentInstance as unknown as {
      changePriority: (p: string) => Promise<void>;
      priorityDraft: () => string;
    };
    await cmp.changePriority('critical');
    expect(confirmar.mock.calls[0][0].params).toEqual({ from: 'Alta', to: 'Crítica' });
    expect(cmp.priorityDraft()).toBe('high');
  });

  it('asignar manda el agente y un error conocido sale como frase', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const { fixture } = await montar(ficha(), true);
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const mal = vi.spyOn(TestBed.inject(NotificationService), 'error');
    const cmp = fixture.componentInstance as unknown as {
      changeAgent: (id: string) => Promise<void>;
      agentDraft: () => string | null;
    };
    void cmp.changeAgent('a1');
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'PATCH' && r.url === '/platform/support/tickets/t1/assign',
      );
    });
    expect(req.request.body).toEqual({ assignedToId: 'a1' });
    req.flush({ code: 'ASIGNADO_NO_ES_AGENTE' }, { status: 400, statusText: 'Bad Request' });
    await vi.waitFor(() =>
      expect(mal).toHaveBeenCalledWith('Esa persona no es agente activo de la plataforma.'),
    );
    expect(cmp.agentDraft()).toBeNull();
  });
});
