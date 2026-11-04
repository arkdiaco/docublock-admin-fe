import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
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
import { KindPersonFormComponent, type KindPersonFormResult } from '../components/kind-person-form.component';
import { askRemovalReason } from '../data/catalog-removal';
import { CatalogsApi, catalogErrorKey, catalogUsageOf } from '../data/catalogs.api';
import type { KindPersonRow } from '../data/catalogs.models';

const LIMIT = 20;

const COLUMNS: readonly DataColumn[] = [
  { key: 'name', labelKey: 'cat.col.name', width: 'minmax(0, 1.3fr)' },
  { key: 'type', labelKey: 'cat.kind.type', width: 'minmax(0, 0.7fr)' },
  { key: 'country', labelKey: 'cat.col.country', width: 'minmax(0, 0.9fr)' },
  { key: 'count', labelKey: 'cat.kind.typesCount', width: '150px' },
  { key: 'actions', width: '48px', align: 'end' },
];

@Component({
  selector: 'dba-kind-persons',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CatalogCountrySelectComponent,
    CatalogRowMenuComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    KindPersonFormComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.kindPersons' | translate }}</h1>
          <span class="dba-meta">{{ 'cat.count' | translate: { total: total() } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="creating.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'cat.kind.create' | translate }}
          </button>
        }
      </header>

      <p class="dba-meta">{{ 'cat.kind.notice' | translate }}</p>

      <div class="bl__tools">
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
          <dba-empty-state titleKey="cat.kind.emptyTitle" leadKey="cat.kind.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.kindPersons' | translate"
          [dense]="density.compact()"
          minWidth="640px"
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
              <span class="dba-td cell">
                <span class="cell__muted">{{ 'cat.kind.' + row.type | translate }}</span>
              </span>
              <span class="dba-td cell"><span class="cell__muted">{{ row.countryName || ('cat.col.noCountry' | translate) }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">{{ row.identificationTypesCount }}</span></span>
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
      <dba-kind-person-form
        [initialCountryId]="countryId()"
        [busy]="pending.key() === 'save'"
        (submitted)="create($event)"
        (dismissed)="creating.set(false)"
      />
    }
    @if (editing(); as kind) {
      <dba-kind-person-form
        [kind]="kind"
        [busy]="pending.key() === 'save'"
        (submitted)="update(kind, $event)"
        (dismissed)="editing.set(null)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class KindPersonsComponent {
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
  protected readonly items = signal<KindPersonRow[]>([]);
  protected readonly creating = signal(false);
  protected readonly editing = signal<KindPersonRow | null>(null);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    effect(() => {
      const country = this.pais() ?? '';
      untracked(() => {
        this.countryId.set(country);
        this.page.set(1);
        void this.reload();
      });
    });
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

  protected async create(result: KindPersonFormResult): Promise<void> {
    await this.save(
      () =>
        this.api.createKindPerson(
          {
            countryId: result.countryId,
            name: result.name,
            type: result.type,
            labels: result.labels,
          },
          result.reason,
        ),
      'cat.kind.created',
    );
  }

  protected async update(kind: KindPersonRow, result: KindPersonFormResult): Promise<void> {
    await this.save(
      () =>
        this.api.updateKindPerson(
          kind.id,
          { name: result.name, type: result.type, labels: result.labels },
          result.reason,
        ),
      'cat.kind.updated',
    );
  }

  protected async remove(kind: KindPersonRow): Promise<void> {
    const reason = await askRemovalReason(this.dialogs, kind.name, 'cat.kind.removeMessage');
    if (!reason) return;
    await this.pending.run(kind.id, async () => {
      try {
        await firstValueFrom(this.api.removeKindPerson(kind.id, reason));
        this.notify.success(this.label('cat.kind.removed'));
        await this.reload();
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error), { usage: catalogUsageOf(error) }));
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(
        this.api.kindPersons({
          countryId: this.countryId() || undefined,
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

  private async save(request: () => ReturnType<CatalogsApi['createKindPerson']>, doneKey: string): Promise<void> {
    await this.pending.run('save', async () => {
      try {
        await firstValueFrom(request());
        this.creating.set(false);
        this.editing.set(null);
        this.notify.success(this.label(doneKey));
        await this.reload();
      } catch (error) {
        this.notify.error(this.label(catalogErrorKey(error)));
      }
    });
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
