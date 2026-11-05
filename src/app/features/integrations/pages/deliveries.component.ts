import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CursorNavComponent } from '../components/cursor-nav.component';
import { DeliveryDetailComponent } from '../components/delivery-detail.component';
import { DeliveryReplayConfirmComponent } from '../components/delivery-replay-confirm.component';
import { DeliveryRetryConfirmComponent } from '../components/delivery-retry-confirm.component';
import { IntegrationsTabsComponent } from '../components/integrations-tabs.component';
import { ALL_STATUSES, deliveryStateOf, resultOf, statusPills } from '../data/delivery-view';
import { FilterUrl } from '../data/filter-url';
import { IntegrationsApi, actionErrorKey, isBridgeDown, replayErrorKey } from '../data/integrations.api';
import {
  DELIVERY_EVENTS,
  type DeliveryDetail,
  type DeliveryRow,
  type DeliveryStatus,
  type OpenDeliveryCounts,
  type ReplayResult,
  type RetryableStatus,
  type RetryFilter,
  type RetryPreview,
} from '../data/integrations.models';

export const DELIVERIES_LIMIT = 25;

const COLUMNS: readonly DataColumn[] = [
  { key: 'organization', labelKey: 'dlv.col.organization', width: 'minmax(0, 1.4fr)' },
  { key: 'event', labelKey: 'dlv.col.event', width: 'minmax(0, 1.5fr)' },
  { key: 'status', labelKey: 'dlv.col.status', width: '120px' },
  { key: 'attempts', labelKey: 'dlv.col.attempts', width: '104px', align: 'end' },
  { key: 'result', labelKey: 'dlv.col.result', width: 'minmax(0, 1.4fr)' },
  { key: 'created', labelKey: 'dlv.col.created', width: '150px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

const HOUR = 3_600_000;
const PERIODS: Record<string, number> = { '24h': 24 * HOUR, '7d': 7 * 24 * HOUR, '30d': 30 * 24 * HOUR };
const ANY = '';
const RETRYABLE: readonly string[] = ['failed', 'exhausted'];
const VIEWS: readonly string[] = ['failed', 'exhausted', 'pending', 'delivered'];

type LoadError = 'down' | 'failed' | null;

@Component({
  selector: 'dba-deliveries',
  imports: [
    TranslatePipe,
    FormsModule,
    Select,
    ButtonComponent,
    CursorNavComponent,
    DataTableComponent,
    DeliveryDetailComponent,
    DeliveryReplayConfirmComponent,
    DeliveryRetryConfirmComponent,
    EmptyStateComponent,
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
          <span class="dba-meta">{{ 'dlv.lead' | translate }}</span>
        </div>
        <div class="heading-actions">
          @if (canRetry()) {
            <button dba-button variant="secondary" [disabled]="pending.key() === 'preview'" (click)="askRetry()">
              {{ 'dlv.retry.action' | translate }}
            </button>
          }
          <button dba-button variant="secondary" [disabled]="refreshing()" (click)="refresh()">
            {{ 'dlv.refresh' | translate }}
          </button>
        </div>
      </header>

      <dba-integrations-tabs active="deliveries" [organizationId]="organizationId()" />

      <db-filter-pills
        [pills]="pills()"
        [active]="status()"
        [label]="'dlv.col.status' | translate"
        (activeChange)="setFilter(status, $event)"
      />

      <div class="bl__tools">
        <dba-org-picker [value]="organizationId()" (picked)="setOrganization($event)" />
        <p-select
          [options]="eventOptions()"
          optionLabel="label"
          optionValue="id"
          [filter]="true"
          [ngModel]="event()"
          (ngModelChange)="setFilter(event, $event)"
          [ariaLabel]="'dlv.col.event' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
        <p-select
          [options]="periodOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="period()"
          (ngModelChange)="setFilter(period, $event)"
          [ariaLabel]="'dlv.filter.period' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'dlv.loading' | translate" />
      } @else if (loadError(); as problem) {
        <div class="bl__panel">
          <dba-empty-state
            [titleKey]="problem === 'down' ? 'dlv.downTitle' : 'dlv.errorTitle'"
            [leadKey]="problem === 'down' ? 'dlv.downLead' : 'dlv.errorLead'"
          />
          <button dba-button variant="secondary" (click)="load(true)">{{ 'common.retry' | translate }}</button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state [titleKey]="filtered() ? 'dlv.emptyFiltered' : 'dlv.empty'" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'dlv.tableLabel' | translate"
          [dense]="density.compact()"
          minWidth="980px"
        >
          @for (row of rows(); track row.id) {
            <button type="button" class="dba-tr bl-row" (click)="open(row)">
              <span class="dba-td cell">
                <span class="cell__label">{{ row.organizationName || ('dlv.unknownOrg' | translate) }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text dba-mono">{{ row.event }}</span>
                <span class="cell__muted">
                  {{ 'dlv.contractOf.' + row.contract | translate }}
                  @if (row.test) {
                    · {{ 'dlv.test' | translate }}
                  }
                </span>
              </span>
              <span class="dba-td cell">
                <dba-org-state [state]="stateOf(row)" [labelKey]="'dlv.status.' + row.status" variant="inline" />
              </span>
              <span class="dba-td cell cell--end dba-mono">{{ row.attempts }}</span>
              <span class="dba-td cell"><span class="cell__muted">{{ result(row) }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ when(row.createdAt) }}</span></span>
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

    @if (retryPreview(); as preview) {
      <dba-delivery-retry-confirm
        [preview]="preview"
        [busy]="pending.key() === 'retry'"
        (submitted)="retry($event)"
        (dismissed)="retryPreview.set(null)"
      />
    }

    @if (selected(); as row) {
      @if (confirming() && detail(); as delivery) {
        <dba-delivery-replay-confirm
          [delivery]="delivery"
          [busy]="pending.key() === 'replay'"
          (submitted)="replay(delivery, $event)"
          (dismissed)="confirming.set(false)"
        />
      } @else {
        <dba-delivery-detail
          [row]="row"
          [detail]="detail()"
          [failed]="detailFailed()"
          (replay)="confirming.set(true)"
          (dismissed)="close()"
        />
      }
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .cell--end {
      align-items: flex-end;
    }

    .heading-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class DeliveriesComponent {
  private readonly api = inject(IntegrationsApi);
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();
  private readonly latestDetail = new LatestRequest();
  private readonly latestCounts = new LatestRequest();
  private readonly url = new FilterUrl();
  private readonly cursors = signal<(string | null)[]>([null]);

  protected readonly density = inject(DensityService);
  protected readonly pending = new PendingAction();
  protected readonly columns = COLUMNS;
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly loadError = signal<LoadError>(null);
  protected readonly rows = signal<DeliveryRow[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly counts = signal<OpenDeliveryCounts | null>(null);
  protected readonly status = signal(this.url.view(VIEWS) ?? ALL_STATUSES);
  protected readonly organizationId = signal(this.url.organization());
  protected readonly event = signal(ANY);
  protected readonly period = signal(ANY);
  protected readonly selected = signal<DeliveryRow | null>(null);
  protected readonly detail = signal<DeliveryDetail | null>(null);
  protected readonly detailFailed = signal(false);
  protected readonly confirming = signal(false);
  protected readonly retryPreview = signal<RetryPreview | null>(null);

  protected readonly canRetry = computed(
    () => this.auth.canManage('operations') && (!this.status() || RETRYABLE.includes(this.status())),
  );
  protected readonly pills = computed(() => statusPills(this.counts()));
  protected readonly hasPrevious = computed(() => this.cursors().length > 1);
  protected readonly filtered = computed(
    () => !!(this.status() || this.organizationId() || this.event() || this.period()),
  );
  protected readonly eventOptions = computed(() => [
    { id: ANY, label: this.text('dlv.filter.anyEvent') },
    ...DELIVERY_EVENTS.map((event) => ({ id: event, label: event })),
  ]);
  protected readonly periodOptions = computed(() => [
    { id: ANY, label: this.text('dlv.filter.anyPeriod') },
    ...Object.keys(PERIODS).map((id) => ({ id, label: this.text(`dlv.filter.period${id}`) })),
  ]);

  constructor() {
    void this.load(true);
    void this.loadCounts();
  }

  protected stateOf(row: DeliveryRow): ReturnType<typeof deliveryStateOf> {
    return deliveryStateOf(row.status);
  }

  protected result(row: DeliveryRow): string {
    return resultOf(row);
  }

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm', this.locale);
  }

  protected setFilter<T>(filter: { set(value: T): void }, value: T): void {
    filter.set(value);
    this.cursors.set([null]);
    this.url.write(this.organizationId(), this.status());
    void this.load(true);
  }

  protected setOrganization(id: string | null): void {
    this.setFilter(this.organizationId, id);
    void this.loadCounts();
  }

  protected refresh(): void {
    void this.load(false);
    void this.loadCounts();
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

  protected async open(row: DeliveryRow): Promise<void> {
    const current = this.latestDetail.start();
    this.selected.set(row);
    this.detail.set(null);
    this.detailFailed.set(false);
    this.confirming.set(false);
    try {
      const detail = await firstValueFrom(this.api.detail(row.id));
      if (current()) this.detail.set(detail);
    } catch {
      if (current()) this.detailFailed.set(true);
    }
  }

  protected close(): void {
    this.latestDetail.start();
    this.selected.set(null);
    this.detail.set(null);
    this.confirming.set(false);
  }

  protected async replay(delivery: DeliveryDetail, reason: string): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('replay', async () => {
      try {
        const result = await firstValueFrom(this.api.replay(delivery.id, reason));
        this.announce(result);
        this.selected.set(result.delivery);
        this.detail.set(result.delivery);
        this.confirming.set(false);
        this.cursors.set([null]);
        void this.loadCounts();
        await this.load(false);
      } catch (error) {
        this.notify.error(this.text(replayErrorKey(error)));
      }
    });
  }

  protected async askRetry(): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('preview', async () => {
      try {
        const preview = await firstValueFrom(this.api.retryPreview(this.retryFilter()));
        if (preview.failed + preview.exhausted === 0) this.notify.info(this.text('dlv.retry.none'));
        else this.retryPreview.set(preview);
      } catch (error) {
        this.notify.error(this.text(actionErrorKey(error, 'dlv.retry.error')));
      }
    });
  }

  protected async retry(reason: string): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('retry', async () => {
      try {
        const { taken, remaining } = await firstValueFrom(this.api.retryFailed(this.retryFilter(), reason));
        const key = remaining > 0 ? 'dlv.retry.takenSome' : 'dlv.retry.taken';
        this.notify.success(this.translate.instant(key, { taken, remaining }) as string);
        this.retryPreview.set(null);
        this.cursors.set([null]);
        void this.loadCounts();
        await this.load(false);
      } catch (error) {
        this.notify.error(this.text(actionErrorKey(error, 'dlv.retry.error')));
      }
    });
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) this.loading.set(true);
    else this.refreshing.set(true);
    try {
      const page = await firstValueFrom(
        this.api.deliveries({
          organizationId: this.organizationId(),
          event: this.event(),
          status: (this.status() || null) as DeliveryStatus | null,
          from: this.fromDate(),
          cursor: this.cursors().at(-1) ?? null,
          limit: DELIVERIES_LIMIT,
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

  private async loadCounts(): Promise<void> {
    const current = this.latestCounts.start();
    try {
      const counts = await firstValueFrom(this.api.summary(this.organizationId()));
      if (current()) this.counts.set(counts);
    } catch {
      if (current()) this.counts.set(null);
    }
  }

  private announce(result: ReplayResult): void {
    if (result.delivered) {
      this.notify.success(this.text('dlv.replay.delivered'));
      return;
    }
    const key = result.exhausted ? 'dlv.replay.notDelivered' : 'dlv.replay.willRetry';
    this.notify.error(
      this.translate.instant(key, { detail: result.error ?? result.statusCode ?? '—' }) as string,
    );
  }

  private retryFilter(): RetryFilter {
    return {
      organizationId: this.organizationId(),
      event: this.event(),
      status: (this.status() || null) as RetryableStatus | null,
      from: this.fromDate(),
    };
  }

  private fromDate(): string | null {
    const span = PERIODS[this.period()];
    return span ? new Date(Date.now() - span).toISOString() : null;
  }

  private text(key: string): string {
    return this.translate.instant(key) as string;
  }
}
