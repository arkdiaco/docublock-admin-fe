import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuditEventComponent } from './audit-event.component';

@Component({
  imports: [AuditEventComponent],
  template: `
    <dba-audit-event actor="Marta Vidal" meta="03-oct-2026 16:42 UTC">cambió el plan de <code class="dba-ref">ORG-0412</code></dba-audit-event>
    <dba-audit-event kind="system" actor="Sistema" meta="28-sep 09:00">envió aviso de cuota</dba-audit-event>
    <dba-audit-event kind="support" meta="14-sep 15:05">abrió la ficha</dba-audit-event>
    <dba-audit-event kind="unknown" last>intento sin actor</dba-audit-event>
  `,
})
class Anfitrion {}

describe('AuditEventComponent', () => {
  it('el punto cambia de forma con el tipo de actor y el último evento no deja raya colgando', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const puntos = [...host.querySelectorAll('.ev__dot')].map((d) => d.className.replace(/.*ev__dot--(\w+).*/, '$1'));
    expect(puntos).toEqual(['person', 'system', 'support', 'unknown']);
    expect(host.querySelectorAll('.ev__line').length).toBe(3);
    expect(host.querySelector('.ev--last')).not.toBeNull();
    expect(host.querySelector('.ev__actor')?.textContent).toBe('Marta Vidal');
    expect(host.querySelector('.ev__text')?.textContent).toContain('ORG-0412');
    expect(host.querySelectorAll('.ev__meta').length).toBe(3);
  });
});
