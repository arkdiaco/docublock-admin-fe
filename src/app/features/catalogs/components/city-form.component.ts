import { ChangeDetectionStrategy, Component, computed, input, output, signal, type OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { CityRow } from '../data/catalogs.models';
import { CatalogCountrySelectComponent } from './catalog-country-select.component';

export interface CityFormResult {
  countryId: string;
  name: string;
  code: string;
  reason: string;
}

@Component({
  selector: 'dba-city-form',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent, CatalogCountrySelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="city() ? 'pencil' : 'plus'"
      [title]="(city() ? 'cat.city.editTitle' : 'cat.city.createTitle') | translate"
      [subtitle]="city()?.countryName ?? ''"
      [confirmLabel]="city() ? 'cat.action.save' : 'cat.action.create'"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (!city()) {
          <div class="form__control">
            <label class="form__label" for="city-country">{{ 'cat.country.label' | translate }}</label>
            <dba-catalog-country-select
              inputId="city-country"
              styleClass="form__select"
              [allowAll]="false"
              [value]="countryId()"
              (picked)="countryId.set($event)"
            />
          </div>
        }
        <dba-field label="cat.city.name" [maxlength]="120" [(value)]="name" />
        <dba-field label="cat.city.code" hint="cat.city.codeHint" [maxlength]="20" mono [(value)]="code" />
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class CityFormComponent implements OnInit {
  readonly city = input<CityRow | null>(null);
  readonly initialCountryId = input('');
  readonly busy = input(false);
  readonly submitted = output<CityFormResult>();
  readonly dismissed = output<void>();

  protected readonly countryId = signal('');
  protected readonly name = signal('');
  protected readonly code = signal('');
  protected readonly reason = signal('');
  protected readonly canSave = computed(() => {
    if (!this.countryId() || !this.name().trim() || !this.reason().trim()) return false;
    const city = this.city();
    return (
      !city ||
      this.name().trim() !== city.name ||
      this.code().trim() !== (city.code ?? '')
    );
  });

  ngOnInit(): void {
    const city = this.city();
    this.countryId.set(city?.countryId ?? this.initialCountryId());
    this.name.set(city?.name ?? '');
    this.code.set(city?.code ?? '');
  }

  protected submit(): void {
    if (!this.canSave()) return;
    this.submitted.emit({
      countryId: this.countryId(),
      name: this.name().trim(),
      code: this.code().trim(),
      reason: this.reason().trim(),
    });
  }
}
