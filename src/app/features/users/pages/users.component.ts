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
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsersApi } from '../data/users.api';
import type { CountryOption, PlatformUser, UserCounts, UserView } from '../data/users.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;
const ALL = 'all';
const ANY_COUNTRY = '';
const EMPTY_COUNTS: UserCounts = { all: 0, active: 0, inactive: 0, without: 0 };

const COLUMNS: readonly DataColumn[] = [
  { key: 'person', labelKey: 'usr.col.person', width: 'minmax(0, 1.6fr)' },
  { key: 'document', labelKey: 'usr.col.document', width: 'minmax(0, 0.8fr)' },
  { key: 'country', labelKey: 'usr.col.country', width: 'minmax(0, 0.7fr)' },
  { key: 'organizations', labelKey: 'usr.col.organizations', width: '120px', align: 'end' },
  { key: 'state', labelKey: 'usr.col.state', width: '110px' },
  { key: 'created', labelKey: 'usr.col.created', width: '100px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

@Component({
  selector: 'dba-users',
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
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.users' | translate }}</h1>
          <span class="dba-meta">{{ 'usr.count' | translate: { total: total() } }}</span>
        </div>
      </header>

      <db-filter-pills
        [pills]="pills()"
        [active]="view()"
        [label]="'usr.viewsLabel' | translate"
        (activeChange)="pickView($event)"
      />

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'usr.searchPlaceholder' | translate"
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
          [ariaLabel]="'usr.countryLabel' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'usr.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="usr.errorTitle" leadKey="usr.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="usr.emptyTitle" leadKey="usr.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.users' | translate"
          [dense]="density.compact()"
          minWidth="860px"
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
                <span class="cell__label">{{ row.names }} {{ row.surNames }}</span>
                <span class="cell__meta">{{ row.email || '—' }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted dba-mono">{{ row.identification }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{ row.countryName || '—' }}</span>
              </span>
              <span class="dba-td dba-td--end cell__amount">{{ row.organizationsCount }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="row.active ? 'active' : 'suspended'"
                  [labelKey]="row.active ? 'usr.state.active' : 'usr.state.inactive'"
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
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class UsersComponent {
  private readonly api = inject(UsersApi);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly path = sectionPath('users');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly view = signal<string>(ALL);
  protected readonly countryId = signal(ANY_COUNTRY);
  protected readonly searchDraft = signal('');
  protected readonly items = signal<PlatformUser[]>([]);
  private readonly counts = signal(EMPTY_COUNTS);
  private readonly countries = signal<CountryOption[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly pills = computed<FilterPill[]>(() => {
    const counts = this.counts();
    return [
      { key: ALL, labelKey: 'usr.view.all', count: counts.all },
      { key: 'active', labelKey: 'usr.view.active', count: counts.active },
      { key: 'inactive', labelKey: 'usr.view.inactive', count: counts.inactive },
      { key: 'without', labelKey: 'usr.view.without', count: counts.without },
    ];
  });
  protected readonly countryOptions = computed<CountryOption[]>(() => [
    { id: ANY_COUNTRY, label: this.translate.instant('usr.anyCountry') as string },
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

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(
        this.api.list({
          search: this.search || undefined,
          view: this.view() === ALL ? undefined : (this.view() as UserView),
          countryId: this.countryId() || undefined,
          page: this.page(),
          limit: LIMIT,
        }),
      );
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
      this.counts.set(page.counts);
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
