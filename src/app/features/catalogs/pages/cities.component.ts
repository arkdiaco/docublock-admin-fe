import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DensityService } from '../../../core/preferences/density.service';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CatalogCountrySelectComponent } from '../components/catalog-country-select.component';
import { CatalogRowMenuComponent } from '../components/catalog-row-menu.component';
import { CityFormComponent, type CityFormResult } from '../components/city-form.component';
import { askRemovalReason } from '../data/catalog-removal';
import { CatalogsApi, catalogErrorKey, catalogUsageOf } from '../data/catalogs.api';
import type { CityRow } from '../data/catalogs.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'name', labelKey: 'cat.col.name', width: 'minmax(0, 1.4fr)' },
  { key: 'code', labelKey: 'cat.city.code', width: 'minmax(0, 0.6fr)' },
  { key: 'country', labelKey: 'cat.col.country', width: 'minmax(0, 1fr)' },
  { key: 'actions', width: '48px', align: 'end' },
];

@Component({
  selector: 'dba-cities',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CatalogCountrySelectComponent,
    CatalogRowMenuComponent,
    CityFormComponent,
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
          <h1 class="dba-page">{{ 'nav.cities' | translate }}</h1>
          <span class="dba-meta">{{ 'cat.count' | translate: { total: total() } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="openCreate()">
            <db-icon name="plus" [size]="15" />
            {{ 'cat.city.create' | translate }}
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
            [placeholder]="'cat.city.search' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <dba-catalog-country-select [value]="countryId()" (picked)="pickCountry($event)" />
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
          <dba-empty-state titleKey="cat.city.emptyTitle" leadKey="cat.city.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.cities' | translate"
          [dense]="density.compact()"
          minWidth="560px"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of items(); track row.id) {
            <div class="dba-tr">
              <span class="dba-td cell"><span class="cell__label">{{ row.name }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ row.code || '—' }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">{{ row.countryName || ('cat.col.noCountry' | translate) }}</span></span>
              <span class="dba-td dba-td--end">
                @if (canManage()) {
                  <dba-catalog-row-menu
                    [name]="row.name"
                    [disabled]="!!pending.key()"
                    (edit)="editing.set(row)"
                    (remove)="remove(row)"
                  />
                }
              </span>
            </div>
          }
        </dba-data-table>
      }
    </section>

    @if (creating()) {
      <dba-city-form
        [initialCountryId]="countryId()"
        [busy]="pending.key() === 'save'"
        (submitted)="create($event)"
        (dismissed)="creating.set(false)"
      />
    }
    @if (editing(); as city) {
      <dba-city-form
        [city]="city"
        [busy]="pending.key() === 'save'"
        (submitted)="update(city, $event)"
        (dismissed)="editing.set(null)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class CitiesComponent {
  readonly pais = input<string | undefined>();

  private readonly api = inject(CatalogsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly countryId = signal('');
  protected readonly searchDraft = signal('');
  protected readonly items = signal<CityRow[]>([]);
  protected readonly creating = signal(false);
  protected readonly editing = signal<CityRow | null>(null);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    effect(() => {
      const country = this.pais() ?? '';
      untracked(() => {
        this.countryId.set(country);
        this.page.set(1);
        void this.reload();
      });
    });
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      this.page.set(1);
      void this.reload();
    }, DEBOUNCE_MS);
  }

  protected pickCountry(countryId: string): void {
    this.countryId.set(countryId);
    this.page.set(1);
    void this.reload();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected openCreate(): void {
    this.creating.set(true);
  }

  protected async create(result: CityFormResult): Promise<void> {
    await this.pending.run('save', async () => {
      try {
        await firstValueFrom(
          this.api.createCity(
            {
              countryId: result.countryId,
              name: result.name,
              ...(result.code ? { code: result.code } : {}),
            },
            result.reason,
          ),
        );
        this.creating.set(false);
        this.notify.success(this.label('cat.city.created'));
        await this.reload();
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error)));
      }
    });
  }

  protected async update(city: CityRow, result: CityFormResult): Promise<void> {
    await this.pending.run('save', async () => {
      try {
        await firstValueFrom(
          this.api.updateCity(
            city.id,
            {
              ...(result.name !== city.name ? { name: result.name } : {}),
              ...(result.code !== (city.code ?? '') ? { code: result.code || null } : {}),
            },
            result.reason,
          ),
        );
        this.editing.set(null);
        this.notify.success(this.label('cat.city.updated'));
        await this.reload();
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error)));
      }
    });
  }

  protected async remove(city: CityRow): Promise<void> {
    const reason = await askRemovalReason(this.dialogs, city.name, 'cat.city.removeMessage');
    if (!reason) return;
    await this.pending.run(city.id, async () => {
      try {
        await firstValueFrom(this.api.removeCity(city.id, reason));
        this.notify.success(this.label('cat.city.removed'));
        await this.reload();
      } catch (error) {
        this.notify.error(
          this.label(catalogErrorKey(error), { usage: catalogUsageOf(error) }),
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
        this.api.cities({
          countryId: this.countryId() || undefined,
          search: this.search || undefined,
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

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
