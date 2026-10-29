import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import {
  PRICED_TYPES,
  type PricedType,
  type PricingBody,
  type ValidationPricing,
} from '../../data/validations.models';

const PRICE = /^\d+(\.\d{1,2})?$/;

const price = (text: string): number | null =>
  PRICE.test(text.trim()) ? Number(text.trim()) : null;

@Component({
  selector: 'dba-pricing-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="reports"
      [title]="'val.pricing.title' | translate"
      [subtitle]="orgName()"
      confirmLabel="val.pricing.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="pricing-mode">{{
              'val.pricing.mode' | translate
            }}</label>
            <p-select
              inputId="pricing-mode"
              [options]="modes()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="mode()"
              (ngModelChange)="mode.set($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <dba-field label="val.pricing.currency" mono [maxlength]="3" [(value)]="currency" />
        </div>

        @if (mode() === 'package') {
          <dba-field
            label="val.pricing.packagePrice"
            inputmode="decimal"
            [error]="errorOf(packagePrice())"
            [(value)]="packagePrice"
          />
          <div class="form__control">
            <span class="form__label">{{ 'val.pricing.includes' | translate }}</span>
            @for (type of types; track type) {
              <div class="form__switch form__switch--bare">
                <p-toggleswitch
                  [inputId]="'pricing-' + type"
                  [ngModel]="includes().includes(type)"
                  (ngModelChange)="toggle(type, $event)"
                />
                <label class="form__label" [for]="'pricing-' + type">{{
                  'val.priced.' + type | translate
                }}</label>
              </div>
            }
          </div>
        } @else {
          <div class="form__pair">
            @for (type of types; track type) {
              <dba-field
                [label]="'val.priced.' + type"
                inputmode="decimal"
                [error]="errorOf(unit()[type])"
                [value]="unit()[type]"
                (valueChange)="setUnit(type, $event)"
              />
            }
          </div>
        }

        <dba-field label="val.pricing.notes" [maxlength]="500" [(value)]="notes" />
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../modal-form.scss',
})
export class PricingFormComponent implements OnInit {
  readonly pricing = input.required<ValidationPricing>();
  readonly orgName = input.required<string>();
  readonly modeLabels = input.required<{ package: string; per_validation: string }>();
  readonly busy = input(false);
  readonly submitted = output<PricingBody>();
  readonly dismissed = output<void>();

  protected readonly types = PRICED_TYPES;
  protected readonly mode = signal<'package' | 'per_validation'>('package');
  protected readonly currency = signal('');
  protected readonly packagePrice = signal('');
  protected readonly includes = signal<PricedType[]>([]);
  protected readonly unit = signal<Record<PricedType, string>>({
    ani: '',
    liveness: '',
    macherFacial: '',
  });
  protected readonly notes = signal('');
  protected readonly reason = signal('');

  protected readonly modes = computed(() => [
    { value: 'package', label: this.modeLabels().package },
    { value: 'per_validation', label: this.modeLabels().per_validation },
  ]);

  protected readonly valid = computed(() => {
    if (!this.reason().trim() || !/^[A-Za-z]{3}$/.test(this.currency().trim())) return false;
    if (this.mode() === 'package')
      return price(this.packagePrice()) !== null && this.includes().length > 0;
    return PRICED_TYPES.every((type) => price(this.unit()[type]) !== null);
  });

  ngOnInit(): void {
    const pricing = this.pricing();
    this.mode.set(pricing.mode);
    this.currency.set(pricing.currency);
    this.packagePrice.set(String(pricing.packagePrice));
    this.includes.set([...pricing.packageIncludes]);
    this.unit.set({
      ani: String(pricing.unitPrices.ani),
      liveness: String(pricing.unitPrices.liveness),
      macherFacial: String(pricing.unitPrices.macherFacial),
    });
    this.notes.set(pricing.notes ?? '');
  }

  protected errorOf(text: string): string {
    return text.trim() && price(text) === null ? 'val.pricing.priceInvalid' : '';
  }

  protected toggle(type: PricedType, on: boolean): void {
    this.includes.update((list) =>
      on ? [...new Set([...list, type])] : list.filter((item) => item !== type),
    );
  }

  protected setUnit(type: PricedType, value: string): void {
    this.unit.update((current) => ({ ...current, [type]: value }));
  }

  protected submit(): void {
    if (!this.valid()) return;
    const unit = this.unit();
    this.submitted.emit({
      mode: this.mode(),
      currency: this.currency().trim().toUpperCase(),
      packagePrice: price(this.packagePrice()) ?? 0,
      packageIncludes: this.includes(),
      unitPrices: {
        ani: price(unit.ani) ?? 0,
        liveness: price(unit.liveness) ?? 0,
        macherFacial: price(unit.macherFacial) ?? 0,
      },
      ...(this.notes().trim() && { notes: this.notes().trim() }),
      reason: this.reason().trim(),
    });
  }
}
