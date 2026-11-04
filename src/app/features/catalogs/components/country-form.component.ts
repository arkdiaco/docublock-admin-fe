import { ChangeDetectionStrategy, Component, computed, input, output, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import type { CountryChanges, CountryDetail, TaxIdRule } from '../data/catalogs.models';

export interface CountryFormValue {
  name: string;
  abbreviation: string;
  callingCode: string;
  currency: string;
  locale: string;
  timezone: string;
  resolution: string;
  taxLabel: string;
  taxExample: string;
  taxPattern: string;
  stripCheckDigit: boolean;
}

const taxIdOf = (form: CountryFormValue): TaxIdRule | null => {
  const rule: TaxIdRule = {
    ...(form.taxLabel.trim() ? { label: form.taxLabel.trim() } : {}),
    ...(form.taxExample.trim() ? { example: form.taxExample.trim() } : {}),
    ...(form.taxPattern.trim() ? { pattern: form.taxPattern.trim() } : {}),
    ...(form.stripCheckDigit ? { normalize: 'strip-dv' as const } : {}),
  };
  return Object.keys(rule).length > 0 ? rule : null;
};

const sameTaxId = (a: TaxIdRule | null, b: TaxIdRule): boolean =>
  (a?.label ?? '') === (b.label ?? '') &&
  (a?.example ?? '') === (b.example ?? '') &&
  (a?.pattern ?? '') === (b.pattern ?? '') &&
  (a?.normalize ?? '') === (b.normalize ?? '');

export const countryChangesOf = (
  country: CountryDetail,
  form: CountryFormValue,
): CountryChanges => {
  const changes: CountryChanges = {};
  const name = form.name.trim();
  const abbreviation = form.abbreviation.trim();
  if (name !== country.name) changes.name = name;
  if (abbreviation !== country.abbreviation) changes.abbreviation = abbreviation;
  for (const key of ['callingCode', 'currency', 'locale', 'timezone', 'resolution'] as const) {
    const value = form[key].trim();
    if (value !== country[key]) changes[key] = value || null;
  }
  const taxId = taxIdOf(form);
  if (!sameTaxId(taxId, country.taxId)) changes.taxId = taxId;
  return changes;
};

export type CountryFormResult =
  | { kind: 'create'; draft: CountryChanges & { name: string; abbreviation: string }; reason: string }
  | { kind: 'edit'; changes: CountryChanges; reason: string };

@Component({
  selector: 'dba-country-form',
  imports: [
    FormsModule,
    TranslatePipe,
    ToggleSwitch,
    FieldComponent,
    ModalShellComponent,
    TextAreaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      [icon]="country() ? 'pencil' : 'plus'"
      [title]="(country() ? 'cat.countryForm.editTitle' : 'cat.countryForm.createTitle') | translate"
      [subtitle]="country()?.name ?? ''"
      [confirmLabel]="country() ? 'cat.action.save' : 'cat.action.create'"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="640"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__pair">
          <dba-field label="cat.col.name" [maxlength]="120" [(value)]="name" />
          <dba-field
            label="cat.countryForm.abbreviation"
            hint="cat.countryForm.abbreviationHint"
            [maxlength]="10"
            mono
            [(value)]="abbreviation"
          />
        </div>
        <div class="form__pair">
          <dba-field
            label="cat.countryForm.callingCode"
            placeholder="cat.countryForm.callingCodePlaceholder"
            [maxlength]="10"
            mono
            [(value)]="callingCode"
          />
          <dba-field
            label="cat.countryForm.currency"
            placeholder="cat.countryForm.currencyPlaceholder"
            [maxlength]="10"
            mono
            [(value)]="currency"
          />
        </div>
        <div class="form__pair">
          <dba-field
            label="cat.countryForm.locale"
            placeholder="cat.countryForm.localePlaceholder"
            [maxlength]="20"
            mono
            [(value)]="locale"
          />
          <dba-field
            label="cat.countryForm.timezone"
            placeholder="cat.countryForm.timezonePlaceholder"
            [maxlength]="80"
            mono
            [(value)]="timezone"
          />
        </div>
        <h3 class="dba-panel">{{ 'cat.countryForm.taxSection' | translate }}</h3>
        <div class="form__pair">
          <dba-field label="cat.countryForm.taxLabel" [maxlength]="80" [(value)]="taxLabel" />
          <dba-field label="cat.countryForm.taxExample" [maxlength]="80" mono [(value)]="taxExample" />
        </div>
        <dba-field
          label="cat.countryForm.taxPattern"
          hint="cat.countryForm.taxPatternHint"
          [maxlength]="200"
          mono
          [(value)]="taxPattern"
        />
        <div class="form__switch form__switch--bare">
          <p-toggleswitch
            inputId="country-strip"
            [ngModel]="stripCheckDigit()"
            (ngModelChange)="stripCheckDigit.set($event)"
          />
          <label class="form__label" for="country-strip">{{
            'cat.countryForm.stripCheckDigit' | translate
          }}</label>
        </div>
        <dba-text-area
          label="cat.countryForm.resolution"
          hint="cat.countryForm.resolutionHint"
          [rows]="4"
          [maxlength]="4000"
          [(value)]="resolution"
        />
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
export class CountryFormComponent implements OnInit {
  readonly country = input<CountryDetail | null>(null);
  readonly busy = input(false);
  readonly submitted = output<CountryFormResult>();
  readonly dismissed = output<void>();

  protected readonly name = signal('');
  protected readonly abbreviation = signal('');
  protected readonly callingCode = signal('');
  protected readonly currency = signal('');
  protected readonly locale = signal('');
  protected readonly timezone = signal('');
  protected readonly resolution = signal('');
  protected readonly taxLabel = signal('');
  protected readonly taxExample = signal('');
  protected readonly taxPattern = signal('');
  protected readonly stripCheckDigit = signal(false);
  protected readonly reason = signal('');

  private readonly changes = computed(() => {
    const country = this.country();
    return country ? countryChangesOf(country, this.value()) : {};
  });
  protected readonly canSave = computed(() => {
    if (!this.name().trim() || !this.abbreviation().trim() || !this.reason().trim()) return false;
    return !this.country() || Object.keys(this.changes()).length > 0;
  });

  ngOnInit(): void {
    const country = this.country();
    if (!country) return;
    this.name.set(country.name);
    this.abbreviation.set(country.abbreviation);
    this.callingCode.set(country.callingCode);
    this.currency.set(country.currency);
    this.locale.set(country.locale);
    this.timezone.set(country.timezone);
    this.resolution.set(country.resolution);
    this.taxLabel.set(country.taxId.label ?? '');
    this.taxExample.set(country.taxId.example ?? '');
    this.taxPattern.set(country.taxId.pattern ?? '');
    this.stripCheckDigit.set(country.taxId.normalize === 'strip-dv');
  }

  protected submit(): void {
    if (!this.canSave()) return;
    const reason = this.reason().trim();
    if (this.country()) {
      this.submitted.emit({ kind: 'edit', changes: this.changes(), reason });
      return;
    }
    const form = this.value();
    const taxId = taxIdOf(form);
    this.submitted.emit({
      kind: 'create',
      reason,
      draft: {
        name: form.name.trim(),
        abbreviation: form.abbreviation.trim(),
        ...(form.callingCode.trim() ? { callingCode: form.callingCode.trim() } : {}),
        ...(form.currency.trim() ? { currency: form.currency.trim() } : {}),
        ...(form.locale.trim() ? { locale: form.locale.trim() } : {}),
        ...(form.timezone.trim() ? { timezone: form.timezone.trim() } : {}),
        ...(form.resolution.trim() ? { resolution: form.resolution.trim() } : {}),
        ...(taxId ? { taxId } : {}),
      },
    });
  }

  private value(): CountryFormValue {
    return {
      name: this.name(),
      abbreviation: this.abbreviation(),
      callingCode: this.callingCode(),
      currency: this.currency(),
      locale: this.locale(),
      timezone: this.timezone(),
      resolution: this.resolution(),
      taxLabel: this.taxLabel(),
      taxExample: this.taxExample(),
      taxPattern: this.taxPattern(),
      stripCheckDigit: this.stripCheckDigit(),
    };
  }
}
