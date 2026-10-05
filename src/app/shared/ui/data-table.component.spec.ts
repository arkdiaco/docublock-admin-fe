import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { DataTableComponent, type DataColumn, pageWindow } from './data-table.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const COLS: DataColumn[] = [
  { key: 'id', labelKey: 'org.col.id', width: '84px' },
  { key: 'org', labelKey: 'org.col.name', width: 'minmax(0, 1.6fr)' },
  { key: 'chevron', width: '40px', align: 'end' },
];

@Component({
  imports: [DataTableComponent],
  template: `
    <dba-data-table [columns]="cols" [total]="312" [from]="1" [to]="10" [page]="page()" [pageCount]="32" (pageChange)="page.set($event)">
      <div class="dba-tr"><span class="dba-td">ORG-1</span></div>
      <div class="dba-tr"><span class="dba-td">ORG-2</span></div>
    </dba-data-table>
  `,
})
class Anfitrion {
  readonly cols = COLS;
  readonly page = signal(1);
}

describe('pageWindow', () => {
  it('pone puntos suspensivos y mantiene primera, última y vecinas', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 32)).toEqual([1, 2, 'gap', 32]);
    expect(pageWindow(16, 32)).toEqual([1, 'gap', 15, 16, 17, 'gap', 32]);
    expect(pageWindow(32, 32)).toEqual([1, 'gap', 31, 32]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('DataTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const montar = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('pinta la cabecera en mono, el rango traducido y alinea filas con la misma retícula', () => {
    const { host } = montar();
    const ths = [...host.querySelectorAll('.tbl__th')];
    expect(ths.length).toBe(3);
    expect(ths[0].textContent?.trim()).toBe('ID');
    expect(ths[2].textContent?.trim()).toBe('');
    expect(host.querySelector('.tbl__range')?.textContent).toContain('1–10 de 312');
    const table = host.querySelector<HTMLElement>('dba-data-table')!;
    expect(table.style.getPropertyValue('--dba-cols')).toBe('84px minmax(0, 1.6fr) 40px');
    expect(host.querySelectorAll('.dba-tr').length).toBe(2);
  });

  it('la ventana de paginación cambia de página al hacer clic', () => {
    const { fixture, host } = montar();
    const botones = [...host.querySelectorAll<HTMLButtonElement>('.tbl__page')].map((b) => b.textContent?.trim());
    expect(botones).toEqual(['1', '2', '32']);
    expect(host.querySelector('.tbl__gap')).not.toBeNull();
    host.querySelectorAll<HTMLButtonElement>('.tbl__page')[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(2);
  });
});
