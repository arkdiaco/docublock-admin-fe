import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { moneyExact } from '../../../shared/domain/money';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { saveBlob } from '../../../shared/http/save-blob';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { PricingFormComponent } from '../../organizations/components/validations/pricing-form.component';
import { ValidationsApi } from '../../organizations/data/validations.api';
import type { PricingBody, ValidationPricing } from '../../organizations/data/validations.models';
import { ConsumptionApi } from '../data/consumption.api';
import {
  COUNT_KEYS,
  type ConsumptionCounts,
  type ConsumptionFilters,
  type ConsumptionReport,
  type CountKey,
} from '../data/consumption.models';
import {
  consumptionCsv,
  csvFilename,
  filtersOf,
  organizationValueOf,
  queryParamsOf,
  rangeInvalid,
  rangeOf,
  resellerValueOf,
  type ConsumptionValue,
} from '../data/consumption-view';

const COUNT_COLUMNS: readonly DataColumn[] = [
  { key: 'ani', labelKey: 'vcon.col.ani', width: '84px', align: 'end' },
  { key: 'liveness', labelKey: 'vcon.col.liveness', width: '84px', align: 'end' },
  { key: 'macherFacial', labelKey: 'vcon.col.macherFacial', width: '84px', align: 'end' },
  { key: 'otros', labelKey: 'vcon.col.otros', width: '72px', align: 'end' },
  { key: 'total', labelKey: 'vcon.col.total', width: '84px', align: 'end' },
  { key: 'packages', labelKey: 'vcon.col.packages', width: '92px', align: 'end' },
  { key: 'value', labelKey: 'vcon.col.value', width: '150px', align: 'end' },
  { key: 'actions', width: '44px', align: 'end' },
];

const ORGANIZATION_COLUMNS: readonly DataColumn[] = [
  { key: 'organization', labelKey: 'vcon.col.organization', width: 'minmax(0, 1.4fr)' },
  { key: 'reseller', labelKey: 'vcon.col.reseller', width: 'minmax(0, 1fr)' },
  ...COUNT_COLUMNS,
];

const RESELLER_COLUMNS: readonly DataColumn[] = [
  { key: 'reseller', labelKey: 'vcon.col.reseller', width: 'minmax(0, 1.4fr)' },
  { key: 'organizations', labelKey: 'vcon.col.organizations', width: '120px', align: 'end' },
  ...COUNT_COLUMNS,
];

const VIEW_PILLS: FilterPill[] = [
  { key: 'organizaciones', labelKey: 'vcon.view.organizaciones' },
  { key: 'resellers', labelKey: 'vcon.view.resellers' },
];

const KNOWN_ERRORS = ['PAQUETE_VACIO'];

interface RowView {
  key: string;
  name: string;
  link: string[] | null;
  second: { text: string; link: string[] | null; muted: boolean };
  counts: ConsumptionCounts;
  packages: number;
  value: ConsumptionValue;
  target: { id: string; name: string } | null;
}

@Component({
  selector: 'dba-validation-consumption',
  imports: [
    TranslatePipe,
    RouterLink,
    ActionMenuComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    FilterPillsComponent,
    IconComponent,
    SectionLoaderComponent,
    StatBandComponent,
    PricingFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.validationConsumption' | translate }}</h1>
          <span class="dba-meta">{{ 'vcon.lead' | translate }}</span>
        </div>
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
        <db-filter-pills
          class="vc__pills"
          [pills]="viewPills"
          [active]="filters().view"
          [label]="'vcon.viewLabel' | translate"
          (activeChange)="apply({ view: $any($event) })"
        />
        <button
          dba-button
          variant="secondary"
          class="vc__csv"
          [disabled]="!report() || invalid()"
          (click)="downloadCsv()"
        >
          <db-icon name="download" [size]="15" />
          {{ 'vcon.csv' | translate }}
        </button>
      </div>

      @if (invalid()) {
        <p class="dba-meta vc__note">{{ 'vcon.rangeInvalid' | translate }}</p>
      } @else if (loading()) {
        <db-section-loader [label]="'vcon.loading' | translate" />
      } @else if (failed()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="vcon.errorTitle" leadKey="vcon.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else {
        <db-stat-band [cells]="cells()" [label]="'vcon.statsLabel' | translate" />
        <p class="dba-meta vc__note">{{ 'vcon.otherNote' | translate }}</p>

        @if (rows().length === 0) {
          <div class="bl__panel">
            <dba-empty-state titleKey="vcon.emptyTitle" leadKey="vcon.emptyLead" />
          </div>
        } @else {
          <dba-data-table
            [columns]="columns()"
            [label]="'vcon.tableLabel.' + filters().view | translate"
            [dense]="density.compact()"
            minWidth="1080px"
            [total]="rows().length"
            [from]="1"
            [to]="rows().length"
            [page]="1"
            [pageCount]="1"
          >
            @for (row of rows(); track row.key) {
              <div class="dba-tr">
                <span class="dba-td cell">
                  @if (row.link) {
                    <a class="dba-ref cell__label" [routerLink]="row.link">{{ row.name }}</a>
                  } @else {
                    <span class="cell__label">{{ row.name }}</span>
                  }
                </span>
                <span class="dba-td cell" [class.dba-td--end]="filters().view === 'resellers'">
                  @if (row.second.link) {
                    <a class="dba-ref cell__text" [routerLink]="row.second.link">{{
                      row.second.text
                    }}</a>
                  } @else {
                    <span
                      [class.cell__text]="!row.second.muted"
                      [class.cell__muted]="row.second.muted"
                      [class.vc__num]="filters().view === 'resellers'"
                      >{{ row.second.text }}</span
                    >
                  }
                </span>
                @for (key of countKeys; track key) {
                  <span class="dba-td dba-td--end vc__num">{{ count(row.counts[key]) }}</span>
                }
                <span class="dba-td dba-td--end vc__num vc__strong">{{
                  count(row.counts.total)
                }}</span>
                <span class="dba-td dba-td--end vc__num">{{ count(row.packages) }}</span>
                <span class="dba-td dba-td--end">
                  @switch (row.value.kind) {
                    @case ('amount') {
                      <span class="cell__amount">{{ amount(row.value) }}</span>
                    }
                    @case ('viaReseller') {
                      <span class="cell__muted">{{ 'vcon.viaReseller' | translate }}</span>
                    }
                    @case ('noPricing') {
                      <span class="cell__muted">{{ 'vcon.noPricing' | translate }}</span>
                    }
                    @default {
                      <span class="cell__muted">—</span>
                    }
                  }
                </span>
                <span class="dba-td dba-td--end">
                  @if (actionsOf(row).length > 0) {
                    <button
                      type="button"
                      class="vc__more"
                      [disabled]="working()"
                      [attr.aria-label]="'vcon.actionsFor' | translate: { name: row.name }"
                      (click)="openMenu(row, $event)"
                    >
                      <db-icon name="moreVertical" [size]="16" />
                    </button>
                  }
                </span>
              </div>
            }
          </dba-data-table>
        }
      }

      <dba-action-menu
        #menu
        label="vcon.actions"
        [heading]="menuRow()?.name ?? ''"
        [items]="menuItems()"
        (picked)="pick($event)"
      />

      @if (pricingOpen(); as open) {
        <dba-pricing-form
          [pricing]="open.pricing"
          [orgName]="open.name"
          [modeLabels]="pricingModeLabels()"
          [busy]="working()"
          (submitted)="savePricing($event)"
          (dismissed)="pricingOpen.set(null)"
        />
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .vc__pills {
      align-self: center;
      margin-left: 4px;
    }

    .vc__csv {
      margin-left: auto;
    }

    .vc__note {
      margin: 0;
    }

    .vc__num {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-id);
      color: var(--dba-ink);
      white-space: nowrap;
    }

    .vc__strong {
      font-weight: 600;
    }

    .vc__more {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: transparent;
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .vc__more:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .vc__more:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }

    @media (max-width: 720px) {
      .vc__csv {
        margin-left: 0;
      }
    }
  `,
})
export class ValidationConsumptionComponent {
  private readonly api = inject(ConsumptionApi);
  private readonly validations = inject(ValidationsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly organizationsPath = sectionPath('organizations');
  private readonly resellersPath = sectionPath('resellers');
  private readonly menu = viewChild.required<ActionMenuComponent>('menu');

  protected readonly density = inject(DensityService);
  protected readonly countKeys: readonly CountKey[] = COUNT_KEYS;
  protected readonly viewPills = VIEW_PILLS;
  protected readonly filters = signal<ConsumptionFilters>(
    filtersOf(this.route.snapshot.queryParams),
  );
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly working = signal(false);
  protected readonly report = signal<ConsumptionReport | null>(null);
  protected readonly menuRow = signal<RowView | null>(null);
  protected readonly pricingOpen = signal<{
    id: string;
    name: string;
    pricing: ValidationPricing;
  } | null>(null);

  protected readonly invalid = computed(() => rangeInvalid(this.filters()));
  protected readonly columns = computed(() =>
    this.filters().view === 'organizaciones' ? ORGANIZATION_COLUMNS : RESELLER_COLUMNS,
  );
  protected readonly menuItems = computed(() => {
    const row = this.menuRow();
    return row ? this.actionsOf(row) : [];
  });
  protected readonly pricingModeLabels = computed(() => ({
    package: this.text('val.pricing.modes.package'),
    per_validation: this.text('val.pricing.modes.per_validation'),
  }));

  protected readonly cells = computed<StatCell[]>(() => {
    const totals = this.report()?.totals;
    if (!totals) return [];
    return [
      {
        key: 'total',
        label: this.text('vcon.stat.total'),
        value: this.count(totals.total),
        note: this.text('vcon.stat.totalNote'),
      },
      ...COUNT_KEYS.map((key) => ({
        key,
        label: this.text(`vcon.type.${key}`),
        value: this.count(totals[key]),
        note: key === 'otros' ? this.text('vcon.stat.otherNote') : undefined,
      })),
    ];
  });

  protected readonly rows = computed<RowView[]>(() => {
    const report = this.report();
    if (!report) return [];
    const readClients = this.auth.canRead('clients');
    const readCommercial = this.auth.canRead('commercial');
    if (this.filters().view === 'organizaciones')
      return report.organizations.map((row) => ({
        key: row.organizationId,
        name: row.businessName,
        link: readClients ? [this.organizationsPath, row.organizationId] : null,
        second: row.reseller
          ? {
              text: row.reseller.businessName,
              link: readCommercial ? [this.resellersPath, row.reseller.id] : null,
              muted: false,
            }
          : { text: this.text('vcon.direct'), link: null, muted: true },
        counts: row.counts,
        packages: row.packages,
        value: organizationValueOf(row),
        target: row.billedViaReseller ? null : { id: row.organizationId, name: row.businessName },
      }));
    return report.resellers.map((row) => ({
      key: row.resellerId ?? 'sin-reseller',
      name: row.resellerId ? row.businessName : this.text('vcon.noReseller'),
      link: row.resellerId && readCommercial ? [this.resellersPath, row.resellerId] : null,
      second: { text: this.count(row.organizations), link: null, muted: false },
      counts: row.counts,
      packages: row.packages,
      value: resellerValueOf(row),
      target: row.resellerId ? { id: row.resellerId, name: row.businessName } : null,
    }));
  });

  constructor() {
    void this.load();
  }

  protected apply(change: Partial<ConsumptionFilters>): void {
    const previous = this.filters();
    const next = { ...previous, ...change };
    this.filters.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParamsOf(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (next.from !== previous.from || next.to !== previous.to) void this.load();
  }

  protected count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  protected amount(value: ConsumptionValue): string {
    return value.kind === 'amount'
      ? moneyExact(value.billing.total, value.billing.currency, this.locale)
      : '';
  }

  protected actionsOf(row: RowView): ActionMenuItem[] {
    if (!row.target) return [];
    const items: ActionMenuItem[] = [];
    if (this.auth.canManage('clients'))
      items.push({ key: 'pricing', labelKey: 'vcon.action.pricing' });
    if (this.auth.canRead('clients') && row.value.kind === 'amount')
      items.push({ key: 'billing', labelKey: 'vcon.action.billing' });
    return items;
  }

  protected openMenu(row: RowView, event: Event): void {
    this.menuRow.set(row);
    this.menu().toggle(event);
  }

  protected async pick(key: string): Promise<void> {
    const target = this.menuRow()?.target;
    if (!target) return;
    if (key === 'pricing') await this.openPricing(target);
    if (key === 'billing') await this.downloadBilling(target.id);
  }

  protected async savePricing(body: PricingBody): Promise<void> {
    const open = this.pricingOpen();
    if (!open) return;
    this.working.set(true);
    try {
      await firstValueFrom(this.validations.setPricing(open.id, body));
      this.pricingOpen.set(null);
      this.notify.success(this.text('val.done.pricing'));
      void this.load();
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && KNOWN_ERRORS.includes(code);
      this.notify.error(this.text(known ? `val.error.${code}` : 'val.error.generic'));
    } finally {
      this.working.set(false);
    }
  }

  protected downloadCsv(): void {
    const report = this.report();
    if (!report || this.invalid()) return;
    const csv = consumptionCsv(this.filters().view, report, {
      organization: this.text('vcon.col.organization'),
      reseller: this.text('vcon.col.reseller'),
      organizations: this.text('vcon.col.organizations'),
      types: {
        ani: this.text('vcon.type.ani'),
        liveness: this.text('vcon.type.liveness'),
        macherFacial: this.text('vcon.type.macherFacial'),
        otros: this.text('vcon.type.otros'),
      },
      total: this.text('vcon.col.total'),
      packages: this.text('vcon.col.packages'),
      value: this.text('vcon.col.value'),
      currency: this.text('vcon.col.currency'),
      viaReseller: this.text('vcon.viaReseller'),
      noPricing: this.text('vcon.noPricing'),
      noReseller: this.text('vcon.noReseller'),
    });
    saveBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), csvFilename(this.filters()));
  }

  protected async load(): Promise<void> {
    if (this.invalid()) return;
    const current = this.latest.start();
    this.loading.set(true);
    this.failed.set(false);
    try {
      const report = await firstValueFrom(this.api.report(rangeOf(this.filters())));
      if (!current()) return;
      this.report.set(report);
    } catch {
      if (!current()) return;
      this.report.set(null);
      this.failed.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private async openPricing(target: { id: string; name: string }): Promise<void> {
    this.working.set(true);
    try {
      const pricing = await firstValueFrom(this.validations.pricing(target.id));
      this.pricingOpen.set({ ...target, pricing });
    } catch {
      this.notify.error(this.text('val.error.generic'));
    } finally {
      this.working.set(false);
    }
  }

  private async downloadBilling(id: string): Promise<void> {
    this.working.set(true);
    const range = rangeOf(this.filters());
    try {
      const file = await firstValueFrom(this.validations.billingPdf(id, range.from, range.to));
      saveBlob(file.blob, file.filename);
    } catch {
      this.notify.error(this.text('val.error.billing'));
    } finally {
      this.working.set(false);
    }
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
