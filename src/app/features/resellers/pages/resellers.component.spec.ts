import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { choiceProblemOf } from '../components/org-choice-form.component';
import { ResellersComponent } from './resellers.component';
import { conPermisos, configurar, reseller } from './resellers-test-kit';

interface Pagina {
  mark: (id: string) => Promise<void>;
  formOpen: { set: (open: boolean) => void };
}

describe('Comercial › Resellers', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async () => {
    const fixture = TestBed.createComponent(ResellersComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/platform/resellers').flush({ total: 1, items: [reseller()] });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-data-table')).not.toBeNull();
    });
    return { fixture, host, page: fixture.componentInstance as unknown as Pagina };
  };

  it('lista organización, NIT, correo y cartera; sin gestión no ofrece marcar', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(host.textContent).toContain('Aliados SAS');
    expect(host.textContent).toContain('900111222');
    expect(host.textContent).toContain('hola@aliados.co');
    expect(host.textContent).toContain('Resellers: 1');
    expect(host.textContent).not.toContain('Marcar como reseller');
  });

  it('marcar manda isReseller=true y lleva a la ficha', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { host, page } = await montar();
    expect(host.textContent).toContain('Marcar como reseller');
    const accion = page.mark('o7');
    const req = http.expectOne('/platform/resellers/o7');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ isReseller: true });
    req.flush(reseller({ id: 'o7' }));
    await accion;
    expect(navegar).toHaveBeenCalledWith(['/comercial/resellers', 'o7']);
  });

  it('el selector bloquea lo que el core rechazaría', () => {
    const org = { id: 'o1', label: 'Notaría', businessName: 'Notaría', tributaryNumber: '9' };
    expect(choiceProblemOf('mark', null, '')).toBe('');
    expect(choiceProblemOf('mark', org, '')).toBe('');
    expect(choiceProblemOf('mark', { ...org, isReseller: true }, '')).toBe(
      'rsl.form.alreadyReseller',
    );
    expect(choiceProblemOf('assign', { ...org, id: 'rs1' }, 'rs1')).toBe('rsl.form.self');
    expect(choiceProblemOf('assign', { ...org, resellerId: 'rs1' }, 'rs1')).toBe(
      'rsl.form.alreadyHere',
    );
    expect(choiceProblemOf('assign', { ...org, resellerId: 'otro' }, 'rs1')).toBe('');
  });
});
