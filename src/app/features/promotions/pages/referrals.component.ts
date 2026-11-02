import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { ReferralFormComponent } from '../components/referral-form.component';
import { PromotionsApi } from '../data/promotions.api';
import { PROMO_ERRORS, activeParamOf, activeViews } from '../data/promotions-view';
import type { CreateReferralBody, Referral } from '../data/promotions.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'person', labelKey: 'ref.col.person', width: 'minmax(0, 1.5fr)' },
  { key: 'code', labelKey: 'ref.col.code', width: 'minmax(0, 1fr)' },
  { key: 'discount', labelKey: 'ref.col.discount', width: '100px', align: 'end' },
  { key: 'usage', labelKey: 'ref.col.usage', width: '190px' },
  { key: 'state', labelKey: 'ref.col.state', width: '110px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

@Component({
  selector: 'dba-referrals',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    UsageMeterComponent,
    ReferralFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.referrals' | translate }}</h1>
          <span class="dba-meta">{{ 'ref.count' | translate: { total: total() } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="formOpen.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'ref.new' | translate }}
          </button>
        }
      </header>

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'ref.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <db-filter-pills
          [pills]="views"
          [active]="view()"
          [label]="'ref.viewsLabel' | translate"
          (activeChange)="pickView($event)"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'ref.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="ref.errorTitle" leadKey="ref.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="ref.emptyTitle" leadKey="ref.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.referrals' | translate"
          [dense]="density.compact()"
          minWidth="780px"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of items(); track row.id) {
            <a class="dba-tr bl-row" [routerLink]="[path, row.id]">
              <span class="dba-td cell">
                <span class="cell__label">{{ row.name }}</span>
                <span class="cell__meta">{{ row.email }}</span>
              </span>
              <span class="dba-td dba-td--mono">{{ row.code.code }}</span>
              <span class="dba-td dba-td--end cell__amount">{{ row.code.discount }} %</span>
              <span class="dba-td">
                <dba-usage-meter [used]="row.code.redeemed" [limit]="row.code.quantity" />
              </span>
              <span class="dba-td">
                <dba-org-state
                  [state]="row.active ? 'active' : 'closed'"
                  [labelKey]="row.active ? 'ref.state.active' : 'ref.state.inactive'"
                  variant="inline"
                />
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }
    </section>

    @if (formOpen()) {
      <dba-referral-form
        [busy]="pending.key() === 'create'"
        (created)="create($event)"
        (dismissed)="formOpen.set(false)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class ReferralsComponent {
  private readonly api = inject(PromotionsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly views = activeViews('ref');
  protected readonly path = sectionPath('referrals');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly searchDraft = signal('');
  protected readonly view = signal('all');
  protected readonly items = signal<Referral[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

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
      this.restart();
    }, DEBOUNCE_MS);
  }

  protected pickView(view: string): void {
    this.view.set(view);
    this.restart();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected async create(body: CreateReferralBody): Promise<void> {
    await this.pending.run('create', async () => {
      try {
        const referral = await firstValueFrom(this.api.createReferral(body));
        this.formOpen.set(false);
        this.notify.success(this.label('ref.form.createDone', { name: referral.name }));
        void this.router.navigate([this.path, referral.id]);
      } catch (error) {
        const code = errorCodeOf(error);
        const known = code !== null && PROMO_ERRORS.includes(code);
        this.notify.error(this.label(known ? `promo.error.${code}` : 'promo.error.generic'));
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(
        this.api.referrals({
          search: this.search || undefined,
          active: activeParamOf(this.view()),
          page: this.page(),
          limit: LIMIT,
        }),
      );
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private restart(): void {
    this.page.set(1);
    void this.reload();
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
