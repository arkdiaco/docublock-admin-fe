import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { FilterPillsComponent, type FilterPill } from './filter-pills.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [FilterPillsComponent],
  template: `
    <db-filter-pills [pills]="pills" [active]="active()" (activeChange)="active.set($event)" />
  `,
})
class Anfitrion {
  readonly active = signal('all');
  readonly pills: FilterPill[] = [
    { key: 'all', labelKey: 'rs.filterAll', count: 29 },
    { key: 'active', labelKey: 'rs.filterActive', count: 28 },
    { key: 'rejected', labelKey: 'rs.filterSuspended', count: 1, danger: true },
  ];
}

describe('FilterPillsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
  });

  it('marca la activa, muestra contadores y respeta la variante de peligro', () => {
    TestBed.inject(TranslateService).use('es');
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const pastillas = [...host.querySelectorAll<HTMLButtonElement>('.pill')];
    expect(pastillas).toHaveLength(3);
    expect(pastillas[0].classList.contains('pill--on')).toBe(true);
    expect(pastillas[2].classList.contains('pill--danger')).toBe(true);
    expect(host.querySelectorAll('.pill__count')).toHaveLength(3);

    pastillas[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.active()).toBe('active');
    expect(pastillas[1].getAttribute('aria-pressed')).toBe('true');
  });
});
