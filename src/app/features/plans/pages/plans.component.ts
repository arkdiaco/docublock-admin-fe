import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { PlanFormComponent } from '../components/plan-form.component';
import { StripeSyncResultsComponent } from '../components/stripe-sync-results.component';
import { limitText } from '../data/plan-format';
import { priceLabel } from '../data/plan-labels';
import { reasonField } from '../data/plan-reason';
import { PlansApi } from '../data/plans.api';
import type {
  CreatePlanBody,
  PlanListState,
  PlanRow,
  PlanStripeSync,
} from '../data/plans.models';
import { StripeSyncRunner } from '../data/stripe-sync-runner';
import {
  issueKeyOf,
  pendingOf,
  stripeCellOf,
  syncCounts,
  type StripeCell,
  type StripeSyncResult,
} from '../data/stripe-sync-view';

const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'plan', labelKey: 'plans.col.plan', width: 'minmax(0, 1.6fr)' },
  { key: 'family', labelKey: 'plans.col.family', width: '130px' },
  { key: 'country', labelKey: 'plans.col.country', width: '120px' },
  { key: 'price', labelKey: 'plans.col.price', width: '170px' },
  { key: 'documents', labelKey: 'plans.col.documents', width: '100px', align: 'end' },
  { key: 'subscribers', labelKey: 'plans.col.subscribers', width: '110px', align: 'end' },
  { key: 'state', labelKey: 'plans.col.state', width: '150px' },
  { key: 'stripe', labelKey: 'plans.col.stripe', width: '210px' },
  { key: 'chevron', width: '40px', align: 'end' },
];

export const CREATE_ERRORS = [
  'PLAN_CODIGO_EN_USO',
  'PLAN_DATOS_INVALIDOS',
  'FAMILIA_NO_ADMITIDA',
  'PAIS_NO_EXISTE',
];

interface RowView extends PlanRow {
  priceText: string;
  documentsText: string;
  stripe: StripeCell;
  stripeNotes: string[];
}

@Component({
  selector: 'dba-plans',
  imports: [
    TranslatePipe,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    FilterPillsComponent,
    OrgStateComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    PlanFormComponent,
    StripeSyncResultsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="plans">
      <header class="plans__head">
        <div class="plans__title">
          <h1 class="dba-page">{{ 'nav.plans' | translate }}</h1>
          <span class="dba-meta">{{ 'plans.count' | translate: { total: rows().length } }}</span>
          @if (counts(); as c) {
            <span class="dba-meta">{{ 'plans.sync.summary' | translate: c }}</span>
          }
        </div>
        <div class="plans__actions">
          <button
            dba-button
            variant="secondary"
            [busy]="checking()"
            [disabled]="syncing()"
            (click)="check()"
          >
            <db-icon name="rotate" [size]="15" />
            {{ 'plans.sync.check' | translate }}
          </button>
          @if (canManage()) {
            <button
              dba-button
              variant="secondary"
              [busy]="syncing()"
              [disabled]="checking()"
              (click)="publishPending()"
            >
              <db-icon name="chain" [size]="15" />
              {{ 'plans.sync.publishPending' | translate }}
            </button>
            <button dba-button (click)="creating.set(true)">
              <db-icon name="plus" [size]="15" />
              {{ 'plans.create' | translate }}
            </button>
          }
        </div>
      </header>

      @if (results(); as list) {
        <dba-stripe-sync-results [results]="list" (dismissed)="results.set(null)" />
      }

      @if (creating()) {
        <dba-plan-form
          [busy]="saving()"
          (created)="create($event)"
          (dismissed)="creating.set(false)"
        />
      }

      <div class="plans__tools">
        <label class="plans__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="plans__input"
            autocomplete="off"
            [placeholder]="'plans.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <db-filter-pills [pills]="pills" [active]="state()" (activeChange)="pickState($event)" />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'plans.loading' | translate" />
      } @else if (error()) {
        <div class="plans__panel">
          <dba-empty-state titleKey="plans.errorTitle" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="plans__panel">
          <dba-empty-state titleKey="plans.emptyTitle" leadKey="plans.emptyLead" />
        </div>
      } @else {
        <dba-data-table [columns]="columns" [label]="'nav.plans' | translate" minWidth="1370px">
          @for (row of rows(); track row.code) {
            <button type="button" class="dba-tr" (click)="open(row)">
              <span class="dba-td plan-cell">
                <span class="plan-cell__name">{{ row.name }}</span>
                <span class="plan-cell__code">{{ row.code }} · v{{ row.version }}</span>
              </span>
              <span class="dba-td plan-cell__muted">
                {{ row.family }}
                <span class="dba-meta">{{ 'plans.kind.' + row.kind | translate }}</span>
              </span>
              <span class="dba-td">{{
                row.countryName || ('plans.allCountries' | translate)
              }}</span>
              <span class="dba-td">{{ row.priceText }}</span>
              <code class="dba-td dba-td--end">{{ row.documentsText }}</code>
              <code class="dba-td dba-td--end">{{ row.subscribers }}</code>
              <span class="dba-td plan-state">
                <dba-org-state
                  [state]="row.state === 'ACTIVE' ? 'active' : 'closed'"
                  [labelKey]="'plans.state.' + row.state"
                  variant="inline"
                />
                @if (!row.visible) {
                  <span class="dba-meta">{{ 'plans.hidden' | translate }}</span>
                }
              </span>
              <span class="dba-td plan-state">
                <dba-org-state
                  [state]="row.stripe.state"
                  [labelKey]="row.stripe.labelKey"
                  variant="inline"
                />
                @for (note of row.stripeNotes; track note) {
                  <span class="dba-meta plan-state__warn">{{ note }}</span>
                }
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>
  `,
  styles: `
    .plans {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .plans__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .plans__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .plans__actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .plans__tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }

    .plans__search {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 320px;
      max-width: 100%;
      height: var(--dba-height-search);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      color: var(--dba-text-muted);
    }

    .plans__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .plans__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .plans__input:focus {
      outline: none;
    }

    .plans__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .plan-cell {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .plan-cell__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
    }

    .plan-cell__code {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .plan-cell__muted {
      display: flex;
      flex-direction: column;
    }

    .plan-state {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .plan-state__warn {
      color: var(--dba-state-suspended-fg);
    }
  `,
})
export class PlansComponent {
  private readonly api = inject(PlansApi);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly runner = inject(StripeSyncRunner);
  private readonly latest = new LatestRequest();

  protected readonly columns = COLUMNS;
  protected readonly pills: FilterPill[] = [
    { key: 'active', labelKey: 'plans.filter.active' },
    { key: 'retired', labelKey: 'plans.filter.retired' },
    { key: 'all', labelKey: 'plans.filter.all' },
  ];
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly state = signal<PlanListState>('active');
  protected readonly searchDraft = signal('');
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly checking = signal(false);
  protected readonly syncing = signal(false);
  protected readonly results = signal<StripeSyncResult[] | null>(null);
  private readonly items = signal<PlanRow[]>([]);
  private readonly sync = signal<PlanStripeSync[] | null>(null);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly syncByCode = computed(
    () => new Map((this.sync() ?? []).map((row) => [row.code, row])),
  );

  protected readonly counts = computed(() => {
    const rows = this.sync();
    return rows ? syncCounts(rows) : null;
  });

  protected readonly rows = computed<RowView[]>(() =>
    this.items().map((row) => {
      const stripe = stripeCellOf(row, this.syncByCode().get(row.code));
      return {
        ...row,
        priceText: priceLabel(row, this.translate, this.locale),
        documentsText: limitText(row.limits.documents),
        stripe,
        stripeNotes: stripe.issues.map(
          (issue) =>
            this.translate.instant(issueKeyOf(issue), {
              slot: this.translate.instant(`plans.sync.slot.${issue.slot}`) as string,
            }) as string,
        ),
      };
    }),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    void this.reload();
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      void this.reload();
    }, DEBOUNCE_MS);
  }

  protected pickState(key: string): void {
    this.state.set(key as PlanListState);
    void this.reload();
  }

  protected open(row: PlanRow): void {
    void this.router.navigate([sectionPath('plans'), row.code]);
  }

  protected async create(body: CreatePlanBody): Promise<void> {
    this.saving.set(true);
    try {
      const created = await firstValueFrom(this.api.create(body));
      this.creating.set(false);
      this.notify.success(
        this.translate.instant('plans.done.created', { code: created.code }) as string,
      );
      void this.router.navigate([sectionPath('plans'), created.code]);
    } catch (failure) {
      const code = errorCodeOf(failure);
      this.notify.error(
        this.translate.instant(
          code && CREATE_ERRORS.includes(code) ? `plans.error.${code}` : 'plans.error.generic',
        ) as string,
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async check(): Promise<void> {
    this.checking.set(true);
    try {
      await this.fetchSync();
    } catch {
      this.notifyStripeDown();
    } finally {
      this.checking.set(false);
    }
  }

  protected async publishPending(): Promise<void> {
    this.syncing.set(true);
    let pending: PlanStripeSync[];
    try {
      pending = pendingOf(await this.fetchSync());
    } catch {
      this.notifyStripeDown();
      this.syncing.set(false);
      return;
    }
    this.syncing.set(false);
    if (pending.length === 0) {
      this.notify.info(this.translate.instant('plans.sync.nonePending') as string);
      return;
    }
    const answer = await this.dialogs.open({
      intent: 'primary',
      icon: 'chain',
      title: 'plans.sync.confirmTitle',
      message: 'plans.sync.confirmMessage',
      params: { total: pending.length, plans: pending.map((plan) => plan.code).join(', ') },
      confirmLabel: 'plans.sync.confirm',
      reason: reasonField,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    this.syncing.set(true);
    try {
      this.results.set(await this.runner.publishAll(pending, answer.reason));
      await this.reload();
      await this.fetchSync().catch(() => this.sync.set(null));
    } finally {
      this.syncing.set(false);
    }
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const rows = await firstValueFrom(
        this.api.list({ state: this.state(), search: this.search || undefined }),
      );
      if (current()) this.items.set(rows);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private async fetchSync(): Promise<PlanStripeSync[]> {
    const rows = await firstValueFrom(this.api.stripeSync());
    this.sync.set(rows);
    return rows;
  }

  private notifyStripeDown(): void {
    this.notify.error(this.translate.instant('plans.error.STRIPE_NO_DISPONIBLE') as string);
  }
}
