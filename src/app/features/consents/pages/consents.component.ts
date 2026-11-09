import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { saveBlob } from '../../../shared/http/save-blob';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { browserTimeZone } from '../../validation-consumption/data/detail-view';
import { ConsentsApi } from '../data/consents.api';
import type { ConsentFilters, ConsentItem, ConsentReport } from '../data/consents.models';
import {
  LEGACY_POLICY,
  MAX_SEARCH,
  consentFiltersOf,
  consentQueryParamsOf,
  consentRangeInvalid,
  consentRequestOf,
} from '../data/consents-view';

const PAGE_SIZE = 20;
const SEARCH_DELAY = 350;
const ANY = '';

const COLUMNS: readonly DataColumn[] = [
  { key: 'acceptedAt', labelKey: 'cns.col.acceptedAt', width: '170px' },
  { key: 'signer', labelKey: 'cns.col.signer', width: 'minmax(0, 1.3fr)' },
  { key: 'document', labelKey: 'cns.col.document', width: 'minmax(0, 1.4fr)' },
  { key: 'organization', labelKey: 'cns.col.organization', width: 'minmax(0, 1.1fr)' },
  { key: 'policy', labelKey: 'cns.col.policy', width: 'minmax(0, 1.3fr)' },
  { key: 'ip', labelKey: 'cns.col.ip', width: '130px' },
];

type LoadState = 'loading' | 'ready' | 'failed';

@Component({
  selector: 'dba-consents',
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Select,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    IconComponent,
    OrgPickerComponent,
    SectionLoaderComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.consents' | translate }}</h1>
          <span class="dba-meta">{{ 'cns.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="!canExport()" (click)="downloadCsv()">
          <db-icon name="download" [size]="15" />
          {{ 'cns.csv' | translate }}
        </button>
      </header>

      <div class="bl__tools">
        <dba-field
          class="bl__date"
          label="vcon.from"
          type="date"
          [value]="filters().from ?? ''"
          (valueChange)="apply({ from: $event || null })"
        />
        <dba-field
          class="bl__date"
          label="vcon.to"
          type="date"
          [error]="invalid() ? 'vcon.rangeInvalid' : ''"
          [value]="filters().to ?? ''"
          (valueChange)="apply({ to: $event || null })"
        />
        @if (pickerScope(); as scope) {
          <dba-org-picker
            [scope]="scope"
            [value]="filters().organizationId"
            (picked)="apply({ organizationId: $event })"
          />
        }
        <p-select
          [options]="policyOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().policy"
          (ngModelChange)="apply({ policy: $event ?? '' })"
          [ariaLabel]="'cns.policyLabel' | translate"
          appendTo="body"
          styleClass="bl__select cn__policy"
        />
        <label class="bl__search cn__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [attr.maxlength]="maxSearch"
            [attr.aria-label]="'cns.searchLabel' | translate"
            [placeholder]="'cns.searchPlaceholder' | translate"
            [value]="filters().search"
            (input)="onSearch($event)"
          />
        </label>
      </div>

      @if (invalid()) {
        <p class="dba-meta cn__note">{{ 'vcon.rangeInvalid' | translate }}</p>
      } @else if (state() === 'loading') {
        <db-section-loader [label]="'cns.loading' | translate" />
      } @else if (state() === 'failed') {
        <div class="bl__panel">
          <dba-empty-state titleKey="cns.errorTitle" leadKey="cns.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (report(); as data) {
        <db-stat-band [cells]="cells()" [label]="'cns.statsLabel' | translate" />
        @if (data.total > data.exportCap) {
          <p class="dba-meta cn__note">
            {{ 'cns.exportCapped' | translate: { cap: count(data.exportCap) } }}
          </p>
        }

        @if (data.items.length === 0) {
          <div class="bl__panel">
            <dba-empty-state
              [titleKey]="filtered() ? 'cns.emptyFilteredTitle' : 'cns.emptyTitle'"
              [leadKey]="filtered() ? 'cns.emptyFilteredLead' : 'cns.emptyLead'"
            />
          </div>
        } @else {
          <dba-data-table
            [columns]="columns"
            [label]="'cns.tableLabel' | translate"
            [dense]="density.compact()"
            minWidth="1040px"
          >
            @for (item of data.items; track $index) {
              <div class="dba-tr">
                <span class="dba-td cell">
                  <span class="cell__text dba-mono">{{ stamp(item.acceptedAt) }}</span>
                </span>
                <span class="dba-td cell">
                  @if (canOpenSigner() && item.signer.signerId) {
                    <a
                      class="dba-ref cell__label"
                      [routerLink]="[signersPath, item.signer.signerId]"
                      >{{ item.signer.name }}</a
                    >
                  } @else {
                    <span class="cell__label">{{ item.signer.name }}</span>
                  }
                  <span class="cell__meta">{{
                    item.signer.identification ?? ('cns.noIdentification' | translate)
                  }}</span>
                </span>
                <span class="dba-td cell">
                  @if (canOpenDocument()) {
                    <a
                      class="dba-ref cell__label"
                      [routerLink]="[documentsPath, item.documentId]"
                      >{{ item.documentName }}</a
                    >
                  } @else {
                    <span class="cell__label">{{ item.documentName }}</span>
                  }
                  <span class="cell__meta">{{
                    item.documentCode ?? ('cns.noCode' | translate)
                  }}</span>
                </span>
                <span class="dba-td cell">
                  @if (canOpenOrganization()) {
                    <a
                      class="dba-ref cell__text"
                      [routerLink]="[organizationsPath, item.organization.id]"
                      >{{ item.organization.name ?? ('cns.unknownOrganization' | translate) }}</a
                    >
                  } @else {
                    <span class="cell__text">{{
                      item.organization.name ?? ('cns.unknownOrganization' | translate)
                    }}</span>
                  }
                </span>
                <span class="dba-td cell">
                  <span class="cell__text">{{ policyTitle(item) }}</span>
                  <span class="cell__meta">{{ policyVersion(item) }}</span>
                </span>
                <span class="dba-td cell">
                  <span class="cell__muted dba-mono">{{ item.ip ?? '—' }}</span>
                </span>
              </div>
            }
          </dba-data-table>

          @if (pageCount() > 1) {
            <nav class="cn__pager" [attr.aria-label]="'common.pagination' | translate">
              <span class="dba-meta">{{ 'cns.range' | translate: rangeParams() }}</span>
              <button
                dba-button
                variant="secondary"
                [attr.aria-label]="'common.prevPage' | translate"
                [disabled]="data.page <= 1"
                (click)="apply({ page: data.page - 1 })"
              >
                <db-icon name="chevronLeft" [size]="14" />
              </button>
              <button
                dba-button
                variant="secondary"
                [attr.aria-label]="'common.nextPage' | translate"
                [disabled]="data.page >= pageCount()"
                (click)="apply({ page: data.page + 1 })"
              >
                <db-icon name="chevronRight" [size]="14" />
              </button>
            </nav>
          }
        }
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .cn__note {
      margin: 0;
    }

    .cn__search {
      flex: 1 1 260px;
    }

    :host ::ng-deep .cn__policy.p-select {
      width: 260px;
      max-width: 100%;
    }

    .cn__pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class ConsentsComponent {
  private readonly api = inject(ConsentsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly timeZone = browserTimeZone();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly maxSearch = MAX_SEARCH;
  protected readonly documentsPath = sectionPath('documents');
  protected readonly signersPath = sectionPath('signers');
  protected readonly organizationsPath = sectionPath('organizations');
  protected readonly filters = signal<ConsentFilters>(
    consentFiltersOf(this.route.snapshot.queryParams),
  );
  protected readonly state = signal<LoadState>('loading');
  protected readonly report = signal<ConsentReport | null>(null);
  protected readonly exporting = signal(false);

  protected readonly invalid = computed(() => consentRangeInvalid(this.filters()));
  protected readonly canOpenDocument = computed(() => this.auth.canRead('operations'));
  protected readonly canOpenSigner = computed(() => this.auth.canRead('clients'));
  protected readonly canOpenOrganization = computed(() => this.auth.canRead('clients'));
  protected readonly pickerScope = computed(() => {
    if (this.auth.canRead('clients')) return 'clients' as const;
    if (this.auth.canRead('commercial')) return 'commercial' as const;
    return null;
  });
  protected readonly filtered = computed(() => {
    const f = this.filters();
    return !!(f.from || f.to || f.organizationId || f.policy || f.search.trim());
  });
  protected readonly canExport = computed(
    () =>
      this.state() === 'ready' && !this.invalid() && !this.exporting() && !!this.report()?.total,
  );
  protected readonly pageCount = computed(() => {
    const data = this.report();
    return data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  });
  protected readonly rangeParams = computed(() => {
    const data = this.report();
    if (!data) return { from: 0, to: 0, total: 0 };
    const from = (data.page - 1) * data.limit + 1;
    return {
      from: this.count(from),
      to: this.count(from + data.items.length - 1),
      total: this.count(data.total),
    };
  });

  protected readonly policyOptions = computed(() => {
    const policies = this.report()?.policies;
    const options = [
      { id: ANY, label: this.text('cns.policyAll') },
      ...(policies?.catalog ?? []).map((option) => ({
        id: option.value,
        label: this.text('cns.policyOption', {
          title: option.title ?? option.code,
          version: option.version,
          count: this.count(option.count),
        }),
      })),
      ...(policies?.legacy
        ? [
            {
              id: LEGACY_POLICY,
              label: this.text('cns.legacyOption', { count: this.count(policies.legacy) }),
            },
          ]
        : []),
    ];
    const current = this.filters().policy;
    if (current && !options.some((option) => option.id === current))
      options.push({
        id: current,
        label: current === LEGACY_POLICY ? this.text('cns.legacy') : current,
      });
    return options;
  });

  protected readonly cells = computed<StatCell[]>(() => {
    const data = this.report();
    if (!data) return [];
    return [
      {
        key: 'total',
        label: this.text('cns.stat.total'),
        value: this.count(data.total),
        note: this.text('cns.stat.totalNote'),
      },
      { key: 'signers', label: this.text('cns.stat.signers'), value: this.count(data.signers) },
      {
        key: 'organizations',
        label: this.text('cns.stat.organizations'),
        value: this.count(data.organizations),
      },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
    void this.load();
  }

  protected apply(change: Partial<ConsentFilters>): void {
    const previous = this.filters();
    const next = { ...previous, ...change, page: change.page ?? 1 };
    this.filters.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: consentQueryParamsOf(next),
      replaceUrl: true,
    });
    if (
      next.from !== previous.from ||
      next.to !== previous.to ||
      next.organizationId !== previous.organizationId ||
      next.policy !== previous.policy ||
      next.search.trim() !== previous.search.trim() ||
      next.page !== previous.page
    )
      void this.load();
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, MAX_SEARCH);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.apply({ search: value }), SEARCH_DELAY);
  }

  protected count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  protected stamp(date: string): string {
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: this.timeZone,
    }).format(new Date(date));
  }

  protected policyTitle(item: ConsentItem): string {
    if (item.source === 'legacy') return this.text('cns.legacy');
    return item.policy.title ?? item.policy.code ?? this.text('cns.unknownPolicy');
  }

  protected policyVersion(item: ConsentItem): string {
    if (item.source === 'legacy')
      return item.policy.legacyVersion
        ? this.text('cns.legacyVersion', { version: item.policy.legacyVersion })
        : this.text('cns.noVersion');
    const code = item.policy.title && item.policy.code ? `${item.policy.code} · ` : '';
    return item.policy.version === undefined
      ? this.text('cns.noVersion')
      : `${code}${this.text('cns.version', { version: item.policy.version })}`;
  }

  protected async load(): Promise<void> {
    if (this.invalid()) return;
    const current = this.latest.start();
    this.state.set('loading');
    try {
      const report = await firstValueFrom(
        this.api.report(this.request(), this.filters().page, PAGE_SIZE),
      );
      if (!current()) return;
      this.report.set(report);
      this.state.set('ready');
    } catch {
      if (!current()) return;
      this.report.set(null);
      this.state.set('failed');
    }
  }

  protected async downloadCsv(): Promise<void> {
    if (!this.canExport()) return;
    this.exporting.set(true);
    try {
      const file = await firstValueFrom(this.api.csv(this.request()));
      saveBlob(new Blob(['﻿', file.blob], { type: 'text/csv;charset=utf-8' }), file.filename);
    } catch {
      this.notify.error(this.text('cns.error.csv'));
    } finally {
      this.exporting.set(false);
    }
  }

  private request() {
    return consentRequestOf(this.filters(), this.timeZone);
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
