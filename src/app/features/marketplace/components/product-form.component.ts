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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { firstValueFrom } from 'rxjs';
import { money } from '../../../shared/domain/money';
import {
  sameTiers,
  tierDraftsOf,
  tierError,
  tiersOf,
  type TierDraft,
} from '../../../shared/domain/price-tiers';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import { TierEditorComponent } from '../../../shared/ui/tier-editor.component';
import { MarketplaceApi } from '../data/marketplace.api';
import {
  ADDON_CODES,
  CREDIT_TYPES,
  type AddonCode,
  type CreateProductBody,
  type CreditType,
  type ProductDetail,
  type ProductKind,
  type VersionProductBody,
} from '../data/marketplace.models';
import { bulletsOf, tiersText } from '../data/product-format';

const CODE = /^[A-Z_]{3,40}$/;
const WHOLE = /^\d{1,10}$/;
const DEFAULT_CURRENCY = 'COP';

const LEVEL_OF: Record<CreditType, number> = { ani: 1, identity: 2, biometric: 3 };

@Component({
  selector: 'dba-product-form',
  imports: [
    TranslatePipe,
    FormsModule,
    ModalShellComponent,
    FieldComponent,
    TextAreaComponent,
    TierEditorComponent,
    Select,
    ToggleSwitch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="market"
      [title]="(editing() ? 'mkt.form.versionTitle' : 'mkt.form.createTitle') | translate"
      [subtitle]="editing() ? product()!.name + ' · ' + product()!.code : ''"
      [confirmLabel]="editing() ? 'mkt.form.versionConfirm' : 'mkt.form.createConfirm'"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="640"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (editing()) {
          <p class="dba-meta form__note--top">{{ 'mkt.form.versionLead' | translate }}</p>
        } @else {
          <div class="form__pair">
            <div class="form__control">
              <label class="form__label" for="mkt-kind">{{ 'mkt.f.kind' | translate }}</label>
              <p-select
                inputId="mkt-kind"
                [options]="kindOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="kind()"
                (ngModelChange)="pickKind($event)"
                appendTo="body"
                styleClass="form__select"
              />
            </div>
            @if (kind() === 'VALIDATION_PACKAGE') {
              <div class="form__control">
                <label class="form__label" for="mkt-credit">{{
                  'mkt.f.creditType' | translate
                }}</label>
                <p-select
                  inputId="mkt-credit"
                  [options]="creditOptions()"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="creditType()"
                  (ngModelChange)="pickCredit($event)"
                  appendTo="body"
                  styleClass="form__select"
                />
              </div>
            } @else {
              <div class="form__control">
                <label class="form__label" for="mkt-addon">{{
                  'mkt.f.addonCode' | translate
                }}</label>
                <p-select
                  inputId="mkt-addon"
                  [options]="addonOptions()"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="addonCode()"
                  (ngModelChange)="pickAddon($event)"
                  appendTo="body"
                  styleClass="form__select"
                />
              </div>
            }
          </div>

          <div class="form__pair">
            <dba-field
              label="mkt.f.code"
              mono
              [maxlength]="40"
              [hint]="codeTouched() ? '' : 'mkt.form.codeHint'"
              [error]="codeError()"
              [value]="code()"
              (valueChange)="setCode($event)"
            />
            <div class="form__control">
              <label class="form__label" for="mkt-currency">{{
                'mkt.f.currency' | translate
              }}</label>
              <p-select
                inputId="mkt-currency"
                [options]="currencyOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="currency()"
                (ngModelChange)="pickCurrency($event)"
                appendTo="body"
                styleClass="form__select"
              />
              <span class="dba-meta">{{ 'mkt.form.currencyHint' | translate }}</span>
            </div>
          </div>

          @if (kind() === 'VALIDATION_PACKAGE') {
            <dba-field
              label="mkt.f.level"
              mono
              inputmode="numeric"
              [maxlength]="1"
              [hint]="'mkt.form.levelHint'"
              [error]="levelError()"
              [(value)]="level"
            />
          }

          <dba-field
            label="mkt.f.name"
            [maxlength]="120"
            [error]="name().trim().length >= 2 ? '' : 'common.required'"
            [(value)]="name"
          />
          <dba-text-area label="mkt.f.summary" [maxlength]="600" [rows]="3" [(value)]="summary" />
          <dba-text-area
            label="mkt.f.bullets"
            hint="mkt.form.bulletsHint"
            [error]="bulletsError()"
            [rows]="3"
            [(value)]="bullets"
          />
          <dba-text-area
            label="mkt.f.limitations"
            [maxlength]="1000"
            [rows]="2"
            [(value)]="limitations"
          />
        }

        <h3 class="dba-eyebrow form__section">{{ 'mkt.form.price' | translate }}</h3>
        <div class="form__pair">
          <dba-field
            [label]="kind() === 'ADDON' ? 'mkt.f.monthlyPrice' : 'mkt.f.unitPrice'"
            mono
            inputmode="numeric"
            [hint]="currencyHint()"
            [error]="wholeError(unitPrice())"
            [(value)]="unitPrice"
          />
          <dba-field
            label="mkt.f.taxPct"
            mono
            inputmode="numeric"
            [maxlength]="3"
            [error]="taxError()"
            [(value)]="taxPct"
          />
        </div>
        @if (kind() === 'VALIDATION_PACKAGE') {
          <dba-field
            label="mkt.f.minQuantity"
            mono
            inputmode="numeric"
            [error]="minQuantityError()"
            [(value)]="minQuantity"
          />
          <dba-tier-editor label="mkt.f.tiers" unit="mkt.queries" [(tiers)]="tiers" />
        }

        @if (!editing()) {
          <div class="form__switch">
            <p-toggleswitch
              inputId="mkt-visible"
              [ngModel]="visible()"
              (ngModelChange)="visible.set($event)"
            />
            <span class="form__switchCopy">
              <label class="form__label" for="mkt-visible">{{ 'mkt.f.visible' | translate }}</label>
              <span class="dba-meta">{{ 'mkt.form.visibleHint' | translate }}</span>
            </span>
          </div>
        }

        @if (editing() && changes().length > 0) {
          <div class="form__summary">
            @for (change of changes(); track change.key) {
              <span>{{ change.label | translate }}: {{ change.before }} → {{ change.after }}</span>
            }
          </div>
          <p class="dba-meta form__note--top">{{ 'mkt.form.versionWarning' | translate }}</p>
        }

        <dba-field
          label="mkt.f.reason"
          placeholder="mkt.form.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class ProductFormComponent implements OnInit {
  private readonly api = inject(MarketplaceApi);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  readonly product = input<ProductDetail | null>(null);
  readonly busy = input(false);
  readonly created = output<CreateProductBody>();
  readonly versioned = output<VersionProductBody>();
  readonly dismissed = output<void>();

  protected readonly kind = signal<ProductKind>('VALIDATION_PACKAGE');
  protected readonly creditType = signal<CreditType>('ani');
  protected readonly addonCode = signal<AddonCode>('pagares');
  protected readonly code = signal('');
  protected readonly codeTouched = signal(false);
  protected readonly currency = signal(DEFAULT_CURRENCY);
  protected readonly level = signal('1');
  protected readonly name = signal('');
  protected readonly summary = signal('');
  protected readonly bullets = signal('');
  protected readonly limitations = signal('');
  protected readonly unitPrice = signal('');
  protected readonly taxPct = signal('19');
  protected readonly minQuantity = signal('1');
  protected readonly tiers = signal<TierDraft[]>([]);
  protected readonly visible = signal(true);
  protected readonly reason = signal('');
  private readonly currencies = signal<string[]>([DEFAULT_CURRENCY]);

  protected readonly editing = computed(() => !!this.product());

  protected readonly kindOptions = computed(() =>
    (['VALIDATION_PACKAGE', 'ADDON'] as const).map((value) => ({
      value,
      label: this.translate.instant(`mkt.kind.${value}`) as string,
    })),
  );
  protected readonly creditOptions = computed(() =>
    CREDIT_TYPES.map((value) => ({
      value,
      label: this.translate.instant(`mkt.credit.${value}`) as string,
    })),
  );
  protected readonly addonOptions = computed(() =>
    ADDON_CODES.map((value) => ({
      value,
      label: this.translate.instant(`mkt.addon.${value}`) as string,
    })),
  );
  protected readonly currencyOptions = computed(() =>
    this.currencies().map((value) => ({ value, label: value })),
  );

  protected readonly codeError = computed(() =>
    CODE.test(this.code()) ? '' : 'mkt.form.codeInvalid',
  );
  protected readonly levelError = computed(() =>
    /^[1-9]$/.test(this.level().trim()) ? '' : 'mkt.form.levelInvalid',
  );
  protected readonly taxError = computed(() => {
    const value = this.taxPct().trim();
    return WHOLE.test(value) && Number(value) <= 100 ? '' : 'mkt.form.taxInvalid';
  });
  protected readonly minQuantityError = computed(() => {
    const value = this.minQuantity().trim();
    return WHOLE.test(value) && Number(value) >= 1 ? '' : 'mkt.form.minQuantityInvalid';
  });
  protected readonly bulletsError = computed(() => {
    const lines = bulletsOf(this.bullets());
    if (lines.length > 8) return 'mkt.form.bulletsTooMany';
    return lines.some((line) => line.length > 200) ? 'mkt.form.bulletTooLong' : '';
  });
  protected readonly currencyHint = computed(() => {
    const value = this.unitPrice().trim();
    const currency = this.product()?.currency ?? this.currency();
    return WHOLE.test(value) ? money(Number(value), currency, this.locale) : '';
  });

  protected readonly terms = computed(() => {
    const addon = this.kind() === 'ADDON';
    return {
      unitPrice: Number(this.unitPrice().trim() || 0),
      taxPct: Number(this.taxPct().trim() || 0),
      minQuantity: addon ? 1 : Number(this.minQuantity().trim() || 0),
      tiers: addon ? [] : tiersOf(this.tiers()),
    };
  });

  protected readonly changes = computed(() => {
    const product = this.product();
    if (!product) return [];
    const next = this.terms();
    const show = (value: number) => money(value, product.currency, this.locale);
    const out: { key: string; label: string; before: string; after: string }[] = [];
    if (product.unitPrice !== next.unitPrice)
      out.push({
        key: 'unitPrice',
        label: product.kind === 'ADDON' ? 'mkt.f.monthlyPrice' : 'mkt.f.unitPrice',
        before: show(product.unitPrice),
        after: show(next.unitPrice),
      });
    if (product.taxPct !== next.taxPct)
      out.push({
        key: 'taxPct',
        label: 'mkt.f.taxPct',
        before: `${product.taxPct} %`,
        after: `${next.taxPct} %`,
      });
    if (product.minQuantity !== next.minQuantity)
      out.push({
        key: 'minQuantity',
        label: 'mkt.f.minQuantity',
        before: String(product.minQuantity),
        after: String(next.minQuantity),
      });
    if (!sameTiers(product.tiers, next.tiers))
      out.push({
        key: 'tiers',
        label: 'mkt.f.tiers',
        before: tiersText(product.tiers, this.translate),
        after: tiersText(next.tiers, this.translate),
      });
    return out;
  });

  protected readonly valid = computed(() => {
    const prices =
      !this.wholeError(this.unitPrice()) &&
      !this.taxError() &&
      (this.kind() === 'ADDON' || (!this.minQuantityError() && !tierError(this.tiers())));
    const base = prices && !!this.reason().trim();
    if (this.editing()) return base && this.changes().length > 0;
    return (
      base &&
      !this.codeError() &&
      this.name().trim().length >= 2 &&
      !this.bulletsError() &&
      (this.kind() === 'ADDON' || !this.levelError())
    );
  });

  ngOnInit(): void {
    const product = this.product();
    if (product) {
      this.kind.set(product.kind);
      this.unitPrice.set(String(product.unitPrice));
      this.taxPct.set(String(product.taxPct));
      this.minQuantity.set(String(product.minQuantity));
      this.tiers.set(tierDraftsOf(product.tiers));
      return;
    }
    this.tiers.set(
      tierDraftsOf([
        { minQuantity: 100, discountPct: 0 },
        { minQuantity: 500, discountPct: 10 },
      ]),
    );
    this.suggestCode();
    void this.loadCurrencies();
  }

  protected wholeError(value: string): string {
    return WHOLE.test(value.trim()) ? '' : 'mkt.form.priceInvalid';
  }

  protected setCode(value: string): void {
    this.codeTouched.set(true);
    this.code.set(value.trim().toUpperCase());
  }

  protected pickKind(kind: ProductKind): void {
    this.kind.set(kind);
    this.suggestCode();
  }

  protected pickCredit(credit: CreditType): void {
    this.creditType.set(credit);
    this.level.set(String(LEVEL_OF[credit]));
    this.suggestCode();
  }

  protected pickAddon(code: AddonCode): void {
    this.addonCode.set(code);
    this.suggestCode();
  }

  protected pickCurrency(currency: string): void {
    this.currency.set(currency);
    this.suggestCode();
  }

  protected submit(): void {
    if (!this.valid()) return;
    const terms = this.terms();
    const reason = this.reason().trim();
    const product = this.product();
    if (product) {
      const changed = new Set(this.changes().map((c) => c.key));
      const body: VersionProductBody = { reason };
      if (changed.has('unitPrice')) body.unitPrice = terms.unitPrice;
      if (changed.has('taxPct')) body.taxPct = terms.taxPct;
      if (changed.has('minQuantity')) body.minQuantity = terms.minQuantity;
      if (changed.has('tiers')) body.tiers = terms.tiers;
      this.versioned.emit(body);
      return;
    }
    const addon = this.kind() === 'ADDON';
    this.created.emit({
      ...terms,
      code: this.code(),
      kind: this.kind(),
      ...(addon
        ? { addonCode: this.addonCode() }
        : { creditType: this.creditType(), level: Number(this.level().trim()) }),
      currency: this.currency(),
      name: this.name().trim(),
      summary: this.summary().trim(),
      bullets: bulletsOf(this.bullets()),
      limitations: this.limitations().trim(),
      visible: this.visible(),
      reason,
    });
  }

  private suggestCode(): void {
    if (this.codeTouched() || this.editing()) return;
    const base =
      this.kind() === 'ADDON'
        ? `ADDON_${this.addonCode().toUpperCase()}`
        : `VAL_${this.creditType() === 'ani' ? 'ANI' : this.creditType().toUpperCase()}`;
    this.code.set(this.currency() === DEFAULT_CURRENCY ? base : `${base}_${this.currency()}`);
  }

  private async loadCurrencies(): Promise<void> {
    try {
      const countries = await firstValueFrom(this.api.countries());
      const found = [
        ...new Set(countries.map((c) => c.currency).filter((c) => /^[A-Z]{3}$/.test(c ?? ''))),
      ];
      if (found.length > 0) this.currencies.set(found.sort());
    } catch {
      return;
    }
  }
}
