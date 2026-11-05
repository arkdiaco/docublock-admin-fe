import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, inject, computed, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CursorNavComponent } from '../components/cursor-nav.component';
import { EndpointDetailComponent } from '../components/endpoint-detail.component';
import { EndpointToggleConfirmComponent } from '../components/endpoint-toggle-confirm.component';
import { IntegrationsTabsComponent } from '../components/integrations-tabs.component';
import { IntegrationsApi, actionErrorKey, isBridgeDown } from '../data/integrations.api';
import type { EndpointRow } from '../data/integrations.models';

export const ENDPOINTS_LIMIT = 25;

const COLUMNS: readonly DataColumn[] = [
  { key: 'organization', labelKey: 'iep.col.organization', width: 'minmax(0, 1.2fr)' },
  { key: 'url', labelKey: 'iep.col.url', width: 'minmax(0, 2fr)' },
  { key: 'state', labelKey: 'iep.col.state', width: '130px' },
  { key: 'failures', labelKey: 'iep.col.failures', width: '120px', align: 'end' },
  { key: 'error', labelKey: 'iep.col.error', width: 'minmax(0, 1.2fr)' },
  { key: 'chevron', width: '24px', align: 'end' },
];

const PILLS: FilterPill[] = [
  { key: '', labelKey: 'iep.filter.all' },
  { key: 'true', labelKey: 'iep.filter.enabled' },
  { key: 'false', labelKey: 'iep.filter.disabled' },
];

type LoadError = 'down' | 'failed' | null;

@Component({
  selector: 'dba-endpoints',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CursorNavComponent,
    DataTableComponent,
    EmptyStateComponent,
    EndpointDetailComponent,
    EndpointToggleConfirmComponent,
    FilterPillsComponent,
    IconComponent,
    IntegrationsTabsComponent,
    OrgPickerComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.integrations' | translate }}</h1>
          <span class="dba-meta">{{ 'iep.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="refreshing()" (click)="refresh()">
          {{ 'dlv.refresh' | translate }}
        </button>
      </header>

      <dba-integrations-tabs active="endpoints" />

      <db-filter-pills
        [pills]="pills"
        [active]="enabled()"
        [label]="'iep.col.state' | translate"
        (activeChange)="setFilter(enabled, $event)"
      />

      <div class="bl__tools">
        <dba-org-picker [value]="organizationId()" (picked)="setFilter(organizationId, $event)" />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'iep.loading' | translate" />
      } @else if (loadError(); as problem) {
        <div class="bl__panel">
          <dba-empty-state
            [titleKey]="problem === 'down' ? 'dlv.downTitle' : 'iep.errorTitle'"
            [leadKey]="problem === 'down' ? 'dlv.downLead' : 'dlv.errorLead'"
          />
          <button dba-button variant="secondary" (click)="load(true)">{{ 'common.retry' | translate }}</button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state [titleKey]="enabled() || organizationId() ? 'iep.emptyFiltered' : 'iep.empty'" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'iep.tableLabel' | translate"
          [dense]="density.compact()"
          minWidth="900px"
        >
          @for (row of rows(); track row.id) {
            <button type="button" class="dba-tr bl-row" (click)="selected.set(row)">
              <span class="dba-td cell">
                <span class="cell__label">{{ row.organizationName || ('dlv.unknownOrg' | translate) }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text dba-mono">{{ row.url }}</span>
                @if (row.description) {
                  <span class="cell__muted">{{ row.description }}</span>
                }
              </span>
              <span class="dba-td cell">
                <dba-org-state
                  [state]="row.enabled ? 'active' : 'suspended'"
                  [labelKey]="row.enabled ? 'iep.state.enabled' : 'iep.state.disabled'"
                  variant="inline"
                />
              </span>
              <span class="dba-td cell cell--end dba-mono">{{ row.recentFailures }}</span>
              <span class="dba-td cell">
                <span class="cell__muted">{{ errorOf(row) }}</span>
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>

        @if (hasPrevious() || nextCursor()) {
          <dba-cursor-nav
            [hasPrevious]="hasPrevious()"
            [hasNext]="!!nextCursor()"
            [busy]="refreshing()"
            (previous)="previous()"
            (next)="next()"
          />
        }
      }
    </section>

    @if (selected(); as endpoint) {
      @if (confirming()) {
        <dba-endpoint-toggle-confirm
          [endpoint]="endpoint"
          [busy]="pending.key() === 'toggle'"
          (submitted)="toggle(endpoint, $event)"
          (dismissed)="confirming.set(false)"
        />
      } @else {
        <dba-endpoint-detail [endpoint]="endpoint" (switched)="confirming.set(true)" (dismissed)="selected.set(null)" />
      }
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .cell--end {
      align-items: flex-end;
    }
  `,
})
export class EndpointsComponent {
  private readonly api = inject(IntegrationsApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();
  private readonly cursors = signal<(string | null)[]>([null]);

  protected readonly density = inject(DensityService);
  protected readonly pending = new PendingAction();
  protected readonly columns = COLUMNS;
  protected readonly pills = PILLS;
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly loadError = signal<LoadError>(null);
  protected readonly rows = signal<EndpointRow[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly enabled = signal('');
  protected readonly organizationId = signal<string | null>(null);
  protected readonly selected = signal<EndpointRow | null>(null);
  protected readonly confirming = signal(false);

  protected readonly hasPrevious = computed(() => this.cursors().length > 1);

  constructor() {
    void this.load(true);
  }

  protected errorOf(row: EndpointRow): string {
    if (!row.lastFailureAt) return '—';
    return [formatDate(row.lastFailureAt, 'd/MM/y', this.locale), row.lastError].filter(Boolean).join(' · ');
  }

  protected setFilter<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.cursors.set([null]);
    void this.load(true);
  }

  protected refresh(): void {
    void this.load(false);
  }

  protected next(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;
    this.cursors.update((all) => [...all, cursor]);
    void this.load(false);
  }

  protected previous(): void {
    this.cursors.update((all) => all.slice(0, -1));
    void this.load(false);
  }

  protected async toggle(endpoint: EndpointRow, reason: string): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('toggle', async () => {
      try {
        await firstValueFrom(this.api.setEndpointEnabled(endpoint.id, !endpoint.enabled, reason));
        const key = endpoint.enabled ? 'iep.disable.done' : 'iep.enable.done';
        this.notify.success(this.translate.instant(key) as string);
        this.confirming.set(false);
        this.selected.set(null);
        await this.load(false);
      } catch (error) {
        this.notify.error(this.translate.instant(actionErrorKey(error, 'iep.error')) as string);
      }
    });
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) this.loading.set(true);
    else this.refreshing.set(true);
    try {
      const page = await firstValueFrom(
        this.api.endpoints({
          organizationId: this.organizationId(),
          enabled: this.enabled() ? this.enabled() === 'true' : null,
          cursor: this.cursors().at(-1) ?? null,
          limit: ENDPOINTS_LIMIT,
        }),
      );
      if (!current()) return;
      this.rows.set(page.data);
      this.nextCursor.set(page.nextCursor);
      this.loadError.set(null);
    } catch (error) {
      if (current()) this.loadError.set(isBridgeDown(error) ? 'down' : 'failed');
    } finally {
      if (current()) {
        this.loading.set(false);
        this.refreshing.set(false);
      }
    }
  }
}
