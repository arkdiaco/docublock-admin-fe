import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CountryFormComponent, type CountryFormResult } from '../components/country-form.component';
import { CatalogsApi, catalogErrorKey } from '../data/catalogs.api';
import type { CountryRow } from '../data/catalogs.models';

const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'name', labelKey: 'cat.col.name', width: 'minmax(0, 1.2fr)' },
  { key: 'abbreviation', labelKey: 'cat.countries.abbreviation', width: '90px' },
  { key: 'calling', labelKey: 'cat.countries.callingCode', width: '90px' },
  { key: 'currency', labelKey: 'cat.countries.currency', width: '80px' },
  { key: 'timezone', labelKey: 'cat.countries.timezone', width: 'minmax(0, 1fr)' },
  { key: 'cities', labelKey: 'nav.cities', width: '90px' },
  { key: 'kinds', labelKey: 'cat.countries.kinds', width: '100px' },
  { key: 'types', labelKey: 'cat.countries.types', width: '110px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

@Component({
  selector: 'dba-countries',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    CountryFormComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.countries' | translate }}</h1>
          <span class="dba-meta">{{ 'cat.count' | translate: { total: items().length } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="creating.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'cat.countries.create' | translate }}
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
            [placeholder]="'cat.countries.search' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
      </div>

      @if (loading()) {
        <db-section-loader [label]="'cat.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="cat.errorTitle" leadKey="cat.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="cat.countries.emptyTitle" leadKey="cat.countries.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.countries' | translate"
          [dense]="density.compact()"
          minWidth="880px"
        >
          @for (row of items(); track row.id) {
            <a class="dba-tr bl-row" [routerLink]="[path, row.id]">
              <span class="dba-td cell">
                <span class="cell__label">{{ row.flag }} {{ row.name }}</span>
              </span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ row.abbreviation || '—' }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ row.callingCode || '—' }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ row.currency || '—' }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">{{ row.timezone || '—' }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">{{ row.citiesCount }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">{{ row.kindPersonsCount }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">{{ row.identificationTypesCount }}</span></span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }
    </section>

    @if (creating()) {
      <dba-country-form
        [busy]="pending.key() === 'create'"
        (submitted)="create($event)"
        (dismissed)="creating.set(false)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class CountriesComponent {
  private readonly api = inject(CatalogsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly path = sectionPath('countries');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly searchDraft = signal('');
  protected readonly items = signal<CountryRow[]>([]);
  protected readonly creating = signal(false);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

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

  protected async create(result: CountryFormResult): Promise<void> {
    if (result.kind !== 'create') return;
    await this.pending.run('create', async () => {
      try {
        const country = await firstValueFrom(this.api.createCountry(result.draft, result.reason));
        this.creating.set(false);
        this.notify.success(this.translate.instant('cat.countries.created') as string);
        await this.router.navigate([this.path, country.id]);
      } catch (error) {
        this.notify.error(this.translate.instant(catalogErrorKey(error)) as string);
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(this.api.countries(this.search || undefined));
      if (!current()) return;
      this.items.set(page.items);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}
