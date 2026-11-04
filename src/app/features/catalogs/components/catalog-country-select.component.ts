import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { CatalogsApi } from '../data/catalogs.api';
import type { CountryOption } from '../data/catalogs.models';

const ANY = '';

@Component({
  selector: 'dba-catalog-country-select',
  imports: [FormsModule, TranslatePipe, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-select
      [inputId]="inputId()"
      [options]="options()"
      optionLabel="label"
      optionValue="id"
      [filter]="true"
      [disabled]="disabled()"
      [placeholder]="'cat.country.placeholder' | translate"
      [ngModel]="value()"
      (ngModelChange)="picked.emit($event ?? '')"
      [ariaLabel]="'cat.country.label' | translate"
      appendTo="body"
      [styleClass]="styleClass()"
    />
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class CatalogCountrySelectComponent {
  readonly value = input('');
  readonly allowAll = input(true);
  readonly disabled = input(false);
  readonly inputId = input('catalog-country');
  readonly styleClass = input('bl__select');
  readonly picked = output<string>();
  readonly loaded = output<CountryOption[]>();

  private readonly api = inject(CatalogsApi);
  private readonly translate = inject(TranslateService);
  private readonly countries = signal<CountryOption[]>([]);

  protected readonly options = computed<CountryOption[]>(() =>
    this.allowAll()
      ? [{ id: ANY, label: this.translate.instant('cat.country.any') as string }, ...this.countries()]
      : this.countries(),
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const countries = await firstValueFrom(this.api.countryOptions());
      this.countries.set(countries);
      this.loaded.emit(countries);
    } catch {
      this.countries.set([]);
    }
  }
}
