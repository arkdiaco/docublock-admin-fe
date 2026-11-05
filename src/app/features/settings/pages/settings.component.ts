import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
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
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { SettingActionConfirmComponent } from '../components/setting-action-confirm.component';
import { SettingDetailComponent } from '../components/setting-detail.component';
import { SettingEditComponent, type SettingEditResult } from '../components/setting-edit.component';
import { SettingsTabsComponent } from '../components/settings-tabs.component';
import { isTextKind, valueLabelOf } from '../data/settings-view';
import { SettingsApi, settingErrorKey } from '../data/settings.api';
import type { SettingGroup, SettingItem, SettingValue } from '../data/settings.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'setting', labelKey: 'cfg.col.setting', width: 'minmax(0, 2.4fr)' },
  { key: 'value', labelKey: 'cfg.col.value', width: '150px' },
  { key: 'source', labelKey: 'cfg.col.source', width: '150px' },
  { key: 'last', labelKey: 'cfg.col.last', width: 'minmax(0, 1.2fr)' },
  { key: 'chevron', width: '24px', align: 'end' },
];

type SettingMode = 'detail' | 'edit' | 'reset';

@Component({
  selector: 'dba-settings',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    SectionLoaderComponent,
    SettingActionConfirmComponent,
    SettingDetailComponent,
    SettingEditComponent,
    SettingsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.settings' | translate }}</h1>
          <span class="dba-meta">{{ 'cfg.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="refreshing()" (click)="load(false)">
          {{ 'cfg.refresh' | translate }}
        </button>
      </header>

      <dba-settings-tabs [active]="group()" />

      @if (loading()) {
        <db-section-loader [label]="'cfg.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="cfg.errorTitle" leadKey="cfg.errorLead" />
          <button dba-button variant="secondary" (click)="load(true)">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'cfg.tab.' + group() | translate"
          [dense]="density.compact()"
          minWidth="820px"
        >
          @for (item of items(); track item.key) {
            <button type="button" class="dba-tr bl-row" (click)="open(item)">
              <span class="dba-td cell">
                <span class="cell__label">{{ 'cfg.item.' + item.key + '.label' | translate }}</span>
                <span class="cell__muted">{{
                  'cfg.item.' + item.key + '.audience' | translate
                }}</span>
              </span>
              <span class="dba-td cell"
                ><span
                  class="cell__text"
                  [class.dba-mono]="!textual(item)"
                  [title]="label(item, item.value)"
                  >{{ label(item, item.value) }}</span
                ></span
              >
              <span class="dba-td cell">
                <span class="cell__muted">{{
                  (item.isDefault ? 'cfg.source.default' : 'cfg.source.changed') | translate
                }}</span>
              </span>
              <span class="dba-td cell"
                ><span class="cell__muted">{{ lastOf(item) }}</span></span
              >
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>

    @if (selected(); as item) {
      @switch (mode()) {
        @case ('edit') {
          <dba-setting-edit
            [setting]="item"
            [busy]="pending.key() === 'save'"
            (submitted)="save(item, $event)"
            (dismissed)="mode.set('detail')"
          />
        }
        @case ('reset') {
          <dba-setting-action-confirm
            titleKey="cfg.reset.title"
            confirmKey="cfg.reset.confirm"
            [subtitle]="'cfg.item.' + item.key + '.label' | translate"
            [summary]="resetSummary(item)"
            [busy]="pending.key() === 'save'"
            (submitted)="reset(item, $event)"
            (dismissed)="mode.set('detail')"
          />
        }
        @default {
          <dba-setting-detail
            [setting]="item"
            (changing)="mode.set('edit')"
            (resetting)="mode.set('reset')"
            (dismissed)="selectedKey.set(null)"
          />
        }
      }
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class SettingsComponent {
  readonly group = input<SettingGroup>('alerts');

  private readonly api = inject(SettingsApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly pending = new PendingAction();
  protected readonly columns = COLUMNS;
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal(false);
  private readonly all = signal<SettingItem[]>([]);
  protected readonly items = computed(() =>
    this.all().filter((item) => item.group === this.group()),
  );
  protected readonly selectedKey = signal<string | null>(null);
  protected readonly mode = signal<SettingMode>('detail');
  protected readonly selected = computed(
    () => this.items().find((item) => item.key === this.selectedKey()) ?? null,
  );

  constructor() {
    void this.load(true);
  }

  protected open(item: SettingItem): void {
    this.mode.set('detail');
    this.selectedKey.set(item.key);
  }

  protected label(item: SettingItem, value: SettingValue): string {
    const { key, params } = valueLabelOf(item.unit, value);
    return this.translate.instant(key, params) as string;
  }

  protected textual(item: SettingItem): boolean {
    return isTextKind(item.kind);
  }

  protected lastOf(item: SettingItem): string {
    const last = item.lastChange;
    if (!last) return '—';
    const name = last.adminName ?? (this.translate.instant('cfg.unknownAdmin') as string);
    return `${formatDate(last.at, 'd/MM/y', this.locale)} · ${name}`;
  }

  protected resetSummary(item: SettingItem): string {
    return this.translate.instant('cfg.reset.summary', {
      from: this.label(item, item.value),
      to: this.label(item, item.defaultValue),
    }) as string;
  }

  protected save(item: SettingItem, { value, reason }: SettingEditResult): Promise<void> {
    return this.act(
      () => this.api.change(item.key, value, { reason, expectedVersion: item.version }),
      'cfg.edit.done',
    );
  }

  protected reset(item: SettingItem, reason: string): Promise<void> {
    return this.act(
      () => this.api.reset(item.key, { reason, expectedVersion: item.version }),
      'cfg.reset.done',
    );
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) this.loading.set(true);
    else this.refreshing.set(true);
    try {
      const { items } = await firstValueFrom(this.api.list());
      if (!current()) return;
      this.all.set(items);
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

  private async act(work: () => ReturnType<SettingsApi['reset']>, doneKey: string): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('save', async () => {
      try {
        await firstValueFrom(work());
        this.notify.success(this.translate.instant(doneKey) as string);
        this.selectedKey.set(null);
        await this.load(false);
      } catch (error) {
        this.notify.error(this.translate.instant(settingErrorKey(error)) as string);
        if (errorCodeOf(error) === 'CONFIG_EN_CAMBIO') {
          this.mode.set('detail');
          await this.load(false);
        }
      }
    });
  }
}
