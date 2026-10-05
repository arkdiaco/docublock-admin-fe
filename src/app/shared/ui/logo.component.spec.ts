import { TestBed } from '@angular/core/testing';
import { LogoComponent } from './logo.component';

describe('LogoComponent', () => {
  it('el imagotipo lleva la marca morada y el texto en tinta; el isotipo es una sola forma', () => {
    const fixture = TestBed.createComponent(LogoComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const rellenos = [...host.querySelectorAll('path')].map((p) => p.getAttribute('fill'));
    expect(rellenos.length).toBe(10);
    expect(rellenos[0]).toBe('#7954FD');
    expect(rellenos.slice(1).every((f) => f === '#16121F')).toBe(true);
    expect(host.querySelector('svg')?.getAttribute('aria-label')).toBe('Docublock');

    fixture.componentRef.setInput('variant', 'mark');
    fixture.componentRef.setInput('mark', '#ffffff');
    fixture.detectChanges();
    expect(host.querySelectorAll('path').length).toBe(1);
    expect(host.querySelector('path')?.getAttribute('fill')).toBe('#ffffff');
  });
});
