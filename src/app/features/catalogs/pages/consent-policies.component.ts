import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import type { ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CatalogRowMenuComponent } from '../components/catalog-row-menu.component';
import { ConsentPublishFormComponent } from '../components/consent-publish-form.component';
import { ConsentVersionsComponent } from '../components/consent-versions.component';
import { CatalogsApi, catalogErrorKey } from '../data/catalogs.api';
import type { ConsentDraft, ConsentPolicy, PolicyLocale } from '../data/catalogs.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'title', labelKey: 'cat.consent.titleLabel', width: 'minmax(0, 1.2fr)' },
  { key: 'code', labelKey: 'cat.consent.code', width: 'minmax(0, 0.7fr)' },
  { key: 'version', labelKey: 'cat.consent.versionCol', width: '90px' },
  { key: 'published', labelKey: 'cat.consent.published', width: '110px' },
  { key: 'actions', width: '48px', align: 'end' },
];

const LOCALES: readonly FilterPill[] = [
  { key: 'es', labelKey: 'cat.consent.locale.es' },
  { key: 'en', labelKey: 'cat.consent.locale.en' },
];

@Component({
  selector: 'dba-consent-policies',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CatalogRowMenuComponent,
    ConsentPublishFormComponent,
    ConsentVersionsComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    IconComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.policies' | translate }}</h1>
          <span class="dba-meta">{{ 'cat.count' | translate: { total: items().length } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="creating.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'cat.consent.create' | translate }}
          </button>
        }
      </header>

      <p class="dba-meta">{{ 'cat.consent.notice' | translate }}</p>

      <db-filter-pills
        [pills]="locales"
        [active]="locale()"
        [label]="'cat.consent.localeLabel' | translate"
        (activeChange)="pickLocale($any($event))"
      />

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
          <dba-empty-state titleKey="cat.consent.emptyTitle" leadKey="cat.consent.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.policies' | translate"
          [dense]="density.compact()"
          minWidth="640px"
        >
          @for (row of items(); track row.id) {
            <div class="dba-tr">
              <span class="dba-td cell"><span class="cell__label">{{ row.title }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ row.code }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">v{{ row.version }}</span></span>
              <span class="dba-td dba-td--mono">{{ day(row.publishedAt) }}</span>
              <span class="dba-td dba-td--end">
                <dba-catalog-row-menu
                  [name]="row.title"
                  [items]="rowItems()"
                  (picked)="onRowAction(row, $event)"
                />
              </span>
            </div>
          }
        </dba-data-table>
      }
    </section>

    @if (creating()) {
      <dba-consent-publish-form
        [locale]="locale()"
        [busy]="pending.key() === 'publish'"
        (submitted)="publish($event)"
        (dismissed)="creating.set(false)"
      />
    }
    @if (revising(); as policy) {
      <dba-consent-publish-form
        [policy]="policy"
        [locale]="locale()"
        [busy]="pending.key() === 'publish'"
        (submitted)="publish($event)"
        (dismissed)="revising.set(null)"
      />
    }
    @if (viewing(); as policy) {
      <dba-consent-versions [policy]="policy" [locale]="locale()" (dismissed)="viewing.set(null)" />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class ConsentPoliciesComponent {
  private readonly api = inject(CatalogsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly appLocale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly locales = LOCALES;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly rowItems = computed<ActionMenuItem[]>(() => [
    { key: 'versions', labelKey: 'cat.consent.versions' },
    ...(this.canManage() ? [{ key: 'revise', labelKey: 'cat.consent.newVersion' }] : []),
  ]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly locale = signal<PolicyLocale>('es');
  protected readonly items = signal<ConsentPolicy[]>([]);
  protected readonly creating = signal(false);
  protected readonly revising = signal<ConsentPolicy | null>(null);
  protected readonly viewing = signal<ConsentPolicy | null>(null);

  constructor() {
    void this.reload();
  }

  protected pickLocale(locale: PolicyLocale): void {
    this.locale.set(locale);
    void this.reload();
  }

  protected onRowAction(policy: ConsentPolicy, key: string): void {
    if (key === 'versions') this.viewing.set(policy);
    if (key === 'revise') this.revising.set(policy);
  }

  protected day(value: string): string {
    return formatDate(value, 'd/MM/y', this.appLocale);
  }

  protected async publish(value: { draft: ConsentDraft; reason: string }): Promise<void> {
    await this.pending.run('publish', async () => {
      try {
        await firstValueFrom(this.api.publishConsent(value.draft, value.reason));
        this.creating.set(false);
        this.revising.set(null);
        this.notify.success(this.translate.instant('cat.consent.published_ok') as string);
        await this.reload();
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
      const result = await firstValueFrom(this.api.consentPolicies(this.locale()));
      if (!current()) return;
      this.items.set(result.policies);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}
