import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
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
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CursorNavComponent } from '../components/cursor-nav.component';
import { IntegrationsTabsComponent } from '../components/integrations-tabs.component';
import { KeyDetailComponent } from '../components/key-detail.component';
import { KeyRevokeConfirmComponent } from '../components/key-revoke-confirm.component';
import { FilterUrl } from '../data/filter-url';
import { IntegrationsApi, actionErrorKey, isBridgeDown } from '../data/integrations.api';
import type { KeyCounts, KeyFilter, KeyRow, KeyState } from '../data/integrations.models';
import { ALL_KEYS, keyPills, keyStateOf } from '../data/key-view';

export const KEYS_LIMIT = 25;

const COLUMNS: readonly DataColumn[] = [
  { key: 'organization', labelKey: 'ikey.col.organization', width: 'minmax(0, 1.4fr)' },
  { key: 'key', labelKey: 'ikey.col.key', width: 'minmax(0, 1.6fr)' },
  { key: 'state', labelKey: 'ikey.col.state', width: '120px' },
  { key: 'used', labelKey: 'ikey.col.used', width: '150px' },
  { key: 'expires', labelKey: 'ikey.col.expires', width: '150px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

const VIEWS: readonly string[] = ['expiring', 'unused', 'expired', 'revoked'];

type LoadError = 'down' | 'failed' | null;

@Component({
  selector: 'dba-keys',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CursorNavComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    IconComponent,
    IntegrationsTabsComponent,
    KeyDetailComponent,
    KeyRevokeConfirmComponent,
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
          <span class="dba-meta">{{ 'ikey.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="refreshing()" (click)="refresh()">
          {{ 'dlv.refresh' | translate }}
        </button>
      </header>

      <dba-integrations-tabs active="keys" [organizationId]="organizationId()" />

      <db-filter-pills
        [pills]="pills()"
        [active]="filter()"
        [label]="'ikey.col.state' | translate"
        (activeChange)="setFilter(filter, $event)"
      />

      <div class="bl__tools">
        <dba-org-picker [value]="organizationId()" (picked)="setOrganization($event)" />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'ikey.loading' | translate" />
      } @else if (loadError(); as problem) {
        <div class="bl__panel">
          <dba-empty-state
            [titleKey]="problem === 'down' ? 'dlv.downTitle' : 'ikey.errorTitle'"
            [leadKey]="problem === 'down' ? 'dlv.downLead' : 'dlv.errorLead'"
          />
          <button dba-button variant="secondary" (click)="load(true)">{{ 'common.retry' | translate }}</button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state [titleKey]="filter() || organizationId() ? 'ikey.emptyFiltered' : 'ikey.empty'" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'ikey.tableLabel' | translate"
          [dense]="density.compact()"
          minWidth="860px"
        >
          @for (row of rows(); track row.id) {
            <button type="button" class="dba-tr bl-row" (click)="selected.set(row)">
              <span class="dba-td cell">
                <span class="cell__label">{{ row.organizationName || ('dlv.unknownOrg' | translate) }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ row.name }}</span>
                <span class="cell__muted dba-mono">{{ row.prefix }}</span>
              </span>
              <span class="dba-td cell">
                <dba-org-state [state]="stateOf(row.state)" [labelKey]="'integ.keyState.' + row.state" variant="inline" />
              </span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ usedOf(row) }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ expiresOf(row) }}</span></span>
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

    @if (selected(); as key) {
      @if (confirming()) {
        <dba-key-revoke-confirm
          [key]="key"
          [busy]="pending.key() === 'revoke'"
          (submitted)="revoke(key, $event)"
          (dismissed)="confirming.set(false)"
        />
      } @else {
        <dba-key-detail [key]="key" (revoke)="confirming.set(true)" (dismissed)="selected.set(null)" />
      }
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class KeysComponent {
  private readonly api = inject(IntegrationsApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();
  private readonly latestCounts = new LatestRequest();
  private readonly url = new FilterUrl();
  private readonly cursors = signal<(string | null)[]>([null]);

  protected readonly density = inject(DensityService);
  protected readonly pending = new PendingAction();
  protected readonly columns = COLUMNS;
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly loadError = signal<LoadError>(null);
  protected readonly rows = signal<KeyRow[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly counts = signal<KeyCounts | null>(null);
  protected readonly filter = signal(this.url.view(VIEWS) ?? ALL_KEYS);
  protected readonly organizationId = signal(this.url.organization());
  protected readonly selected = signal<KeyRow | null>(null);
  protected readonly confirming = signal(false);

  protected readonly pills = computed(() => keyPills(this.counts()));
  protected readonly hasPrevious = computed(() => this.cursors().length > 1);

  constructor() {
    void this.load(true);
    void this.loadCounts();
  }

  protected stateOf(state: KeyState): ReturnType<typeof keyStateOf> {
    return keyStateOf(state);
  }

  protected usedOf(row: KeyRow): string {
    return row.lastUsedAt ? this.when(row.lastUsedAt) : (this.translate.instant('ikey.neverUsed') as string);
  }

  protected expiresOf(row: KeyRow): string {
    return row.expiresAt ? this.when(row.expiresAt) : (this.translate.instant('ikey.noExpiry') as string);
  }

  protected setFilter<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.cursors.set([null]);
    this.url.write(this.organizationId(), this.filter());
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

  protected async revoke(key: KeyRow, reason: string): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('revoke', async () => {
      try {
        await firstValueFrom(this.api.revokeKey(key.id, reason));
        this.notify.success(this.translate.instant('ikey.revoke.done') as string);
        this.finishRevoke();
      } catch (error) {
        if (errorCodeOf(error) === 'INTEGRATION_KEY_ALREADY_REVOKED') {
          this.notify.info(this.translate.instant('ikey.revoke.already') as string);
          this.finishRevoke();
        } else {
          this.notify.error(this.translate.instant(actionErrorKey(error, 'ikey.revoke.error')) as string);
        }
      }
    });
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) this.loading.set(true);
    else this.refreshing.set(true);
    try {
      const page = await firstValueFrom(
        this.api.keys({
          organizationId: this.organizationId(),
          filter: (this.filter() || null) as KeyFilter | null,
          cursor: this.cursors().at(-1) ?? null,
          limit: KEYS_LIMIT,
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

  private finishRevoke(): void {
    this.confirming.set(false);
    this.selected.set(null);
    this.refresh();
  }

  private async loadCounts(): Promise<void> {
    const current = this.latestCounts.start();
    try {
      const counts = await firstValueFrom(this.api.keySummary(this.organizationId()));
      if (current()) this.counts.set(counts);
    } catch {
      if (current()) this.counts.set(null);
    }
  }

  private when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm', this.locale);
  }
}
