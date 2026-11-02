import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
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
import { PromoFormComponent } from '../components/promo-form.component';
import { PromotionsApi } from '../data/promotions.api';
import {
  CODE_FAMILY,
  PROMO_ERRORS,
  activeParamOf,
  activeViews,
  codeStateOf,
  type CodeState,
} from '../data/promotions-view';
import type { CountryOption, CreatePromoBody, PromoCode } from '../data/promotions.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'code', labelKey: 'promo.col.code', width: 'minmax(0, 1.4fr)' },
  { key: 'discount', labelKey: 'promo.col.discount', width: '100px', align: 'end' },
  { key: 'usage', labelKey: 'promo.col.usage', width: '190px' },
  { key: 'country', labelKey: 'promo.col.country', width: 'minmax(0, 0.8fr)' },
  { key: 'expires', labelKey: 'promo.col.expires', width: '100px' },
  { key: 'state', labelKey: 'promo.col.state', width: '120px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

interface RowView extends PromoCode {
  state: CodeState;
  countryName: string;
  expiresText: string;
}

@Component({
  selector: 'dba-promotions',
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
    PromoFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.promotions' | translate }}</h1>
          <span class="dba-meta">{{ 'promo.count' | translate: { total: total() } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="formOpen.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'promo.new' | translate }}
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
            [placeholder]="'promo.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <db-filter-pills
          [pills]="views"
          [active]="view()"
          [label]="'promo.viewsLabel' | translate"
          (activeChange)="pickView($event)"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'promo.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="promo.errorTitle" leadKey="promo.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="promo.emptyTitle" leadKey="promo.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.promotions' | translate"
          [dense]="density.compact()"
          minWidth="860px"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.id) {
            <a class="dba-tr bl-row" [routerLink]="[path, row.id]">
              <span class="dba-td cell">
                <span class="cell__label dba-mono">{{ row.code }}</span>
                <span class="cell__meta">{{ row.name }}</span>
              </span>
              <span class="dba-td dba-td--end cell__amount">{{ row.discount }} %</span>
              <span class="dba-td">
                <dba-usage-meter [used]="row.redeemed" [limit]="row.quantity" />
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{ row.countryName }}</span>
              </span>
              <span class="dba-td dba-td--mono">{{ row.expiresText }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="family[row.state]"
                  [labelKey]="'promo.state.' + row.state"
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
      <dba-promo-form
        [countries]="countries()"
        [busy]="pending.key() === 'create'"
        (created)="create($event)"
        (dismissed)="formOpen.set(false)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class PromotionsComponent {
  private readonly api = inject(PromotionsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly family = CODE_FAMILY;
  protected readonly views = activeViews('promo');
  protected readonly path = sectionPath('promotions');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly searchDraft = signal('');
  protected readonly view = signal('all');
  protected readonly countries = signal<CountryOption[]>([]);
  private readonly items = signal<PromoCode[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly rows = computed<RowView[]>(() => {
    const now = new Date();
    const names = new Map(this.countries().map((c) => [c.id, c.name]));
    return this.items().map((row) => ({
      ...row,
      state: codeStateOf(row, now),
      countryName: row.countryId
        ? (names.get(row.countryId) ?? '—')
        : (this.translate.instant('promo.anyCountry') as string),
      expiresText: row.expiresAt ? formatDate(row.expiresAt, 'd/MM/y', this.locale) : '—',
    }));
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    void this.loadCountries();
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

  protected async create(body: CreatePromoBody): Promise<void> {
    await this.pending.run('create', async () => {
      try {
        const code = await firstValueFrom(this.api.createCode(body));
        this.formOpen.set(false);
        this.notify.success(this.label('promo.form.createDone', { code: code.code }));
        void this.router.navigate([this.path, code.id]);
      } catch (error) {
        const known = PROMO_ERRORS.includes(errorCodeOf(error) ?? '');
        this.notify.error(
          this.label(known ? `promo.error.${errorCodeOf(error)}` : 'promo.error.generic'),
        );
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(
        this.api.codes({
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

  private async loadCountries(): Promise<void> {
    try {
      this.countries.set(await firstValueFrom(this.api.countries()));
    } catch {
      this.countries.set([]);
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
