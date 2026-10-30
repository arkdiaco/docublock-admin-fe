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
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { LIMIT_LABEL, limitText, money } from '../data/plan-format';
import { PlansApi } from '../data/plans.api';
import {
  LIMIT_KEYS,
  NEGOTIATED_PRICE,
  PLAN_FAMILIES,
  type CountryOption,
  type CreatePlanBody,
  type LimitKey,
  type PlanDetail,
  type PlanKind,
  type PlanLimits,
  type VersionPlanBody,
} from '../data/plans.models';

const CODE = /^[A-Z0-9_]{2,40}$/;
const CURRENCY = /^[A-Z]{3}$/;
const COUNT = /^\d{1,8}$/;
const ALL_COUNTRIES = '';

type LimitDrafts = Record<LimitKey, string>;

const countOf = (value: string): number | null =>
  value.trim() === '' ? null : Number(value.trim());
const isCount = (value: string): boolean => value.trim() === '' || COUNT.test(value.trim());
const priceText = (value: number | null): string =>
  value === null || value < 0 ? '' : String(value);

@Component({
  selector: 'dba-plan-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="market"
      [title]="(editing() ? 'plans.form.versionTitle' : 'plans.form.createTitle') | translate"
      [subtitle]="editing() ? plan()!.name + ' · ' + plan()!.code : ''"
      [confirmLabel]="editing() ? 'plans.form.versionConfirm' : 'plans.form.createConfirm'"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="640"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (editing()) {
          <p class="dba-meta form__note--top">{{ 'plans.form.versionLead' | translate }}</p>
        } @else {
          <div class="form__pair">
            <div class="form__control">
              <label class="form__label" for="plan-family">{{
                'plans.f.family' | translate
              }}</label>
              <p-select
                inputId="plan-family"
                [options]="families"
                [ngModel]="family()"
                (ngModelChange)="pickFamily($event)"
                appendTo="body"
                styleClass="form__select"
              />
              <span class="dba-meta">{{ 'plans.kind.' + kind() | translate }}</span>
            </div>
            <dba-field
              label="plans.f.code"
              mono
              [maxlength]="40"
              [hint]="codeTouched() ? '' : 'plans.form.codeHint'"
              [error]="codeError()"
              [value]="code()"
              (valueChange)="setCode($event)"
            />
          </div>
        }

        <dba-field
          label="plans.f.name"
          [maxlength]="80"
          [error]="name().trim().length >= 2 ? '' : 'common.required'"
          [(value)]="name"
        />

        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="plan-country">{{
              'plans.f.country' | translate
            }}</label>
            <p-select
              inputId="plan-country"
              [options]="countryOptions()"
              optionLabel="name"
              optionValue="id"
              [filter]="true"
              [ngModel]="countryId()"
              (ngModelChange)="countryId.set($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          <dba-field
            label="plans.f.currency"
            mono
            [maxlength]="3"
            [error]="currencyError()"
            [(value)]="currency"
          />
        </div>

        <h3 class="dba-eyebrow form__section">{{ 'plans.form.prices' | translate }}</h3>
        @if (kind() === 'PACKAGE') {
          <div class="form__pair">
            <dba-field
              label="plans.f.priceOnce"
              mono
              inputmode="numeric"
              [error]="priceOnceError()"
              [(value)]="priceOnce"
            />
            <dba-field
              label="plans.f.validityMonths"
              mono
              inputmode="numeric"
              [error]="validityError()"
              [(value)]="validityMonths"
            />
          </div>
        } @else {
          <div class="form__switch form__switch--bare">
            <p-toggleswitch
              inputId="plan-negotiated"
              [ngModel]="negotiated()"
              (ngModelChange)="negotiated.set($event)"
            />
            <span class="form__switchCopy">
              <label class="form__label" for="plan-negotiated">{{
                'plans.f.negotiated' | translate
              }}</label>
              <span class="dba-meta">{{ 'plans.form.negotiatedHint' | translate }}</span>
            </span>
          </div>
          @if (!negotiated()) {
            <div class="form__pair">
              <dba-field
                label="plans.f.priceMonthly"
                mono
                inputmode="numeric"
                [error]="priceError(priceMonthly())"
                [(value)]="priceMonthly"
              />
              <dba-field
                label="plans.f.priceAnnual"
                mono
                inputmode="numeric"
                [error]="priceError(priceAnnual())"
                [(value)]="priceAnnual"
              />
            </div>
          }
        }

        <h3 class="dba-eyebrow form__section">{{ 'plans.form.limits' | translate }}</h3>
        <p class="dba-meta form__note">{{ 'plans.form.limitsHint' | translate }}</p>
        <div class="form__pair">
          @for (key of limitKeys; track key) {
            <dba-field
              [label]="limitLabel[key]"
              mono
              inputmode="numeric"
              [placeholder]="'plans.form.unlimited'"
              [error]="isCount(limits()[key]) ? '' : 'plans.form.countInvalid'"
              [value]="limits()[key]"
              (valueChange)="setLimit(key, $event)"
            />
          }
        </div>

        @if (!editing()) {
          <div class="form__switch">
            <p-toggleswitch
              inputId="plan-visible"
              [ngModel]="visible()"
              (ngModelChange)="visible.set($event)"
            />
            <span class="form__switchCopy">
              <label class="form__label" for="plan-visible">{{
                'plans.f.visible' | translate
              }}</label>
              <span class="dba-meta">{{ 'plans.form.visibleHint' | translate }}</span>
            </span>
          </div>
        }

        @if (editing() && changes().length > 0) {
          <div class="form__summary">
            @for (change of changes(); track change.label) {
              <span>{{ change.label | translate }}: {{ change.before }} → {{ change.after }}</span>
            }
          </div>
          @if (stripeWarning()) {
            <p class="dba-meta form__note--top">{{ 'plans.form.stripeWarning' | translate }}</p>
          }
        }

        <dba-field
          label="plans.f.reason"
          placeholder="plans.form.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class PlanFormComponent implements OnInit {
  private readonly api = inject(PlansApi);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  readonly plan = input<PlanDetail | null>(null);
  readonly busy = input(false);
  readonly created = output<CreatePlanBody>();
  readonly versioned = output<VersionPlanBody>();
  readonly dismissed = output<void>();

  protected readonly families = PLAN_FAMILIES.map((family) => ({ label: family, value: family }));
  protected readonly limitKeys = LIMIT_KEYS;
  protected readonly limitLabel = LIMIT_LABEL;
  protected readonly isCount = isCount;

  protected readonly family = signal<string>('CORE');
  protected readonly code = signal('');
  protected readonly codeTouched = signal(false);
  protected readonly name = signal('');
  protected readonly countryId = signal<string>(ALL_COUNTRIES);
  protected readonly currency = signal('COP');
  protected readonly negotiated = signal(false);
  protected readonly priceMonthly = signal('');
  protected readonly priceAnnual = signal('');
  protected readonly priceOnce = signal('');
  protected readonly validityMonths = signal('6');
  protected readonly limits = signal<LimitDrafts>({
    documents: '',
    idBiometric: '0',
    idAni: '0',
    idIdentity: '0',
  });
  protected readonly visible = signal(true);
  protected readonly reason = signal('');
  private readonly countries = signal<CountryOption[]>([]);

  protected readonly editing = computed(() => !!this.plan());
  protected readonly kind = computed<PlanKind>(
    () => this.plan()?.kind ?? (this.family() === 'PAYG' ? 'PACKAGE' : 'SUBSCRIPTION'),
  );

  protected readonly countryOptions = computed(() => [
    { id: ALL_COUNTRIES, name: this.translate.instant('plans.allCountries') as string },
    ...this.countries(),
  ]);

  protected readonly codeError = computed(() =>
    CODE.test(this.code()) ? '' : 'plans.form.codeInvalid',
  );
  protected readonly currencyError = computed(() =>
    CURRENCY.test(this.currency().trim().toUpperCase()) ? '' : 'plans.form.currencyInvalid',
  );
  protected readonly priceOnceError = computed(() =>
    COUNT.test(this.priceOnce().trim()) && Number(this.priceOnce()) > 0
      ? ''
      : 'plans.form.priceInvalid',
  );
  protected readonly validityError = computed(() => {
    const months = Number(this.validityMonths().trim());
    return COUNT.test(this.validityMonths().trim()) && months >= 1 && months <= 60
      ? ''
      : 'plans.form.validityInvalid';
  });

  protected readonly terms = computed(() => {
    const pkg = this.kind() === 'PACKAGE';
    const negotiated = !pkg && this.negotiated();
    const limits = Object.fromEntries(
      LIMIT_KEYS.map((key) => [key, countOf(this.limits()[key])]),
    ) as PlanLimits;
    return {
      name: this.name().trim(),
      countryId: this.countryId() || null,
      currency: this.currency().trim().toUpperCase(),
      priceMonthly: pkg ? 0 : negotiated ? NEGOTIATED_PRICE : Number(this.priceMonthly() || 0),
      priceAnnual: pkg ? 0 : negotiated ? NEGOTIATED_PRICE : Number(this.priceAnnual() || 0),
      priceOnce: pkg ? Number(this.priceOnce() || 0) : null,
      validityMonths: pkg ? Number(this.validityMonths() || 0) : null,
      limits,
    };
  });

  protected readonly changes = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    const next = this.terms();
    const out: { label: string; key: string; before: string; after: string }[] = [];
    const add = (key: string, label: string, before: string, after: string) => {
      if (before !== after) out.push({ key, label, before, after });
    };
    add('name', 'plans.f.name', plan.name, next.name);
    add(
      'countryId',
      'plans.f.country',
      this.countryName(plan.countryId ?? null),
      this.countryName(next.countryId),
    );
    add('currency', 'plans.f.currency', plan.currency, next.currency);
    add(
      'priceMonthly',
      'plans.f.priceMonthly',
      this.price(plan.priceMonthly, plan.currency),
      this.price(next.priceMonthly, next.currency),
    );
    add(
      'priceAnnual',
      'plans.f.priceAnnual',
      this.price(plan.priceAnnual, plan.currency),
      this.price(next.priceAnnual, next.currency),
    );
    add(
      'priceOnce',
      'plans.f.priceOnce',
      this.price(plan.priceOnce, plan.currency),
      this.price(next.priceOnce, next.currency),
    );
    add(
      'validityMonths',
      'plans.f.validityMonths',
      String(plan.validityMonths ?? '—'),
      String(next.validityMonths ?? '—'),
    );
    for (const key of LIMIT_KEYS) {
      add(
        `limits.${key}`,
        LIMIT_LABEL[key],
        limitText(plan.limits[key]),
        limitText(next.limits[key]),
      );
    }
    return out;
  });

  protected readonly stripeWarning = computed(
    () =>
      this.plan()?.stripeReady === true && this.changes().some((c) => c.key.startsWith('price')),
  );

  protected readonly valid = computed(() => {
    const pkg = this.kind() === 'PACKAGE';
    const prices = pkg
      ? !this.priceOnceError() && !this.validityError()
      : this.negotiated() ||
        (!this.priceError(this.priceMonthly()) && !this.priceError(this.priceAnnual()));
    const base =
      this.name().trim().length >= 2 &&
      !this.currencyError() &&
      prices &&
      LIMIT_KEYS.every((key) => isCount(this.limits()[key])) &&
      !!this.reason().trim();
    if (this.editing()) return base && this.changes().length > 0;
    return base && !this.codeError();
  });

  ngOnInit(): void {
    const plan = this.plan();
    if (plan) {
      this.family.set(plan.family);
      this.code.set(plan.code);
      this.name.set(plan.name);
      this.countryId.set(plan.countryId ?? ALL_COUNTRIES);
      this.currency.set(plan.currency);
      this.negotiated.set(plan.negotiated);
      this.priceMonthly.set(priceText(plan.priceMonthly));
      this.priceAnnual.set(priceText(plan.priceAnnual));
      this.priceOnce.set(priceText(plan.priceOnce));
      this.validityMonths.set(plan.validityMonths === null ? '' : String(plan.validityMonths));
      this.limits.set(
        Object.fromEntries(
          LIMIT_KEYS.map((key) => [key, plan.limits[key] === null ? '' : String(plan.limits[key])]),
        ) as LimitDrafts,
      );
      if (plan.countryId && plan.countryName)
        this.countries.set([{ id: plan.countryId, name: plan.countryName }]);
    } else {
      this.suggestCode();
    }
    void this.loadCountries();
  }

  protected priceError(value: string): string {
    return COUNT.test(value.trim()) ? '' : 'plans.form.priceInvalid';
  }

  protected setCode(value: string): void {
    this.codeTouched.set(true);
    this.code.set(value.trim().toUpperCase());
  }

  protected pickFamily(family: string): void {
    this.family.set(family);
    this.suggestCode();
  }

  protected setLimit(key: LimitKey, value: string): void {
    this.limits.update((current) => ({ ...current, [key]: value }));
    if (key === 'documents') this.suggestCode();
  }

  protected submit(): void {
    if (!this.valid()) return;
    const terms = this.terms();
    const reason = this.reason().trim();
    const plan = this.plan();
    if (!plan) {
      this.created.emit({
        ...terms,
        countryId: terms.countryId ?? undefined,
        code: this.code(),
        family: this.family(),
        kind: this.kind(),
        visible: this.visible(),
        reason,
      });
      return;
    }
    const changed = new Set(this.changes().map((c) => c.key));
    const body: VersionPlanBody = { reason };
    if (changed.has('name')) body.name = terms.name;
    if (changed.has('countryId')) body.countryId = terms.countryId;
    if (changed.has('currency')) body.currency = terms.currency;
    if (changed.has('priceMonthly')) body.priceMonthly = terms.priceMonthly;
    if (changed.has('priceAnnual')) body.priceAnnual = terms.priceAnnual;
    if (changed.has('priceOnce')) body.priceOnce = terms.priceOnce;
    if (changed.has('validityMonths')) body.validityMonths = terms.validityMonths;
    const limits = LIMIT_KEYS.filter((key) => changed.has(`limits.${key}`));
    if (limits.length > 0)
      body.limits = Object.fromEntries(limits.map((key) => [key, terms.limits[key]]));
    this.versioned.emit(body);
  }

  private suggestCode(): void {
    if (this.codeTouched() || this.editing()) return;
    const documents = this.limits().documents.trim();
    const family = this.family();
    this.code.set(
      documents && family !== 'GOVERNANCE' && family !== 'DEMO' ? `${family}_${documents}` : family,
    );
  }

  private price(value: number | null, currency: string): string {
    if (value === null) return '—';
    if (value === NEGOTIATED_PRICE) return this.translate.instant('plans.negotiated') as string;
    return money(value, currency, this.locale);
  }

  private countryName(id: string | null): string {
    if (!id) return this.translate.instant('plans.allCountries') as string;
    return this.countries().find((c) => c.id === id)?.name ?? id;
  }

  private async loadCountries(): Promise<void> {
    try {
      const found = await firstValueFrom(this.api.countries());
      this.countries.set(found.map((c) => ({ id: c.id, name: c.name })));
    } catch {
      return;
    }
  }
}
