import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import {
  CODE_PATTERN,
  MAX_QUANTITY,
  dayInputOf,
  dayOf,
  endOfDayIso,
  isWhole,
} from '../data/promotions-view';
import type {
  CountryOption,
  CreatePromoBody,
  PromoCode,
  UpdatePromoBody,
} from '../data/promotions.models';

const ANY = '';

@Component({
  selector: 'dba-promo-form',
  imports: [TranslatePipe, FormsModule, Select, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="market"
      [title]="(code() ? 'promo.form.editTitle' : 'promo.form.createTitle') | translate"
      [subtitle]="code()?.code ?? ''"
      [confirmLabel]="code() ? 'promo.form.save' : 'promo.form.create'"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field label="promo.form.name" [maxlength]="120" [(value)]="name" />
        @if (!code()) {
          <dba-field
            label="promo.form.code"
            hint="promo.form.codeHint"
            mono
            autocomplete="off"
            [maxlength]="40"
            [error]="codeProblem() ? 'promo.form.codeInvalid' : ''"
            [(value)]="codeText"
          />
        }
        <div class="form__pair">
          <dba-field
            label="promo.form.discount"
            inputmode="numeric"
            [hint]="code() ? 'promo.form.discountHint' : ''"
            [error]="discountProblem() ? 'promo.form.discountInvalid' : ''"
            [(value)]="discount"
          />
          <dba-field
            label="promo.form.quantity"
            inputmode="numeric"
            [hint]="
              code() ? ('promo.form.quantityHint' | translate: { redeemed: code()!.redeemed }) : ''
            "
            [error]="quantityProblem() ? 'promo.form.quantityInvalid' : ''"
            [(value)]="quantity"
          />
        </div>
        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="promo-country">{{
              'promo.form.country' | translate
            }}</label>
            <p-select
              inputId="promo-country"
              [options]="countryOptions()"
              optionLabel="label"
              optionValue="id"
              [filter]="true"
              [ngModel]="country()"
              (ngModelChange)="country.set($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <dba-field
            label="promo.form.expires"
            type="date"
            [error]="expiresProblem() ? 'promo.form.expiresInvalid' : ''"
            [(value)]="expires"
          />
        </div>
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class PromoFormComponent implements OnInit {
  private readonly translate = inject(TranslateService);

  readonly code = input<PromoCode | null>(null);
  readonly countries = input<CountryOption[]>([]);
  readonly busy = input(false);
  readonly created = output<CreatePromoBody>();
  readonly updated = output<UpdatePromoBody>();
  readonly dismissed = output<void>();

  protected readonly name = signal('');
  protected readonly codeText = signal('');
  protected readonly discount = signal('');
  protected readonly quantity = signal('');
  protected readonly country = signal(ANY);
  protected readonly expires = signal('');
  private initialExpires = '';

  protected readonly countryOptions = computed(() => [
    { id: ANY, label: this.translate.instant('promo.form.anyCountry') as string },
    ...this.countries().map((c) => ({ id: c.id, label: c.name })),
  ]);
  protected readonly codeProblem = computed(
    () => this.codeText().trim() !== '' && !CODE_PATTERN.test(this.codeText().trim()),
  );
  protected readonly discountProblem = computed(
    () => this.discount().trim() !== '' && !isWhole(this.discount(), 1, 100),
  );
  protected readonly quantityProblem = computed(
    () =>
      this.quantity().trim() !== '' &&
      !isWhole(this.quantity(), Math.max(1, this.code()?.redeemed ?? 1), MAX_QUANTITY),
  );
  protected readonly expiresProblem = computed(() => {
    const day = this.expires();
    return !!day && day !== this.initialExpires && day < dayOf(new Date());
  });
  protected readonly valid = computed(
    () =>
      this.name().trim() !== '' &&
      (!!this.code() || CODE_PATTERN.test(this.codeText().trim())) &&
      this.discount().trim() !== '' &&
      !this.discountProblem() &&
      this.quantity().trim() !== '' &&
      !this.quantityProblem() &&
      !this.expiresProblem(),
  );

  ngOnInit(): void {
    const code = this.code();
    if (!code) return;
    this.name.set(code.name);
    this.discount.set(String(code.discount));
    this.quantity.set(String(code.quantity));
    this.country.set(code.countryId ?? ANY);
    this.initialExpires = dayInputOf(code.expiresAt);
    this.expires.set(this.initialExpires);
  }

  protected submit(): void {
    if (!this.valid()) return;
    const base = {
      name: this.name().trim(),
      discount: Number(this.discount()),
      quantity: Number(this.quantity()),
    };
    if (this.code()) {
      this.updated.emit({
        ...base,
        countryId: this.country() || null,
        expiresAt: this.expires() ? endOfDayIso(this.expires()) : null,
      });
      return;
    }
    this.created.emit({
      ...base,
      code: this.codeText().trim(),
      countryId: this.country() || undefined,
      expiresAt: this.expires() ? endOfDayIso(this.expires()) : undefined,
    });
  }
}
