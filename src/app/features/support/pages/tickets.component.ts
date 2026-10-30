import { formatDate } from '@angular/common';
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
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { SupportNavComponent } from '../components/support-nav.component';
import { SupportApi } from '../data/support.api';
import {
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type SupportAgent,
  type TicketCategory,
  type TicketChannel,
  type TicketMetrics,
  type TicketPriority,
  type TicketStatus,
  type TicketSummary,
  type TicketsQuery,
} from '../data/support.models';
import {
  PRIORITY_FAMILY,
  SLA_FAMILY,
  STATUS_FAMILY,
  VIEW_QUERY,
  durationParts,
  isTicketView,
  slaStateOf,
  type SlaState,
  type TicketView,
} from '../data/ticket-view';

const LIMIT = 20;
const DEBOUNCE_MS = 350;
const ANY = '';

const COLUMNS: readonly DataColumn[] = [
  { key: 'number', labelKey: 'support.col.number', width: '150px' },
  { key: 'subject', labelKey: 'support.col.subject', width: 'minmax(0, 1.8fr)' },
  { key: 'org', labelKey: 'support.col.org', width: 'minmax(0, 1fr)' },
  { key: 'priority', labelKey: 'support.col.priority', width: '100px' },
  { key: 'status', labelKey: 'support.col.status', width: '150px' },
  { key: 'agent', labelKey: 'support.col.agent', width: 'minmax(0, 0.8fr)' },
  { key: 'sla', labelKey: 'support.col.sla', width: '110px' },
  { key: 'created', labelKey: 'support.col.created', width: '100px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

interface Counts {
  metrics: TicketMetrics | null;
  overdue: number;
  breached: number;
}

interface RowView extends TicketSummary {
  requester: string;
  slaState: SlaState;
  createdText: string;
}

interface Option {
  id: string;
  label: string;
}

@Component({
  selector: 'dba-tickets',
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Select,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    OrgPickerComponent,
    OrgStateComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    StatBandComponent,
    SupportNavComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tk">
      <dba-support-nav active="tickets" [meta]="'support.count' | translate: { total: total() }" />

      <db-stat-band
        [cells]="cells()"
        [interactive]="true"
        [active]="view()"
        [busy]="countsLoading()"
        [label]="'support.viewsLabel' | translate"
        (picked)="pickView($event)"
      />
      @if (averages()) {
        <p class="dba-meta tk__avg">{{ averages() }}</p>
      }

      <div class="tk__tools">
        <label class="tk__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="tk__input"
            autocomplete="off"
            [placeholder]="'support.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        @if (canPickOrg()) {
          <dba-org-picker [value]="organization()" (picked)="pickOrganization($event)" />
        }
        <p-select
          [options]="statusOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="status()"
          (ngModelChange)="setFilter(status, $event)"
          [ariaLabel]="'support.f.status' | translate"
          appendTo="body"
          styleClass="tk__select"
        />
        <p-select
          [options]="priorityOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="priority()"
          (ngModelChange)="setFilter(priority, $event)"
          [ariaLabel]="'support.f.priority' | translate"
          appendTo="body"
          styleClass="tk__select"
        />
        <p-select
          [options]="categoryOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="category()"
          (ngModelChange)="setFilter(category, $event)"
          [ariaLabel]="'support.f.category' | translate"
          appendTo="body"
          styleClass="tk__select"
        />
        <p-select
          [options]="channelOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="channel()"
          (ngModelChange)="setFilter(channel, $event)"
          [ariaLabel]="'support.f.channel' | translate"
          appendTo="body"
          styleClass="tk__select"
        />
        @if (view() !== 'sin-asignar') {
          <p-select
            [options]="agentOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="agent()"
            (ngModelChange)="setFilter(agent, $event)"
            [ariaLabel]="'support.f.agent' | translate"
            [filter]="agentOptions().length > 8"
            appendTo="body"
            styleClass="tk__select"
          />
        }
      </div>

      @if (loading()) {
        <db-section-loader [label]="'support.loading' | translate" />
      } @else if (error()) {
        <div class="tk__panel">
          <dba-empty-state titleKey="support.errorTitle" leadKey="support.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="tk__panel">
          <dba-empty-state
            titleKey="support.emptyTitle"
            [leadKey]="'support.emptyLead.' + view()"
          />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'support.section.tickets' | translate"
          [dense]="density.compact()"
          minWidth="1080px"
          [total]="total()"
          [from]="from()"
          [to]="to()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.id) {
            <a class="dba-tr tk-row" [routerLink]="[supportPath, row.id]">
              <span class="dba-td dba-td--mono">{{ row.ticketNumber }}</span>
              <span class="dba-td cell">
                <span class="cell__label">{{ row.subject }}</span>
                <span class="cell__meta"
                  >{{ row.requester }} ·
                  {{ 'support.channel.' + row.sourceChannel | translate }}</span
                >
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ row.organization?.name || '—' }}</span>
              </span>
              <span class="dba-td">
                <dba-org-state
                  [state]="priorityFamily[row.priority]"
                  [labelKey]="'support.priority.' + row.priority"
                  variant="inline"
                />
              </span>
              <span class="dba-td">
                <dba-org-state
                  [state]="statusFamily[row.status]"
                  [labelKey]="'support.status.' + row.status"
                  variant="inline"
                />
              </span>
              <span class="dba-td cell">
                @if (row.assignee) {
                  <span class="cell__text">{{ row.assignee.name || '—' }}</span>
                } @else {
                  <span class="cell__muted">{{ 'support.unassigned' | translate }}</span>
                }
              </span>
              <span class="dba-td">
                <dba-org-state
                  [state]="slaFamily[row.slaState]"
                  [labelKey]="'support.sla.' + row.slaState"
                  variant="inline"
                />
              </span>
              <span class="dba-td dba-td--mono">{{ row.createdText }}</span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }
    </section>
  `,
  styles: `
    .tk {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .tk__avg {
      margin: -6px 0 0;
    }

    .tk__tools {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .tk__search {
      display: flex;
      align-items: center;
      gap: 9px;
      flex: 2 1 260px;
      min-width: 0;
      height: var(--dba-height-search);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      color: var(--dba-text-muted);
    }

    .tk__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .tk__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .tk__input:focus {
      outline: none;
    }

    :host ::ng-deep .tk__select.p-select {
      flex: 1 1 170px;
      min-width: 0;
      max-width: 230px;
      height: var(--dba-height-control);
    }

    .tk__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .tk-row {
      color: inherit;
      text-decoration: none;
    }

    .cell {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .cell__label,
    .cell__text,
    .cell__muted,
    .cell__meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell__label,
    .cell__text,
    .cell__muted {
      font-size: var(--dba-text-cell);
    }

    .cell__label {
      font-weight: 500;
      color: var(--dba-ink);
    }

    .cell__muted {
      color: var(--dba-text-muted);
    }

    .cell__meta {
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    @media (max-width: 520px) {
      .tk__search,
      :host ::ng-deep .tk__select.p-select {
        flex-basis: 100%;
        max-width: 100%;
      }
    }
  `,
})
export class TicketsComponent {
  private readonly api = inject(SupportApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly countsRequest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly supportPath = sectionPath('support');
  protected readonly statusFamily = STATUS_FAMILY;
  protected readonly priorityFamily = PRIORITY_FAMILY;
  protected readonly slaFamily = SLA_FAMILY;
  protected readonly canPickOrg = computed(() => this.auth.canRead('clients'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly countsLoading = signal(true);
  protected readonly view = signal<TicketView>('todos');
  protected readonly page = signal(1);
  protected readonly searchDraft = signal('');
  protected readonly organization = signal<string | null>(null);
  protected readonly status = signal<string>(ANY);
  protected readonly priority = signal<string>(ANY);
  protected readonly category = signal<string>(ANY);
  protected readonly channel = signal<string>(ANY);
  protected readonly agent = signal<string>(ANY);
  protected readonly total = signal(0);
  private readonly items = signal<TicketSummary[]>([]);
  private readonly agents = signal<SupportAgent[]>([]);
  private readonly counts = signal<Counts>({ metrics: null, overdue: 0, breached: 0 });
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly cells = computed<StatCell[]>(() => {
    const { metrics, overdue, breached } = this.counts();
    const value = (n: number | undefined): string => (metrics ? String(n ?? 0) : '—');
    return [
      { key: 'todos', label: this.label('support.view.todos'), value: value(metrics?.total) },
      { key: 'abiertos', label: this.label('support.view.abiertos'), value: value(metrics?.open) },
      {
        key: 'sin-asignar',
        label: this.label('support.view.sin-asignar'),
        value: value(metrics?.unassignedOpen),
        tone: (metrics?.unassignedOpen ?? 0) > 0 ? 'warn' : 'plain',
      },
      {
        key: 'vencidos',
        label: this.label('support.view.vencidos'),
        value: value(overdue),
        tone: overdue > 0 ? 'danger' : 'plain',
      },
      {
        key: 'incumplidos',
        label: this.label('support.view.incumplidos'),
        value: value(breached),
        note: metrics
          ? this.label('support.breachedNote', {
              first: metrics.firstResponseBreached,
              resolution: metrics.resolutionBreached,
            })
          : undefined,
      },
    ];
  });

  protected readonly averages = computed(() => {
    const metrics = this.counts().metrics;
    if (!metrics) return '';
    const first = this.duration(metrics.avgFirstResponseMinutes);
    const resolution = this.duration(metrics.avgResolutionMinutes);
    return this.label('support.averages', { first, resolution });
  });

  protected readonly statusOptions = computed<Option[]>(() => [
    { id: ANY, label: this.label('support.f.anyStatus') },
    ...TICKET_STATUSES.map((s) => ({ id: s, label: this.label(`support.status.${s}`) })),
  ]);
  protected readonly priorityOptions = computed<Option[]>(() => [
    { id: ANY, label: this.label('support.f.anyPriority') },
    ...TICKET_PRIORITIES.map((p) => ({ id: p, label: this.label(`support.priority.${p}`) })),
  ]);
  protected readonly categoryOptions = computed<Option[]>(() => [
    { id: ANY, label: this.label('support.f.anyCategory') },
    ...TICKET_CATEGORIES.map((c) => ({ id: c, label: this.label(`support.category.${c}`) })),
  ]);
  protected readonly channelOptions = computed<Option[]>(() => [
    { id: ANY, label: this.label('support.f.anyChannel') },
    ...TICKET_CHANNELS.map((c) => ({ id: c, label: this.label(`support.channel.${c}`) })),
  ]);
  protected readonly agentOptions = computed<Option[]>(() => [
    { id: ANY, label: this.label('support.f.anyAgent') },
    ...this.agents().map((a) => ({ id: a.id, label: a.name })),
  ]);

  protected readonly rows = computed<RowView[]>(() => {
    const now = new Date();
    return this.items().map((ticket) => ({
      ...ticket,
      requester: ticket.requesterName || ticket.requesterEmail || '—',
      slaState: slaStateOf(ticket, now),
      createdText: ticket.createdAt ? formatDate(ticket.createdAt, 'd/MM/y', this.locale) : '—',
    }));
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly to = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    const params = this.route.snapshot.queryParamMap;
    const wanted = params.get('vista');
    if (isTicketView(wanted)) this.view.set(wanted);
    const org = params.get('organizacion');
    if (org && this.canPickOrg()) this.organization.set(org);
    void this.loadCounts();
    void this.loadAgents();
    void this.reload();
  }

  protected pickView(key: string): void {
    const view: TicketView = isTicketView(key) ? key : 'todos';
    if (view === this.view()) return;
    this.view.set(view);
    if (view === 'sin-asignar') this.agent.set(ANY);
    this.syncUrl();
    this.restart();
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      this.restart();
    }, DEBOUNCE_MS);
  }

  protected pickOrganization(id: string | null): void {
    this.organization.set(id);
    this.syncUrl();
    void this.loadCounts();
    this.restart();
  }

  protected setFilter(target: { set: (value: string) => void }, value: string): void {
    target.set(value);
    this.restart();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(this.api.list(this.query()));
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private async loadCounts(): Promise<void> {
    const current = this.countsRequest.start();
    this.countsLoading.set(true);
    const organizationId = this.organization() ?? undefined;
    const [metrics, overdue, breached] = await Promise.allSettled([
      firstValueFrom(this.api.metrics(organizationId)),
      firstValueFrom(this.api.list({ organizationId, overdue: true, page: 1, limit: 1 })),
      firstValueFrom(this.api.list({ organizationId, breached: true, page: 1, limit: 1 })),
    ]);
    if (!current()) return;
    this.counts.set({
      metrics: metrics.status === 'fulfilled' ? metrics.value : null,
      overdue: overdue.status === 'fulfilled' ? overdue.value.total : 0,
      breached: breached.status === 'fulfilled' ? breached.value.total : 0,
    });
    this.countsLoading.set(false);
  }

  private async loadAgents(): Promise<void> {
    try {
      this.agents.set(await firstValueFrom(this.api.agents()));
    } catch {
      this.agents.set([]);
    }
  }

  private restart(): void {
    this.page.set(1);
    void this.reload();
  }

  private query(): TicketsQuery {
    const pick = <T extends string>(value: string): T | undefined =>
      value === ANY ? undefined : (value as T);
    return {
      ...VIEW_QUERY[this.view()],
      search: this.search || undefined,
      organizationId: this.organization() ?? undefined,
      status: pick<TicketStatus>(this.status()),
      priority: pick<TicketPriority>(this.priority()),
      category: pick<TicketCategory>(this.category()),
      sourceChannel: pick<TicketChannel>(this.channel()),
      assignedToId: this.view() === 'sin-asignar' ? undefined : pick<string>(this.agent()),
      page: this.page(),
      limit: LIMIT,
    };
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        vista: this.view() === 'todos' ? null : this.view(),
        organizacion: this.organization(),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private duration(minutes: number | null): string {
    const parts = durationParts(minutes);
    if (parts.length === 0) return '—';
    return parts.map((part) => this.label(`support.dur.${part.unit}`, { n: part.n })).join(' ');
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
