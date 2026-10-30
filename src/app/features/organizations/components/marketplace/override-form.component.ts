import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { money } from '../../../../shared/domain/money';
import {
  tierDraftsOf,
  tierError,
  tiersOf,
  type TierDraft,
} from '../../../../shared/domain/price-tiers';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import { TierEditorComponent } from '../../../../shared/ui/tier-editor.component';
import type { OrgProductPrice, OverrideBody } from '../../data/org-marketplace.models';

const WHOLE = /^\d{1,10}$/;

@Component({
  selector: 'dba-override-form',
  imports: [
    TranslatePipe,
    FormsModule,
    ModalShellComponent,
    FieldComponent,
    TierEditorComponent,
    ToggleSwitch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="market"
      [title]="'orgMkt.override.title' | translate"
      [subtitle]="price().name + ' · ' + price().productCode"
      confirmLabel="orgMkt.override.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="600"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="dba-meta form__note--top">
          {{ 'orgMkt.override.lead' | translate: { general: general() } }}
        </p>
        <div class="form__pair">
          <dba-field
            [label]="addon() ? 'orgMkt.override.monthly' : 'orgMkt.override.unit'"
            mono
            inputmode="numeric"
            [hint]="amountHint()"
            [error]="priceError()"
            [(value)]="unitPrice"
          />
          <dba-field
            label="orgMkt.override.tax"
            mono
            inputmode="numeric"
            [maxlength]="3"
            placeholder="orgMkt.override.taxGeneral"
            [error]="taxError()"
            [(value)]="taxPct"
          />
        </div>
        @if (!addon()) {
          <div class="form__switch form__switch--bare">
            <p-toggleswitch
              inputId="ovr-tiers"
              [ngModel]="ownTiers()"
              (ngModelChange)="ownTiers.set($event)"
            />
            <span class="form__switchCopy">
              <label class="form__label" for="ovr-tiers">{{
                'orgMkt.override.ownTiers' | translate
              }}</label>
              <span class="dba-meta">{{ 'orgMkt.override.ownTiersHint' | translate }}</span>
            </span>
          </div>
          @if (ownTiers()) {
            <dba-tier-editor
              label="orgMkt.override.tiers"
              unit="orgMkt.queries"
              emptyKey="orgMkt.override.noDiscount"
              [(tiers)]="tiers"
            />
          }
        }
        <dba-field label="orgMkt.override.note" [maxlength]="300" [(value)]="note" />
        <dba-field
          label="orgMkt.f.reason"
          placeholder="orgMkt.f.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../../shared/ui/modal-form.scss',
})
export class OverrideFormComponent implements OnInit {
  private readonly locale = inject(LOCALE_ID);

  readonly price = input.required<OrgProductPrice>();
  readonly busy = input(false);
  readonly submitted = output<OverrideBody>();
  readonly dismissed = output<void>();

  protected readonly unitPrice = signal('');
  protected readonly taxPct = signal('');
  protected readonly ownTiers = signal(false);
  protected readonly tiers = signal<TierDraft[]>([]);
  protected readonly note = signal('');
  protected readonly reason = signal('');

  protected readonly addon = computed(() => this.price().kind === 'ADDON');
  protected readonly general = computed(() =>
    money(this.price().generalUnitPrice, this.price().currency, this.locale),
  );
  protected readonly priceError = computed(() =>
    WHOLE.test(this.unitPrice().trim()) ? '' : 'orgMkt.override.priceInvalid',
  );
  protected readonly taxError = computed(() => {
    const value = this.taxPct().trim();
    return value === '' || (WHOLE.test(value) && Number(value) <= 100)
      ? ''
      : 'orgMkt.override.taxInvalid';
  });
  protected readonly amountHint = computed(() =>
    this.priceError()
      ? ''
      : money(Number(this.unitPrice().trim()), this.price().currency, this.locale),
  );
  protected readonly valid = computed(
    () =>
      !this.priceError() &&
      !this.taxError() &&
      (!this.ownTiers() || !tierError(this.tiers())) &&
      !!this.reason().trim(),
  );

  ngOnInit(): void {
    const price = this.price();
    this.unitPrice.set(String(price.unitPrice));
    if (price.overridden) {
      this.taxPct.set(String(price.taxPct));
      this.note.set(price.note ?? '');
    }
    this.tiers.set(tierDraftsOf(price.tiers));
  }

  protected submit(): void {
    if (!this.valid()) return;
    const tax = this.taxPct().trim();
    const note = this.note().trim();
    this.submitted.emit({
      unitPrice: Number(this.unitPrice().trim()),
      ...(this.ownTiers() && !this.addon() ? { tiers: tiersOf(this.tiers()) } : {}),
      ...(tax ? { taxPct: Number(tax) } : {}),
      ...(note ? { note } : {}),
      reason: this.reason().trim(),
    });
  }
}
