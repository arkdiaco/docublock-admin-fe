import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { HttpErrorResponse } from '@angular/common/http';
import { LegacyLinkFormComponent } from '../components/legacy-link-form.component';
import { PlanFormComponent } from '../components/plan-form.component';
import { StripeLinkFormComponent } from '../components/stripe-link-form.component';
import { LIMIT_LABEL, limitText, money, versionTerms } from '../data/plan-format';
import { priceLabel } from '../data/plan-labels';
import { PlansApi } from '../data/plans.api';
import {
  LIMIT_KEYS,
  type PlanDetail,
  type PlanVersion,
  type StripeLinkBody,
  type VersionPlanBody,
} from '../data/plans.models';

const ACTION_ERRORS = [
  'PLAN_SIN_CAMBIOS',
  'PLAN_RETIRADO',
  'PLAN_EN_CAMBIO',
  'PLAN_DATOS_INVALIDOS',
  'PAIS_NO_EXISTE',
  'PLAN_DEMO_PROTEGIDO',
  'PLAN_ACTIVO',
  'PLAN_SIN_STRIPE',
  'PLAN_LEGACY_NO_EXISTE',
  'STRIPE_PRECIO_NO_EXISTE',
  'STRIPE_PRECIO_INACTIVO',
  'STRIPE_INTERVALO_DISTINTO',
  'STRIPE_MONEDA_DISTINTA',
  'STRIPE_MONTO_DISTINTO',
  'STRIPE_PRECIO_EN_USO',
  'STRIPE_PAR_INCOMPLETO',
  'STRIPE_NO_DISPONIBLE',
];

const VERSION_COLUMNS: readonly DataColumn[] = [
  { key: 'version', labelKey: 'plans.col.version', width: '90px' },
  { key: 'date', labelKey: 'plans.col.date', width: '120px' },
  { key: 'state', labelKey: 'plans.col.state', width: '130px' },
  { key: 'price', labelKey: 'plans.col.price', width: 'minmax(0, 1fr)' },
  { key: 'documents', labelKey: 'plans.col.documents', width: '100px', align: 'end' },
  { key: 'subscribers', labelKey: 'plans.col.subscribers', width: '110px', align: 'end' },
  { key: 'stripe', labelKey: 'plans.col.stripe', width: '130px' },
];

const reasonField = {
  labelKey: 'plans.f.reason',
  placeholder: 'plans.form.reasonPlaceholder',
  limit: 500,
  quick: [],
  required: true,
};

@Component({
  selector: 'dba-plan-detail',
  imports: [
    TranslatePipe,
    RecordHeaderComponent,
    OrgStateComponent,
    ButtonComponent,
    ActionMenuComponent,
    DataTableComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    PlanFormComponent,
    StripeLinkFormComponent,
    LegacyLinkFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'plans.detailLoading' | translate" />
    } @else if (error()) {
      <div class="pd__panel">
        <dba-empty-state
          [titleKey]="error() === 'PLAN_NO_EXISTE' ? 'plans.notFound' : 'plans.errorTitle'"
        />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (plan(); as data) {
      <div class="pd">
        <dba-record-header
          [initials]="data.family.slice(0, 2)"
          [title]="data.name"
          [state]="data.state === 'ACTIVE' ? 'active' : 'closed'"
          [stateLabelKey]="'plans.state.' + data.state"
          [meta]="meta()"
        >
          @if (canManage()) {
            <div actions class="pd__actions">
              @if (data.state === 'ACTIVE') {
                <button dba-button (click)="versioning.set(true)">
                  {{ 'plans.newVersion' | translate }}
                </button>
              }
              @if (menuItems().length > 0) {
                <button
                  dba-button
                  variant="secondary"
                  [busy]="working()"
                  (click)="menu.toggle($event)"
                >
                  {{ 'plans.more' | translate }}
                </button>
                <dba-action-menu
                  #menu
                  label="plans.more"
                  [items]="menuItems()"
                  (picked)="pick($event)"
                />
              }
            </div>
          }
        </dba-record-header>

        <div class="pd__cols">
          <section class="pd__card">
            <h2 class="dba-panel">{{ 'plans.terms' | translate }}</h2>
            <dl class="pd__dl">
              <dt>{{ 'plans.f.family' | translate }}</dt>
              <dd>{{ data.family }} · {{ 'plans.kind.' + data.kind | translate }}</dd>
              <dt>{{ 'plans.col.price' | translate }}</dt>
              <dd>{{ price() }}</dd>
              @if (data.kind === 'SUBSCRIPTION' && !data.negotiated && data.priceAnnual > 0) {
                <dt>{{ 'plans.f.priceAnnual' | translate }}</dt>
                <dd>{{ annual() }}</dd>
              }
              @if (data.kind === 'PACKAGE') {
                <dt>{{ 'plans.f.validityMonths' | translate }}</dt>
                <dd>{{ 'plans.months' | translate: { months: data.validityMonths } }}</dd>
              }
              <dt>{{ 'plans.f.country' | translate }}</dt>
              <dd>{{ data.countryName || ('plans.allCountries' | translate) }}</dd>
              <dt>{{ 'plans.f.visible' | translate }}</dt>
              <dd>{{ (data.visible ? 'plans.visibleYes' : 'plans.visibleNo') | translate }}</dd>
            </dl>
          </section>

          <section class="pd__card">
            <h2 class="dba-panel">{{ 'plans.form.limits' | translate }}</h2>
            <dl class="pd__dl">
              @for (key of limitKeys; track key) {
                <dt>{{ limitLabel[key] | translate }}</dt>
                <dd class="dba-mono">{{ limit(data.limits[key]) }}</dd>
              }
            </dl>
            <h3 class="dba-eyebrow">{{ 'plans.features' | translate }}</h3>
            <p class="dba-meta pd__features">
              {{ data.features.length ? data.features.join(' · ') : '—' }}
            </p>
            <p class="dba-meta">{{ 'plans.featuresHint' | translate }}</p>
          </section>

          <section class="pd__card">
            <header class="pd__head">
              <h2 class="dba-panel">{{ 'plans.col.stripe' | translate }}</h2>
              @if (canLink() && data.stripeReady !== null) {
                <button dba-button variant="secondary" (click)="linkingStripe.set(true)">
                  {{ 'plans.stripeLink.open' | translate }}
                </button>
              }
            </header>
            <dl class="pd__dl">
              <dt>{{ 'plans.stripeLink.state' | translate }}</dt>
              <dd [class.pd__warn]="data.stripeReady === false">
                {{ stripeKey(data.stripeReady) | translate }}
              </dd>
              @if (data.stripeReady !== null) {
                <dt>{{ 'plans.stripeLink.monthly' | translate }}</dt>
                <dd class="dba-mono">{{ currentStripe().monthly || '—' }}</dd>
                <dt>{{ 'plans.stripeLink.annual' | translate }}</dt>
                <dd class="dba-mono">{{ currentStripe().annual || '—' }}</dd>
              } @else {
                <dd class="pd__full dba-meta">{{ 'plans.stripeLink.na' | translate }}</dd>
              }
            </dl>
          </section>

          <section class="pd__card">
            <header class="pd__head">
              <h2 class="dba-panel">{{ 'plans.legacyLink.card' | translate }}</h2>
              @if (canLink()) {
                <button dba-button variant="secondary" (click)="linkingLegacy.set(true)">
                  {{ 'plans.legacyLink.open' | translate }}
                </button>
              }
            </header>
            <p class="pd__legacy">
              {{ data.legacyPlan?.name || ('plans.legacyLink.none' | translate) }}
            </p>
            <p class="dba-meta">{{ 'plans.legacyLink.cardHint' | translate }}</p>
          </section>
        </div>

        <section class="pd__card">
          <h2 class="dba-panel">
            {{ 'plans.history' | translate: { total: data.history.length } }}
          </h2>
          <dba-data-table
            [columns]="versionColumns"
            [label]="'plans.historyLabel' | translate"
            minWidth="980px"
          >
            @for (version of data.history; track version.id) {
              <div class="dba-tr">
                <code class="dba-td">v{{ version.version }}</code>
                <span class="dba-td dba-mono">{{ day(version.createdAt) }}</span>
                <span class="dba-td">
                  <dba-org-state
                    [state]="version.state === 'ACTIVE' ? 'active' : 'closed'"
                    [labelKey]="'plans.state.' + version.state"
                    variant="inline"
                  />
                </span>
                <span class="dba-td">{{ versionPrice(version) }}</span>
                <code class="dba-td dba-td--end">{{ limit(version.limits.documents) }}</code>
                <code class="dba-td dba-td--end">{{ version.subscribers }}</code>
                <span class="dba-td" [class.pd__warn]="version.stripeReady === false">{{
                  stripeKey(version.stripeReady) | translate
                }}</span>
              </div>
            }
          </dba-data-table>
        </section>
      </div>

      @if (versioning()) {
        <dba-plan-form
          [plan]="data"
          [busy]="working()"
          (versioned)="version($event)"
          (dismissed)="versioning.set(false)"
        />
      }

      @if (linkingStripe()) {
        <dba-stripe-link-form
          [plan]="data"
          [monthlyAmount]="monthly()"
          [annualAmount]="annual()"
          [busy]="working()"
          (submitted)="linkStripe($event)"
          (dismissed)="linkingStripe.set(false)"
        />
      }

      @if (linkingLegacy()) {
        <dba-legacy-link-form
          [plan]="data"
          [busy]="working()"
          (submitted)="linkLegacy($event)"
          (dismissed)="linkingLegacy.set(false)"
        />
      }
    }
  `,
  styles: `
    .pd {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .pd__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pd__cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--dba-grid-gap);
      align-items: start;
    }

    .pd__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .pd__card h2,
    .pd__card h3,
    .pd__card p {
      margin: 0;
    }

    .pd__dl {
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }

    .pd__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .pd__dl dd {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .pd__features {
      font-family: var(--dba-font-mono);
      overflow-wrap: anywhere;
    }

    .pd__warn {
      color: var(--dba-state-suspended-fg);
    }

    .pd__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pd__full {
      grid-column: 1 / -1;
    }

    .pd__legacy {
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
    }

    .pd__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    @media (max-width: 860px) {
      .pd__cols {
        grid-template-columns: minmax(0, 1fr);
      }

      .pd__dl {
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
      }

      .pd__dl dd {
        margin-bottom: 8px;
      }
    }
  `,
})
export class PlanDetailComponent {
  readonly code = input.required<string>();

  private readonly api = inject(PlansApi);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly dialogs = inject(DialogService);
  private readonly auth = inject(AuthStore);
  private readonly latest = new LatestRequest();

  protected readonly limitKeys = LIMIT_KEYS;
  protected readonly limitLabel = LIMIT_LABEL;
  protected readonly versionColumns = VERSION_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly plan = signal<PlanDetail | null>(null);
  protected readonly versioning = signal(false);
  protected readonly working = signal(false);
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly linkingStripe = signal(false);
  protected readonly linkingLegacy = signal(false);
  protected readonly canLink = computed(() => this.canManage() && this.plan()?.state === 'ACTIVE');

  protected readonly currentStripe = computed(() => {
    const plan = this.plan();
    const version = plan?.history.find((v) => v.version === plan.version);
    return { monthly: version?.stripe.monthly ?? null, annual: version?.stripe.annual ?? null };
  });

  protected readonly meta = computed(() => {
    const plan = this.plan();
    if (!plan) return '';
    return [
      `${plan.code} · v${plan.version}`,
      plan.countryName ?? (this.translate.instant('plans.allCountries') as string),
      this.translate.instant('plans.subscribersMeta', { total: plan.subscribers }) as string,
    ].join(' · ');
  });

  protected readonly price = computed(() => {
    const plan = this.plan();
    return plan ? priceLabel(plan, this.translate, this.locale) : '';
  });

  protected readonly monthly = computed(() => {
    const plan = this.plan();
    return plan ? money(plan.priceMonthly, plan.currency, this.locale) : '';
  });

  protected readonly annual = computed(() => {
    const plan = this.plan();
    return plan ? money(plan.priceAnnual, plan.currency, this.locale) : '';
  });

  protected readonly menuItems = computed<ActionMenuItem[]>(() => {
    const plan = this.plan();
    if (!plan) return [];
    if (plan.state === 'RETIRED') return [{ key: 'reactivate', labelKey: 'plans.reactivate' }];
    const items: ActionMenuItem[] = [];
    if (!plan.visible) items.push({ key: 'show', labelKey: 'plans.show' });
    else if (!plan.protected) items.push({ key: 'hide', labelKey: 'plans.hide' });
    if (!plan.protected)
      items.push({ key: 'retire', labelKey: 'plans.retire', danger: true, separated: true });
    return items;
  });

  constructor() {
    effect(() => {
      const code = this.code();
      untracked(() => void this.load(code));
    });
  }

  protected reload(): void {
    void this.load(this.code());
  }

  protected limit(value: number | null): string {
    return limitText(value);
  }

  protected versionPrice(version: PlanVersion): string {
    const plan = this.plan();
    return plan ? priceLabel(versionTerms(version, plan.kind), this.translate, this.locale) : '';
  }

  protected stripeKey(ready: boolean | null): string {
    if (ready === null) return 'plans.stripe.na';
    return ready ? 'plans.stripe.ready' : 'plans.stripe.pending';
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected pick(key: string): void {
    const plan = this.plan();
    if (!plan) return;
    if (key === 'hide' || key === 'show') void this.toggleVisible(plan, key === 'show');
    else if (key === 'retire') void this.retire(plan);
    else if (key === 'reactivate') void this.reactivate(plan);
  }

  protected async version(body: VersionPlanBody): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    const done = await this.run(this.api.version(plan.code, body), 'plans.done.versioned');
    if (!done) return;
    this.versioning.set(false);
    if ('stripePending' in done && done.stripePending) {
      this.notify.info(this.translate.instant('plans.done.stripePending') as string);
    }
  }

  protected async linkStripe(body: StripeLinkBody): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    const done = await this.run(
      this.api.linkStripe(plan.code, body),
      body.monthly ? 'plans.done.stripeLinked' : 'plans.done.stripeUnlinked',
    );
    if (done) this.linkingStripe.set(false);
  }

  protected async linkLegacy(choice: {
    legacyPlanId: string | null;
    reason: string;
  }): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    const done = await this.run(
      this.api.linkLegacy(plan.code, choice.legacyPlanId, choice.reason),
      'plans.done.legacyLinked',
    );
    if (done) this.linkingLegacy.set(false);
  }

  private async toggleVisible(plan: PlanDetail, visible: boolean): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'primary',
      icon: 'eye',
      title: visible ? 'plans.showTitle' : 'plans.hideTitle',
      message: visible ? 'plans.showMessage' : 'plans.hideMessage',
      params: { name: plan.name },
      confirmLabel: visible ? 'plans.show' : 'plans.hide',
      reason: reasonField,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.run(
      this.api.setVisible(plan.code, visible, answer.reason),
      visible ? 'plans.done.shown' : 'plans.done.hidden',
    );
  }

  private async retire(plan: PlanDetail): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'plans.retireTitle',
      message: 'plans.retireMessage',
      params: { name: plan.name, total: plan.subscribers },
      confirmLabel: 'plans.retire',
      reason: reasonField,
      challenge: { identifier: plan.code, actionKey: 'plans.retireVerb' },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.run(this.api.retire(plan.code, answer.reason), 'plans.done.retired');
  }

  private async reactivate(plan: PlanDetail): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'primary',
      icon: 'circleCheck',
      title: 'plans.reactivateTitle',
      message: 'plans.reactivateMessage',
      params: { name: plan.name },
      confirmLabel: 'plans.reactivate',
      reason: reasonField,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.run(this.api.reactivate(plan.code, answer.reason), 'plans.done.reactivated');
  }

  private async run<T extends PlanDetail>(
    request: Observable<T>,
    doneKey: string,
  ): Promise<T | null> {
    this.working.set(true);
    try {
      const updated = await firstValueFrom(request);
      this.plan.set(updated);
      this.notify.success(this.translate.instant(doneKey) as string);
      return updated;
    } catch (failure) {
      const code = errorCodeOf(failure);
      this.notify.error(
        this.translate.instant(
          code && ACTION_ERRORS.includes(code) ? `plans.error.${code}` : 'plans.error.generic',
          this.errorParams(failure),
        ) as string,
      );
      return null;
    } finally {
      this.working.set(false);
    }
  }

  private errorParams(failure: unknown): Record<string, string> {
    const body =
      failure instanceof HttpErrorResponse
        ? (failure.error as Record<string, unknown> | null)
        : null;
    if (!body) return {};
    const plan = this.plan();
    const code = body['code'];
    const show = (value: unknown): string => {
      if (code === 'STRIPE_MONTO_DISTINTO' && typeof value === 'number' && plan) {
        return money(value, plan.currency, this.locale);
      }
      if (code === 'STRIPE_INTERVALO_DISTINTO') {
        return value ? (this.translate.instant(`plans.interval.${String(value)}`) as string) : '—';
      }
      return String(value ?? '—');
    };
    const slot = body['slot'] === 'annual' ? 'plans.stripeLink.annual' : 'plans.stripeLink.monthly';
    return {
      slot: (this.translate.instant(slot) as string).toLowerCase(),
      expected: show(body['expected']),
      actual: show(body['actual']),
      plan: String(body['plan'] ?? ''),
    };
  }

  private async load(code: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(null);
    try {
      const detail = await firstValueFrom(this.api.detail(code));
      if (current()) this.plan.set(detail);
    } catch (failure) {
      if (!current()) return;
      this.plan.set(null);
      this.error.set(errorCodeOf(failure) ?? 'generic');
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}
