import { formatNumber } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
import { ResellerDocumentsApi } from '../data/reseller-documents.api';
import type {
  SignedDocumentsFilters,
  SignedDocumentsReport,
} from '../data/reseller-documents.models';
import {
  signedFiltersOf,
  signedQueryParamsOf,
  signedRangeInvalid,
  signedRequestOf,
} from '../data/reseller-documents-view';

const PAGE_SIZE = 20;

const ORGANIZATION_COLUMNS: readonly DataColumn[] = [
  { key: 'organization', labelKey: 'rdoc.col.organization', width: 'minmax(0, 1fr)' },
  { key: 'count', labelKey: 'rdoc.col.signedDocuments', width: '180px', align: 'end' },
];

const DOCUMENT_COLUMNS: readonly DataColumn[] = [
  { key: 'document', labelKey: 'rdoc.col.document', width: 'minmax(0, 1.5fr)' },
  { key: 'code', labelKey: 'rdoc.col.code', width: '140px' },
  { key: 'organization', labelKey: 'rdoc.col.organization', width: 'minmax(0, 1.2fr)' },
  { key: 'signers', labelKey: 'rdoc.col.signers', width: '120px', align: 'end' },
  { key: 'signedAt', labelKey: 'rdoc.col.signedAt', width: '170px' },
];

type LoadState = 'idle' | 'loading' | 'ready' | 'failed' | 'notFound';

@Component({
  selector: 'dba-reseller-documents',
  imports: [
    TranslatePipe,
    RouterLink,
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
          <h1 class="dba-page">
            {{ report()?.reseller?.businessName ?? ('nav.resellerDocuments' | translate) }}
          </h1>
          <span class="dba-meta">{{ 'rdoc.lead' | translate }}</span>
        </div>
        <div class="rd__exports">
          <button
            dba-button
            variant="secondary"
            [disabled]="!canExport()"
            (click)="download('csv')"
          >
            <db-icon name="download" [size]="15" />
            {{ 'rdoc.csv' | translate }}
          </button>
          <button
            dba-button
            variant="secondary"
            [disabled]="!canExport()"
            (click)="download('pdf')"
          >
            <db-icon name="download" [size]="15" />
            {{ 'rdoc.pdf' | translate }}
          </button>
        </div>
      </header>

      <div class="bl__tools">
        <dba-org-picker
          scope="resellers"
          anyKey="rdoc.pickReseller"
          labelKey="rdoc.resellerLabel"
          [value]="filters().resellerId"
          (picked)="apply({ resellerId: $event })"
        />
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
      </div>

      @if (!filters().resellerId) {
        <div class="bl__panel">
          <dba-empty-state titleKey="rdoc.chooseTitle" leadKey="rdoc.chooseLead" />
        </div>
      } @else if (invalid()) {
        <p class="dba-meta rd__note">{{ 'vcon.rangeInvalid' | translate }}</p>
      } @else if (state() === 'loading') {
        <db-section-loader [label]="'rdoc.loading' | translate" />
      } @else if (state() === 'notFound') {
        <div class="bl__panel">
          <dba-empty-state titleKey="rdoc.notFoundTitle" leadKey="rdoc.notFoundLead" />
        </div>
      } @else if (state() === 'failed') {
        <div class="bl__panel">
          <dba-empty-state titleKey="rdoc.errorTitle" leadKey="rdoc.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (report(); as data) {
        <db-stat-band [cells]="cells()" [label]="'rdoc.statsLabel' | translate" />
        @if (data.total > data.exportCap) {
          <p class="dba-meta rd__note">
            {{ 'rdoc.exportCapped' | translate: { cap: count(data.exportCap) } }}
          </p>
        }

        <h2 class="dba-section rd__title">{{ 'rdoc.byOrganization' | translate }}</h2>
        @if (data.byOrganization.length === 0) {
          <div class="bl__panel">
            <dba-empty-state titleKey="rdoc.noPortfolioTitle" leadKey="rdoc.noPortfolioLead" />
          </div>
        } @else {
          <dba-data-table
            [columns]="organizationColumns"
            [label]="'rdoc.byOrganization' | translate"
            [dense]="density.compact()"
            minWidth="420px"
          >
            @for (row of data.byOrganization; track row.organizationId) {
              <div class="dba-tr">
                <span class="dba-td cell">
                  @if (canOpenOrganization()) {
                    <a
                      class="dba-ref cell__label"
                      [routerLink]="[organizationsPath, row.organizationId]"
                      >{{ row.businessName }}</a
                    >
                  } @else {
                    <span class="cell__label">{{ row.businessName }}</span>
                  }
                </span>
                <span class="dba-td dba-td--end rd__num" [class.rd__zero]="row.count === 0">{{
                  count(row.count)
                }}</span>
              </div>
            }
          </dba-data-table>
        }

        <h2 class="dba-section rd__title">{{ 'rdoc.documents' | translate }}</h2>
        @if (data.items.length === 0) {
          <div class="bl__panel">
            <dba-empty-state titleKey="rdoc.emptyTitle" leadKey="rdoc.emptyLead" />
          </div>
        } @else {
          <dba-data-table
            [columns]="documentColumns"
            [label]="'rdoc.documents' | translate"
            [dense]="density.compact()"
            minWidth="900px"
          >
            @for (item of data.items; track item.documentId) {
              <div class="dba-tr">
                <span class="dba-td cell">
                  @if (canOpenDocument()) {
                    <a
                      class="dba-ref cell__label"
                      [routerLink]="[documentsPath, item.documentId]"
                      >{{ item.name }}</a
                    >
                  } @else {
                    <span class="cell__label">{{ item.name }}</span>
                  }
                </span>
                <span class="dba-td cell">
                  <span class="cell__muted dba-mono">{{
                    item.code ?? ('rdoc.noCode' | translate)
                  }}</span>
                </span>
                <span class="dba-td cell">
                  @if (canOpenOrganization()) {
                    <a
                      class="dba-ref cell__text"
                      [routerLink]="[organizationsPath, item.organization.id]"
                      >{{ item.organization.name }}</a
                    >
                  } @else {
                    <span class="cell__text">{{ item.organization.name }}</span>
                  }
                </span>
                <span class="dba-td dba-td--end rd__num"
                  >{{ item.signed }} / {{ item.signers }}</span
                >
                <span class="dba-td cell">
                  <span class="cell__text dba-mono">{{ stamp(item.signedAt) }}</span>
                </span>
              </div>
            }
          </dba-data-table>

          @if (pageCount() > 1) {
            <nav class="rd__pager" [attr.aria-label]="'common.pagination' | translate">
              <span class="dba-meta">{{ 'rdoc.range' | translate: rangeParams() }}</span>
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
    .rd__exports {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .rd__note {
      margin: 0;
    }

    .rd__title {
      margin: 8px 0 0;
    }

    .rd__num {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-id);
      color: var(--dba-ink);
      white-space: nowrap;
    }

    .rd__zero {
      color: var(--dba-text-muted);
    }

    .rd__pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class ResellerDocumentsComponent {
  private readonly api = inject(ResellerDocumentsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly timeZone = browserTimeZone();

  protected readonly density = inject(DensityService);
  protected readonly organizationColumns = ORGANIZATION_COLUMNS;
  protected readonly documentColumns = DOCUMENT_COLUMNS;
  protected readonly documentsPath = sectionPath('documents');
  protected readonly organizationsPath = sectionPath('organizations');
  protected readonly filters = signal<SignedDocumentsFilters>(
    signedFiltersOf(this.route.snapshot.queryParams),
  );
  protected readonly state = signal<LoadState>('idle');
  protected readonly report = signal<SignedDocumentsReport | null>(null);
  protected readonly exporting = signal(false);

  protected readonly invalid = computed(() => signedRangeInvalid(this.filters()));
  protected readonly canOpenDocument = computed(() => this.auth.canRead('operations'));
  protected readonly canOpenOrganization = computed(() => this.auth.canRead('clients'));
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

  protected readonly cells = computed<StatCell[]>(() => {
    const data = this.report();
    if (!data) return [];
    return [
      {
        key: 'total',
        label: this.text('rdoc.stat.total'),
        value: this.count(data.total),
        note: this.text('rdoc.stat.totalNote'),
      },
      {
        key: 'organizations',
        label: this.text('rdoc.stat.organizations'),
        value: this.count(data.organizations),
      },
      {
        key: 'withSigned',
        label: this.text('rdoc.stat.withSigned'),
        value: this.count(data.organizationsWithSigned),
      },
    ];
  });

  constructor() {
    void this.load();
  }

  protected apply(change: Partial<SignedDocumentsFilters>): void {
    const previous = this.filters();
    const next = { ...previous, ...change, page: change.page ?? 1 };
    this.filters.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: signedQueryParamsOf(next),
      replaceUrl: true,
    });
    if (
      next.resellerId !== previous.resellerId ||
      next.from !== previous.from ||
      next.to !== previous.to ||
      next.page !== previous.page
    )
      void this.load();
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

  protected async load(): Promise<void> {
    const current = this.latest.start();
    const resellerId = this.filters().resellerId;
    if (!resellerId || this.invalid()) {
      this.report.set(null);
      this.state.set('idle');
      return;
    }
    this.state.set('loading');
    try {
      const report = await firstValueFrom(
        this.api.report(resellerId, this.request(), this.filters().page, PAGE_SIZE),
      );
      if (!current()) return;
      this.report.set(report);
      this.state.set('ready');
    } catch (error) {
      if (!current()) return;
      this.report.set(null);
      const missing = error instanceof HttpErrorResponse && [400, 404].includes(error.status);
      this.state.set(missing ? 'notFound' : 'failed');
    }
  }

  protected async download(kind: 'csv' | 'pdf'): Promise<void> {
    const resellerId = this.filters().resellerId;
    if (!resellerId || !this.canExport()) return;
    this.exporting.set(true);
    try {
      const request = this.request();
      const file = await firstValueFrom(
        kind === 'csv' ? this.api.csv(resellerId, request) : this.api.pdf(resellerId, request),
      );
      saveBlob(
        kind === 'csv' ? new Blob(['﻿', file.blob], { type: 'text/csv;charset=utf-8' }) : file.blob,
        file.filename,
      );
    } catch {
      this.notify.error(this.text(`rdoc.error.${kind}`));
    } finally {
      this.exporting.set(false);
    }
  }

  private request() {
    return signedRequestOf(this.filters(), this.timeZone);
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
