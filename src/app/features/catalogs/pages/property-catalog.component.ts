import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DensityService } from '../../../core/preferences/density.service';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CatalogRowMenuComponent } from '../components/catalog-row-menu.component';
import { PropertyItemFormComponent } from '../components/property-item-form.component';
import { askRemovalReason } from '../data/catalog-removal';
import { CatalogsApi, catalogErrorKey } from '../data/catalogs.api';
import {
  PROPERTY_CATEGORIES,
  type PropertyCatalog,
  type PropertyCategory,
  type PropertyItem,
} from '../data/catalogs.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'label', labelKey: 'cat.property.label', width: 'minmax(0, 1.4fr)' },
  { key: 'key', labelKey: 'cat.property.key', width: 'minmax(0, 1fr)' },
  { key: 'actions', width: '48px', align: 'end' },
];

@Component({
  selector: 'dba-property-catalog',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CatalogRowMenuComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    IconComponent,
    PropertyItemFormComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.propertyCatalog' | translate }}</h1>
          <span class="dba-meta">{{ 'cat.count' | translate: { total: items().length } }}</span>
        </div>
        @if (canManage() && catalog()) {
          <button dba-button (click)="creating.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'cat.property.create' | translate }}
          </button>
        }
      </header>

      <p class="dba-meta">{{ 'cat.property.notice' | translate }}</p>

      @if (loading()) {
        <db-section-loader [label]="'cat.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="cat.errorTitle" leadKey="cat.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else {
        <db-filter-pills
          [pills]="pills()"
          [active]="category()"
          [label]="'cat.property.categories' | translate"
          (activeChange)="category.set($any($event))"
        />
        @if (items().length === 0) {
          <div class="bl__panel">
            <dba-empty-state titleKey="cat.property.emptyTitle" leadKey="cat.property.emptyLead" />
          </div>
        } @else {
          <dba-data-table
            [columns]="columns"
            [label]="'nav.propertyCatalog' | translate"
            [dense]="density.compact()"
            minWidth="480px"
          >
            @for (row of items(); track row.key) {
              <div class="dba-tr">
                <span class="dba-td cell"><span class="cell__label">{{ row.label }}</span></span>
                <span class="dba-td cell"><span class="cell__muted dba-mono">{{ row.key }}</span></span>
                <span class="dba-td dba-td--end">
                  @if (canManage()) {
                    <dba-catalog-row-menu
                      [name]="row.label"
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
      }
    </section>

    @if (creating()) {
      <dba-property-item-form
        [categoryLabel]="categoryLabel()"
        [busy]="pending.key() === 'save'"
        (submitted)="add($event)"
        (dismissed)="creating.set(false)"
      />
    }
    @if (editing(); as item) {
      <dba-property-item-form
        [item]="item"
        [categoryLabel]="categoryLabel()"
        [busy]="pending.key() === 'save'"
        (submitted)="rename(item, $event)"
        (dismissed)="editing.set(null)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class PropertyCatalogComponent {
  private readonly api = inject(CatalogsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly catalog = signal<PropertyCatalog | null>(null);
  protected readonly category = signal<PropertyCategory>('propertyType');
  protected readonly creating = signal(false);
  protected readonly editing = signal<PropertyItem | null>(null);
  protected readonly items = computed(() => this.catalog()?.[this.category()] ?? []);
  protected readonly categoryLabel = computed(() =>
    this.translate.instant(`cat.property.category.${this.category()}`) as string,
  );
  protected readonly pills = computed<FilterPill[]>(() =>
    PROPERTY_CATEGORIES.map((key) => ({
      key,
      labelKey: `cat.property.category.${key}`,
      count: this.catalog()?.[key]?.length ?? 0,
    })),
  );

  constructor() {
    void this.reload();
  }

  protected async add(value: { key: string; label: string; reason: string }): Promise<void> {
    await this.save(
      () =>
        this.api.addPropertyItem(
          this.category(),
          { key: value.key, label: value.label },
          value.reason,
        ),
      'cat.property.created',
    );
  }

  protected async rename(
    item: PropertyItem,
    value: { label: string; reason: string },
  ): Promise<void> {
    await this.save(
      () => this.api.updatePropertyItem(this.category(), item.key, value.label, value.reason),
      'cat.property.updated',
    );
  }

  protected async remove(item: PropertyItem): Promise<void> {
    const reason = await askRemovalReason(this.dialogs, item.label, 'cat.property.removeMessage');
    if (!reason) return;
    await this.save(
      () => this.api.removePropertyItem(this.category(), item.key, reason),
      'cat.property.removed',
    );
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.catalog.set(await firstValueFrom(this.api.propertyCatalog()));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async save(request: () => Observable<PropertyCatalog>, doneKey: string): Promise<void> {
    await this.pending.run('save', async () => {
      try {
        this.catalog.set(await firstValueFrom(request()));
        this.creating.set(false);
        this.editing.set(null);
        this.notify.success(this.translate.instant(doneKey) as string);
      } catch (error) {
        this.notify.error(this.translate.instant(catalogErrorKey(error)) as string);
      }
    });
  }
}
