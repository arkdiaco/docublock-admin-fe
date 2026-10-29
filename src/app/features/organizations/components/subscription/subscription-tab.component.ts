import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DialogService } from '../../../../core/ui/dialog.service';
import { NotificationService } from '../../../../core/ui/notification.service';
import { errorCodeOf } from '../../../../shared/http/error-code';
import { LatestRequest } from '../../../../shared/http/latest-request';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../../shared/ui/org-state.component';
import { QuotaBarComponent } from '../../../../shared/ui/quota-bar.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { SubscriptionApi } from '../../data/subscription.api';
import type {
  AssignPlanBody,
  CounterBody,
  PeriodBody,
  SubscriptionCounter,
  SubscriptionView,
} from '../../data/subscription.models';
import { AssignPlanFormComponent } from './assign-plan-form.component';
import { CounterFormComponent } from './counter-form.component';
import { PeriodFormComponent } from './period-form.component';

const HISTORY_COLUMNS: readonly DataColumn[] = [
  { key: 'plan', labelKey: 'sub.col.plan', width: 'minmax(0, 1.4fr)' },
  { key: 'source', labelKey: 'sub.col.source', width: '110px' },
  { key: 'period', labelKey: 'sub.col.period', width: 'minmax(0, 1.2fr)' },
  { key: 'state', labelKey: 'sub.col.state', width: '120px' },
];

const KNOWN_ERRORS = [
  'PLAN_NO_ENCONTRADO',
  'PLAN_NO_DISPONIBLE_EN_PAIS',
  'VENCIMIENTO_PASADO',
  'SIN_SUSCRIPCION',
  'CONTADOR_NO_EXISTE',
];

type Open =
  | { kind: 'assign' }
  | { kind: 'period' }
  | { kind: 'counter'; counter: SubscriptionCounter }
  | null;

@Component({
  selector: 'dba-subscription-tab',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    OrgStateComponent,
    QuotaBarComponent,
    SectionLoaderComponent,
    AssignPlanFormComponent,
    PeriodFormComponent,
    CounterFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'sub.loading' | translate" />
    } @else if (error()) {
      <div class="sub__panel">
        <dba-empty-state titleKey="sub.errorTitle" leadKey="sub.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (view(); as data) {
      <div class="sub">
        <section class="sub__card">
          <header class="sub__head">
            <h2 class="dba-panel">{{ 'sub.current' | translate }}</h2>
            @if (canManage()) {
              <div class="sub__actions">
                <button dba-button (click)="open.set({ kind: 'assign' })">
                  {{ 'sub.assign.open' | translate }}
                </button>
                @if (data.current) {
                  <button dba-button variant="secondary" (click)="open.set({ kind: 'period' })">
                    {{ 'sub.period.open' | translate }}
                  </button>
                  @if (data.current.periodEnd) {
                    <button dba-button variant="secondary" [busy]="working()" (click)="noExpiry()">
                      {{ 'sub.noExpiry.open' | translate }}
                    </button>
                  }
                  <button dba-button variant="destructive" [busy]="working()" (click)="expire()">
                    {{ 'sub.expire.open' | translate }}
                  </button>
                }
              </div>
            }
          </header>

          @if (data.current; as current) {
            <dl class="sub__dl">
              <dt>{{ 'sub.f.plan' | translate }}</dt>
              <dd>
                {{ current.plan?.name || '—' }}
                @if (current.plan) {
                  <span class="dba-mono sub__muted"
                    >{{ current.plan.code }} · v{{ current.plan.version }}</span
                  >
                }
              </dd>
              <dt>{{ 'sub.f.source' | translate }}</dt>
              <dd class="dba-mono">{{ current.source }}</dd>
              <dt>{{ 'sub.f.period' | translate }}</dt>
              <dd class="dba-mono">
                {{ day(current.periodStart) }} →
                {{
                  current.periodEnd ? day(current.periodEnd) : ('sub.noExpiry.label' | translate)
                }}
                @if (current.lapsed) {
                  <dba-org-state state="warning" labelKey="sub.lapsed" variant="inline" />
                }
              </dd>
            </dl>

            <div class="sub__counters">
              @for (counter of current.counters; track counter.resource) {
                <div class="sub__counter">
                  <dba-quota-bar
                    [label]="'sub.resource.' + counter.resource"
                    [used]="counter.used"
                    [limit]="counter.limit"
                    [valueText]="counterText(counter)"
                  />
                  @if (canManage()) {
                    <button
                      type="button"
                      class="sub__link"
                      (click)="open.set({ kind: 'counter', counter })"
                    >
                      {{ 'sub.counter.open' | translate }}
                    </button>
                  }
                </div>
              }
            </div>
          } @else {
            <p class="dba-body sub__muted">{{ 'sub.none' | translate }}</p>
          }
        </section>

        <section class="sub__card">
          <h2 class="dba-panel">{{ 'sub.history' | translate }}</h2>
          @if (data.history.length === 0) {
            <p class="dba-body sub__muted">{{ 'sub.noHistory' | translate }}</p>
          } @else {
            <dba-data-table
              [columns]="historyColumns"
              [label]="'sub.history' | translate"
              minWidth="560px"
            >
              @for (row of data.history; track row.id) {
                <div class="dba-tr">
                  <span class="dba-td"
                    >{{ row.plan?.name || '—' }}
                    <span class="dba-mono sub__muted">{{ row.plan?.code }}</span></span
                  >
                  <span class="dba-td dba-mono">{{ row.source }}</span>
                  <span class="dba-td dba-mono"
                    >{{ day(row.periodStart) }} →
                    {{ row.periodEnd ? day(row.periodEnd) : '∞' }}</span
                  >
                  <span class="dba-td">
                    <dba-org-state
                      [state]="row.state === 'ACTIVE' ? 'active' : 'closed'"
                      [labelKey]="'sub.state.' + row.state"
                      variant="inline"
                    />
                  </span>
                </div>
              }
            </dba-data-table>
          }
        </section>

        @if (data.mirror) {
          <section class="sub__card">
            <h2 class="dba-panel">{{ 'sub.mirror.title' | translate }}</h2>
            <p class="dba-meta sub__lead">{{ 'sub.mirror.lead' | translate }}</p>
            <dl class="sub__dl">
              <dt>{{ 'sub.mirror.documents' | translate }}</dt>
              <dd class="dba-mono">
                {{ data.mirror.remainingDocuments ?? '—' }} / {{ data.mirror.documents ?? '∞' }}
              </dd>
              <dt>{{ 'sub.mirror.expiration' | translate }}</dt>
              <dd class="dba-mono">
                {{ data.mirror.expiration ? day(data.mirror.expiration) : '—' }}
              </dd>
            </dl>
          </section>
        }
      </div>

      @switch (open()?.kind) {
        @case ('assign') {
          <dba-assign-plan-form
            [plans]="data.plans"
            [orgName]="org().businessName"
            [carryable]="carryable()"
            [labels]="assignLabels"
            [busy]="working()"
            (submitted)="assign($event)"
            (dismissed)="open.set(null)"
          />
        }
        @case ('period') {
          <dba-period-form
            [current]="periodText()"
            [busy]="working()"
            (submitted)="setPeriod($event)"
            (dismissed)="open.set(null)"
          />
        }
        @case ('counter') {
          <dba-counter-form
            [counter]="openCounter()!"
            [unlimitedLabel]="'sub.unlimited' | translate"
            [busy]="working()"
            (submitted)="setCounter($event)"
            (dismissed)="open.set(null)"
          />
        }
      }
    }
  `,
  styles: `
    .sub {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
    }

    .sub__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sub__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .sub__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .sub__dl {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 10px 16px;
      margin: 0;
      font-size: var(--dba-text-cell);
    }

    .sub__dl dt {
      color: var(--dba-text-muted);
    }

    .sub__dl dd {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 0;
      color: var(--dba-ink);
    }

    .sub__muted {
      color: var(--dba-text-muted);
    }

    .sub__lead {
      margin: -8px 0 0;
    }

    .sub__counters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px 24px;
    }

    .sub__counter {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .sub__link {
      align-self: flex-start;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--dba-text-small);
      font-weight: 600;
      color: var(--dba-violet-600);
      cursor: pointer;
    }

    .sub__link:hover {
      text-decoration: underline;
    }

    .sub__link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .sub__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    @media (max-width: 520px) {
      .sub__dl {
        grid-template-columns: 1fr;
        gap: 2px;
      }

      .sub__dl dd {
        margin-bottom: 8px;
      }
    }
  `,
})
export class SubscriptionTabComponent {
  readonly org = input.required<PlatformOrgDetail>();
  readonly changed = output<void>();
  private readonly orgId = computed(() => this.org().id);

  private readonly api = inject(SubscriptionApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly historyColumns = HISTORY_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly working = signal(false);
  protected readonly view = signal<SubscriptionView | null>(null);
  protected readonly open = signal<Open>(null);
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));

  protected readonly openCounter = computed(() => {
    const open = this.open();
    return open?.kind === 'counter' ? open.counter : null;
  });

  protected readonly carryable = computed(() => {
    const documents = this.view()?.current?.counters.find((c) => c.resource === 'DOCUMENTS');
    return documents?.remaining ?? 0;
  });

  protected readonly periodText = computed(() => {
    const end = this.view()?.current?.periodEnd;
    return end
      ? (this.translate.instant('sub.period.currentEnd', { date: this.day(end) }) as string)
      : (this.translate.instant('sub.noExpiry.label') as string);
  });

  protected readonly assignLabels = {
    planValidity: (months: number | null) =>
      this.translate.instant(
        months && months > 1 ? 'sub.assign.planMonths' : 'sub.assign.planDefault',
        {
          months,
        },
      ) as string,
    until: this.translate.instant('sub.assign.untilDate') as string,
    none: this.translate.instant('sub.noExpiry.label') as string,
  };

  constructor() {
    effect(() => {
      if (this.orgId()) untracked(() => void this.reload());
    });
  }

  protected day(value: string): string {
    return formatDate(value, 'd/MM/y', this.locale);
  }

  protected counterText(counter: SubscriptionCounter): string {
    return `${counter.used} / ${counter.limit === null ? '∞' : counter.limit}`;
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(this.view() === null);
    this.error.set(false);
    try {
      const view = await firstValueFrom(this.api.get(this.org().id));
      if (current()) this.view.set(view);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async assign(body: AssignPlanBody): Promise<void> {
    const view = await this.run(this.api.assign(this.org().id, body));
    if (view) {
      const key = view.carriedOver ? 'sub.done.assignCarried' : 'sub.done.assign';
      this.notify.success(this.translate.instant(key, { count: view.carriedOver }) as string);
    }
  }

  protected async setPeriod(body: PeriodBody): Promise<void> {
    if (await this.run(this.api.setPeriod(this.org().id, body))) this.done('sub.done.period');
  }

  protected async setCounter(body: CounterBody): Promise<void> {
    const counter = this.openCounter();
    if (!counter) return;
    if (await this.run(this.api.setCounter(this.org().id, counter.resource, body)))
      this.done('sub.done.counter');
  }

  protected async noExpiry(): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'primary',
      icon: 'calendar',
      title: 'sub.noExpiry.title',
      message: 'sub.noExpiry.message',
      confirmLabel: 'sub.noExpiry.confirm',
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'sub.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    if (
      await this.run(this.api.setPeriod(this.org().id, { noExpiry: true, reason: answer.reason }))
    )
      this.done('sub.done.noExpiry');
  }

  protected async expire(): Promise<void> {
    const org = this.org();
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'sub.expire.title',
      message: 'sub.expire.message',
      params: { name: org.businessName },
      confirmLabel: 'sub.expire.confirm',
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'sub.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
      challenge: { identifier: org.tributaryNumber, actionKey: 'sub.expire.verb' },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    if (await this.run(this.api.expire(org.id, answer.reason))) this.done('sub.done.expire');
  }

  private done(key: string): void {
    this.notify.success(this.translate.instant(key) as string);
  }

  private async run(request: Observable<SubscriptionView>): Promise<SubscriptionView | null> {
    this.working.set(true);
    try {
      const view = await firstValueFrom(request);
      this.view.set(view);
      this.open.set(null);
      this.changed.emit();
      return view;
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && KNOWN_ERRORS.includes(code);
      this.notify.error(
        this.translate.instant(known ? `sub.error.${code}` : 'sub.error.generic') as string,
      );
      return null;
    } finally {
      this.working.set(false);
    }
  }
}
