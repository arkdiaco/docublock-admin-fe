import { TestBed } from '@angular/core/testing';
import { DensityService } from './density.service';

describe('DensityService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('arranca cómoda, alterna y lo recuerda en el almacenamiento local', () => {
    const density = TestBed.inject(DensityService);
    expect(density.compact()).toBe(false);
    density.toggle();
    expect(density.compact()).toBe(true);
    expect(localStorage.getItem('dba.density')).toBe('compact');
    density.set(false);
    expect(localStorage.getItem('dba.density')).toBe('cozy');
  });

  it('si había preferencia compacta guardada, arranca compacta', () => {
    localStorage.setItem('dba.density', 'compact');
    expect(TestBed.inject(DensityService).compact()).toBe(true);
  });
});
