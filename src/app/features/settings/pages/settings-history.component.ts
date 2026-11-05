import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { PagerComponent } from '../../../shared/ui/pager.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { SettingActionConfirmComponent } from '../components/setting-action-confirm.component';
import { SettingsTabsComponent } from '../components/settings-tabs.component';
import { sameSettingValue, valueLabelOf } from '../data/settings-view';
import { SettingsApi, settingErrorKey } from '../data/settings.api';
import type { SettingChange, SettingItem, SettingValue } from '../data/settings.models';

export const HISTORY_LIMIT = 20;

const COLUMNS: readonly DataColumn[] = [
  { key: 'at', labelKey: 'cfg.history.col.at', width: '150px' },
  { key: 'setting', labelKey: 'cfg.history.col.setting', width: 'minmax(0, 1.3fr)' },
  { key: 'change', labelKey: 'cfg.history.col.change', width: 'minmax(230px, 1.2fr)' },
  { key: 'who', labelKey: 'cfg.history.col.who', width: 'minmax(0, 1fr)' },
  { key: 'reason', labelKey: 'cfg.history.col.reason', width: 'minmax(0, 1.4fr)' },
  { key: 'action', width: '120px', align: 'end' },
];

@Component({
  selector: 'dba-settings-history',
  imports: [
    TranslatePipe,
    FormsModule,
    Select,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    PagerComponent,
    SectionLoaderComponent,
    SettingActionConfirmComponent,
    SettingsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.settings' | translate }}</h1>
          <span class="dba-meta">{{ 'cfg.history.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="refreshing()" (click)="load(false)">
          {{ 'cfg.refresh' | translate }}
        </button>
      </header>

      <dba-settings-tabs active="history" />

      <div class="bl__tools">
        <p-select
          [options]="keyOptions()"
          optionLabel="label"
          optionValue="id"
          [filter]="true"
          [ngModel]="key()"
          (ngModelChange)="setKey($event)"
          [ariaLabel]="'cfg.history.col.setting' | translate"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'cfg.history.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="cfg.history.errorTitle" leadKey="cfg.errorLead" />
          <button dba-button variant="secondary" (click)="load(true)">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="bl__panel">
          <dba-empty-state [titleKey]="key() ? 'cfg.history.emptyFiltered' : 'cfg.history.empty'" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'cfg.tab.history' | translate"
          [dense]="density.compact()"
          minWidth="980px"
        >
          @for (row of rows(); track row.id) {
            <div class="dba-tr">
              <span class="dba-td cell"
                ><span class="cell__muted dba-mono">{{ when(row.at) }}</span></span
              >
              <span class="dba-td cell">
                <span class="cell__label">{{ 'cfg.item.' + row.key + '.label' | translate }}</span>
                <span class="cell__muted">{{ 'cfg.action.' + row.action | translate }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text dba-mono" [title]="newValueOf(row)">{{
                  newValueOf(row)
                }}</span>
                <span class="cell__meta dba-mono" [title]="beforeOf(row)">{{ beforeOf(row) }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{
                  row.adminName || ('cfg.unknownAdmin' | translate)
                }}</span>
              </span>
              <span class="dba-td cell"
                ><span class="cell__muted" [title]="row.reason">{{ row.reason }}</span></span
              >
              <span class="dba-td dba-td--end">
                @if (canRestore(row)) {
                  <button dba-button variant="secondary" (click)="restoring.set(row)">
                    {{ 'cfg.history.restore' | translate }}
                  </button>
                }
              </span>
            </div>
          }
        </dba-data-table>

        @if (pageCount() > 1) {
          <db-pager [page]="page()" [pageCount]="pageCount()" (pageChange)="setPage($event)" />
        }
      }
    </section>

    @if (restoring(); as row) {
      <dba-setting-action-confirm
        titleKey="cfg.history.restoreTitle"
        confirmKey="cfg.history.restoreConfirm"
        [subtitle]="'cfg.item.' + row.key + '.label' | translate"
        [summary]="restoreSummary(row)"
        [busy]="pending.key() === 'restore'"
        (submitted)="restore(row, $event)"
        (dismissed)="restoring.set(null)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class SettingsHistoryComponent {
  private readonly api = inject(SettingsApi);
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();
  private readonly items = signal<SettingItem[]>([]);

  protected readonly density = inject(DensityService);
  protected readonly pending = new PendingAction();
  protected readonly columns = COLUMNS;
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal(false);
  protected readonly rows = signal<SettingChange[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly key = signal('');
  protected readonly restoring = signal<SettingChange | null>(null);

  protected readonly pageCount = computed(() => Math.ceil(this.total() / HISTORY_LIMIT));
  protected readonly keyOptions = computed(() => [
    { id: '', label: this.translate.instant('cfg.history.all') as string },
    ...this.items().map((item) => ({
      id: item.key,
      label: this.translate.instant(`cfg.item.${item.key}.label`) as string,
    })),
  ]);

  constructor() {
    void this.load(true);
  }

  protected setKey(key: string): void {
    this.key.set(key);
    this.page.set(1);
    void this.load(true);
  }

  protected setPage(page: number): void {
    this.page.set(page);
    void this.load(false);
  }

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm', this.locale);
  }

  protected newValueOf(row: SettingChange): string {
    return this.sideOf(row, row.to, row.toDefault);
  }

  protected beforeOf(row: SettingChange): string {
    return this.translate.instant('cfg.history.before', {
      value: this.sideOf(row, row.from, row.fromDefault),
    }) as string;
  }

  protected canRestore(row: SettingChange): boolean {
    if (!this.auth.canManage('platform')) return false;
    const current = this.items().find((item) => item.key === row.key);
    if (!current) return false;
    return !sameSettingValue(current.value, row.from) || current.isDefault !== row.fromDefault;
  }

  protected restoreSummary(row: SettingChange): string {
    return this.translate.instant('cfg.history.restoreSummary', {
      value: this.sideOf(row, row.from, row.fromDefault),
    }) as string;
  }

  protected async restore(row: SettingChange, reason: string): Promise<void> {
    const current = this.items().find((item) => item.key === row.key);
    if (!current || this.pending.key()) return;
    await this.pending.run('restore', async () => {
      try {
        await firstValueFrom(
          this.api.restore(row.id, { reason, expectedVersion: current.version }),
        );
        this.notify.success(this.translate.instant('cfg.history.restoreDone') as string);
      } catch (error) {
        this.notify.error(this.translate.instant(settingErrorKey(error)) as string);
      }
      this.restoring.set(null);
      this.page.set(1);
      await this.load(false);
    });
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) this.loading.set(true);
    else this.refreshing.set(true);
    try {
      const [list, history] = await Promise.all([
        firstValueFrom(this.api.list()),
        firstValueFrom(
          this.api.history({ key: this.key() || null, page: this.page(), limit: HISTORY_LIMIT }),
        ),
      ]);
      if (!current()) return;
      this.items.set(list.items);
      this.rows.set(history.items);
      this.total.set(history.total);
      this.error.set(false);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) {
        this.loading.set(false);
        this.refreshing.set(false);
      }
    }
  }

  private sideOf(row: SettingChange, value: SettingValue, isDefault: boolean): string {
    const item = this.items().find((one) => one.key === row.key);
    if (!item) return String(value);
    const { key, params } = valueLabelOf(item.unit, value);
    const label = this.translate.instant(key, params) as string;
    return isDefault
      ? `${label} ${this.translate.instant('cfg.history.defaultMark') as string}`
      : label;
  }
}
