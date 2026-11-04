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
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
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
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  LegalEntityFormComponent,
  type LegalEntityFormResult,
} from '../components/legal-entity-form.component';
import { PendingLegalEntitiesTableComponent } from '../components/pending-legal-entities-table.component';
import { LEGAL_ENTITY_ERRORS, LegalEntitiesApi } from '../data/legal-entities.api';
import type {
  CountryOption,
  LegalEntityCounts,
  LegalEntityRow,
  LegalEntityView,
  PendingLegalEntity,
} from '../data/legal-entities.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;
const ALL = 'all';
const PENDING = 'pending';
const ANY_COUNTRY = '';
const EMPTY_COUNTS: LegalEntityCounts = { all: 0, active: 0, inactive: 0, pending: 0 };

const COLUMNS: readonly DataColumn[] = [
  { key: 'company', labelKey: 'jur.col.company', width: 'minmax(0, 1.4fr)' },
  { key: 'document', labelKey: 'jur.col.document', width: 'minmax(0, 0.7fr)' },
  { key: 'country', labelKey: 'jur.col.country', width: 'minmax(0, 0.6fr)' },
  { key: 'representative', labelKey: 'jur.col.legalRep', width: 'minmax(0, 1fr)' },
  { key: 'count', labelKey: 'jur.col.representatives', width: '130px' },
  { key: 'state', labelKey: 'jur.col.state', width: '100px' },
  { key: 'created', labelKey: 'jur.col.created', width: '100px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

@Component({
  selector: 'dba-legal-entities',
  imports: [
    FormsModule,
    TranslatePipe,
    RouterLink,
    Select,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    IconComponent,
    LegalEntityFormComponent,
    OrgStateComponent,
    PendingLegalEntitiesTableComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.legalEntities' | translate }}</h1>
          <span class="dba-meta">{{ 'jur.count' | translate: { total: total() } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="openCreate(null)">
            <db-icon name="plus" [size]="15" />
            {{ 'jur.action.create' | translate }}
          </button>
        }
      </header>

      <p class="dba-meta">
        {{ (isPending() ? 'jur.pending.notice' : 'jur.notice') | translate }}
      </p>

      <db-filter-pills
        [pills]="pills()"
        [active]="view()"
        [label]="'jur.viewsLabel' | translate"
        (activeChange)="pickView($event)"
      />

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'jur.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <p-select
          [options]="countryOptions()"
          optionLabel="label"
          optionValue="id"
          [filter]="true"
          [ngModel]="countryId()"
          (ngModelChange)="pickCountry($event)"
          [ariaLabel]="'jur.countryLabel' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'jur.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="jur.errorTitle" leadKey="jur.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (isPending() && pendingItems().length > 0) {
        <dba-pending-legal-entities-table
          [items]="pendingItems()"
          [canManage]="canManage()"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (register)="openCreate($event)"
          (pageChange)="goPage($event)"
        />
      } @else if (isPending()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="jur.pending.emptyTitle" leadKey="jur.pending.emptyLead" />
        </div>
      } @else if (items().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="jur.emptyTitle" leadKey="jur.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.legalEntities' | translate"
          [dense]="density.compact()"
          minWidth="920px"
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
                <span class="cell__label">{{ row.businessName }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted dba-mono">{{ row.identification }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{ row.countryName || '—' }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{ row.legalRepName || '—' }}</span>
              </span>
              <span class="dba-td cell__amount">{{ row.representativesCount }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="row.active ? 'active' : 'closed'"
                  [labelKey]="row.active ? 'jur.state.active' : 'jur.state.inactive'"
                  variant="inline"
                />
              </span>
              <span class="dba-td dba-td--mono">{{ day(row.createdAt) }}</span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }
    </section>

    @if (creating()) {
      <dba-legal-entity-form
        [draft]="draft()"
        [busy]="pending.key() === 'create'"
        (submitted)="create($event)"
        (dismissed)="creating.set(false)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class LegalEntitiesComponent {
  private readonly api = inject(LegalEntitiesApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly path = sectionPath('legalEntities');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly view = signal<string>(ALL);
  protected readonly countryId = signal(ANY_COUNTRY);
  protected readonly searchDraft = signal('');
  protected readonly items = signal<LegalEntityRow[]>([]);
  protected readonly pendingItems = signal<PendingLegalEntity[]>([]);
  protected readonly creating = signal(false);
  protected readonly draft = signal<PendingLegalEntity | null>(null);
  protected readonly isPending = computed(() => this.view() === PENDING);
  private readonly counts = signal(EMPTY_COUNTS);
  private readonly countries = signal<CountryOption[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstLoad = true;

  protected readonly pills = computed<FilterPill[]>(() => {
    const counts = this.counts();
    return [
      { key: ALL, labelKey: 'jur.view.all', count: counts.all },
      { key: 'active', labelKey: 'jur.view.active', count: counts.active },
      { key: 'inactive', labelKey: 'jur.view.inactive', count: counts.inactive },
      { key: PENDING, labelKey: 'jur.view.pending', count: counts.pending },
    ];
  });
  protected readonly countryOptions = computed<CountryOption[]>(() => [
    { id: ANY_COUNTRY, label: this.translate.instant('jur.anyCountry') as string },
    ...this.countries(),
  ]);
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
    void this.loadCountries();
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

  protected pickCountry(countryId: string | null): void {
    this.countryId.set(countryId ?? ANY_COUNTRY);
    this.restart();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected openCreate(draft: PendingLegalEntity | null): void {
    this.draft.set(draft);
    this.creating.set(true);
  }

  protected async create(result: LegalEntityFormResult): Promise<void> {
    if (result.kind !== 'create') return;
    await this.pending.run('create', async () => {
      try {
        const entity = await firstValueFrom(this.api.create(result.data, result.reason));
        this.creating.set(false);
        this.notify.success(this.translate.instant('jur.action.created') as string);
        await this.router.navigate([this.path, entity.id]);
      } catch (error) {
        const code = errorCodeOf(error);
        const known = code !== null && LEGAL_ENTITY_ERRORS.includes(code);
        this.notify.error(
          this.translate.instant(known ? `jur.error.${code}` : 'jur.error.generic') as string,
        );
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const scope = {
        search: this.search || undefined,
        countryId: this.countryId() || undefined,
        page: this.page(),
        limit: LIMIT,
      };
      if (this.isPending()) {
        const page = await firstValueFrom(this.api.pending(scope));
        if (!current()) return;
        this.pendingItems.set(page.items);
        this.total.set(page.total);
        this.counts.set(page.counts);
      } else {
        const page = await firstValueFrom(
          this.api.list({
            ...scope,
            view: this.view() === ALL ? undefined : (this.view() as LegalEntityView),
          }),
        );
        if (!current()) return;
        this.items.set(page.items);
        this.total.set(page.total);
        this.counts.set(page.counts);
        if (this.firstLoad && page.counts.all === 0 && page.counts.pending > 0) {
          this.firstLoad = false;
          this.pickView(PENDING);
          return;
        }
      }
      this.firstLoad = false;
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

  private async loadCountries(): Promise<void> {
    try {
      this.countries.set(await firstValueFrom(this.api.countries()));
    } catch {
      this.countries.set([]);
    }
  }
}
