import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/ui/notification.service';
import { deviceLabel } from '../../../shared/domain/device-label';
import { ExportState } from '../../../shared/http/export-state';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { PagerComponent } from '../../../shared/ui/pager.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { AUDIT_FILTER_PARAM } from '../../../shared/domain/audit-link';
import { AuditApi } from '../data/audit.api';
import {
  actorHandle,
  parseAuditFilter,
  withToken,
  type AuditFilterProblem,
} from '../data/audit-filter';
import type { AuditActor, AuditFilters, AuditRow } from '../data/audit.models';

const LIMIT = 50;
const HOUR = 3_600_000;

type Period = '24h' | '7d' | '30d' | 'all';

const PERIOD_MS: Record<Exclude<Period, 'all'>, number> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
};

interface RowView extends Omit<AuditRow, 'before' | 'after'> {
  before: string | null;
  after: string | null;
  when: string;
  actor: string;
  object: string;
  objectFilter: { key: string; value: string } | null;
  device: string | null;
}

const pretty = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value, null, 2);

@Component({
  selector: 'dba-audit',
  imports: [
    TranslatePipe,
    ButtonComponent,
    IconComponent,
    FilterPillsComponent,
    PagerComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="audit">
      <header class="audit__head">
        <div class="audit__title">
          <h1 class="dba-page">{{ 'nav.audit' | translate }}</h1>
          <span class="dba-meta">{{ scopeKey() | translate: { total: total() } }}</span>
        </div>
        <div class="audit__tools">
          <label class="query" [class.query--bad]="problems().length > 0">
            <span class="query__prefix">{{ 'audit.filter' | translate }}</span>
            <input
              class="query__input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              [placeholder]="'audit.filterPlaceholder' | translate"
              [attr.aria-label]="'audit.filterAria' | translate"
              [value]="draft()"
              (input)="onDraft($event)"
              (keydown.enter)="apply()"
            />
            @if (draft()) {
              <button
                type="button"
                class="query__clear"
                [attr.aria-label]="'audit.clear' | translate"
                (click)="clear()"
              >
                <db-icon name="close" [size]="14" />
              </button>
            }
          </label>
          <button
            dba-button
            variant="secondary"
            [busy]="exporting.busy()"
            [disabled]="loading() || total() === 0"
            (click)="exportCsv()"
          >
            <db-icon name="download" [size]="15" />
            {{ 'audit.export' | translate }}
          </button>
        </div>
      </header>

      @if (problems().length > 0) {
        <p class="audit__problems" role="alert">
          @for (problem of problems(); track $index) {
            <span>{{ problemKey(problem) | translate: problem }}</span>
          }
        </p>
      } @else {
        <p class="dba-meta audit__hint">{{ 'audit.hint' | translate }}</p>
      }

      <db-filter-pills [pills]="periods" [active]="period()" (activeChange)="pickPeriod($event)" />

      @if (loading()) {
        <db-section-loader [label]="'audit.loading' | translate" />
      } @else {
        <div class="term" role="table" [attr.aria-label]="'nav.audit' | translate">
          <div class="term__scroll">
            <div class="term__row term__row--head" role="row">
              <span role="columnheader">{{ 'audit.col.when' | translate }}</span>
              <span role="columnheader">{{ 'audit.col.actor' | translate }}</span>
              <span role="columnheader">{{ 'audit.col.object' | translate }}</span>
              <span role="columnheader">{{ 'audit.col.action' | translate }}</span>
              <span role="columnheader">{{ 'audit.col.origin' | translate }}</span>
            </div>

            @if (error()) {
              <div class="term__empty">
                <span>{{ 'audit.errorTitle' | translate }}</span>
                <button type="button" class="term__retry" (click)="reload()">
                  {{ 'common.retry' | translate }}
                </button>
              </div>
            } @else if (rows().length === 0) {
              <p class="term__empty">{{ 'audit.empty' | translate }}</p>
            }

            @for (row of rows(); track row.id) {
              <div
                class="term__row"
                role="row"
                tabindex="0"
                [class.term__row--on]="open() === row.id"
                [attr.aria-expanded]="open() === row.id"
                (click)="toggle(row.id)"
                (keydown.enter)="toggle(row.id)"
              >
                <span class="term__time" role="cell">{{ row.when }}</span>
                <span role="cell">
                  <button
                    type="button"
                    class="term__actor"
                    [title]="row.admin.name || row.actor"
                    (click)="filterBy($event, 'actor', row.actor)"
                  >
                    <span class="term__dot" aria-hidden="true"></span>
                    {{ row.actor }}
                  </button>
                </span>
                <span role="cell">
                  @if (row.objectFilter; as by) {
                    <button
                      type="button"
                      class="term__object"
                      [title]="row.object"
                      (click)="filterBy($event, by.key, by.value)"
                    >
                      {{ row.object }}
                    </button>
                  } @else {
                    <span class="term__object term__object--plain" [title]="row.object">{{
                      row.object
                    }}</span>
                  }
                </span>
                <span class="term__action" role="cell">
                  {{ row.action }}
                  @if (row.reason) {
                    <span class="term__reason">· {{ row.reason }}</span>
                  }
                </span>
                <span class="term__time" role="cell">{{ row.ip || '—' }}</span>
              </div>

              @if (open() === row.id) {
                <dl class="term__detail" role="row">
                  <div>
                    <dt>{{ 'audit.detail.event' | translate }}</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>{{ 'audit.detail.actor' | translate }}</dt>
                    <dd>{{ row.admin.name || '—' }} · {{ row.admin.email || row.admin.id }}</dd>
                  </div>
                  @if (row.organization) {
                    <div>
                      <dt>{{ 'audit.detail.organization' | translate }}</dt>
                      <dd>{{ row.organization.name || row.organization.id }}</dd>
                    </div>
                  }
                  @if (row.reason) {
                    <div>
                      <dt>{{ 'audit.detail.reason' | translate }}</dt>
                      <dd>{{ row.reason }}</dd>
                    </div>
                  }
                  @if (row.device) {
                    <div>
                      <dt>{{ 'audit.detail.device' | translate }}</dt>
                      <dd [title]="row.userAgent || ''">{{ row.device }}</dd>
                    </div>
                  }
                  @if (row.before) {
                    <div class="term__payload">
                      <dt>{{ 'audit.detail.before' | translate }}</dt>
                      <dd>
                        <pre>{{ row.before }}</pre>
                      </dd>
                    </div>
                  }
                  @if (row.after) {
                    <div class="term__payload">
                      <dt>{{ 'audit.detail.after' | translate }}</dt>
                      <dd>
                        <pre>{{ row.after }}</pre>
                      </dd>
                    </div>
                  }
                </dl>
              }
            }
          </div>
        </div>

        @if (pageCount() > 1) {
          <div class="audit__foot">
            <span class="dba-meta">{{
              'tbl.range' | translate: { from: from(), to: to(), total: total() }
            }}</span>
            <db-pager [page]="page()" [pageCount]="pageCount()" (pageChange)="goPage($event)" />
          </div>
        }
      }
    </section>
  `,
  styles: `
    .audit {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .audit__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .audit__title {
      display: flex;
      align-items: baseline;
      gap: 14px;
      flex-wrap: wrap;
    }

    .audit__tools {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .query {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 340px;
      height: var(--dba-height-search);
      padding: 0 8px 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
    }

    .query:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .query--bad {
      border-color: var(--dba-state-suspended-dot);
    }

    .query__prefix {
      color: var(--dba-text-faint);
    }

    .query__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font: inherit;
      color: var(--dba-text);
    }

    .query__input:focus {
      outline: none;
    }

    .query__input::placeholder {
      color: var(--dba-text-faint);
    }

    .query__clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: transparent;
      color: var(--dba-text-faint);
      cursor: pointer;
    }

    .query__clear:hover {
      background: var(--dba-surface-chip);
      color: var(--dba-ink);
    }

    .audit__hint,
    .audit__problems {
      margin: 0;
    }

    .audit__problems {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-state-suspended-fg);
    }

    .term {
      border-radius: var(--dba-radius-panel);
      background: var(--dba-terminal-bg);
      overflow: hidden;
    }

    .term__scroll {
      overflow-x: auto;
    }

    .term__row {
      display: grid;
      grid-template-columns: 150px 170px 170px minmax(280px, 1fr) 120px;
      align-items: center;
      column-gap: 14px;
      min-width: 900px;
      min-height: 38px;
      padding: 0 18px;
      border-bottom: 1px solid var(--dba-terminal-line-soft);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-terminal-text);
      cursor: pointer;
    }

    .term__row:hover {
      background: var(--dba-terminal-hover);
    }

    .term__row:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-violet-500);
    }

    .term__row--on,
    .term__row--on:hover {
      background: var(--dba-terminal-selected);
    }

    .term__row--head,
    .term__row--head:hover {
      min-height: 0;
      padding-top: 12px;
      padding-bottom: 12px;
      border-bottom-color: var(--dba-terminal-line);
      background: transparent;
      font-size: var(--dba-text-th);
      letter-spacing: var(--dba-tracking-th);
      text-transform: uppercase;
      color: var(--dba-terminal-head);
      cursor: default;
    }

    .term__time {
      color: var(--dba-terminal-time);
      white-space: nowrap;
    }

    .term__actor,
    .term__object {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }

    .term__actor {
      color: var(--dba-terminal-strong);
    }

    .term__object {
      display: block;
      font-size: var(--dba-text-meta);
      font-weight: 600;
      color: var(--dba-terminal-link);
    }

    .term__actor:hover,
    .term__object:hover {
      text-decoration: underline;
    }

    .term__object--plain {
      color: var(--dba-terminal-time);
      cursor: inherit;
    }

    .term__object--plain:hover {
      text-decoration: none;
    }

    .term__dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: var(--dba-radius-pill);
      background: var(--dba-terminal-link);
    }

    .term__action {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .term__reason {
      color: var(--dba-terminal-time);
    }

    .term__detail {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px 24px;
      margin: 0;
      padding: 14px 18px 18px;
      border-bottom: 1px solid var(--dba-terminal-line);
      background: var(--dba-terminal-selected);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
    }

    .term__detail dt {
      margin-bottom: 4px;
      font-size: var(--dba-text-th);
      letter-spacing: var(--dba-tracking-th);
      text-transform: uppercase;
      color: var(--dba-terminal-head);
    }

    .term__detail dd {
      margin: 0;
      color: var(--dba-terminal-text);
      overflow-wrap: anywhere;
    }

    .term__payload {
      grid-column: 1 / -1;
    }

    .term__payload pre {
      max-height: 280px;
      margin: 0;
      overflow: auto;
      font: inherit;
      white-space: pre-wrap;
    }

    .term__empty {
      display: flex;
      align-items: center;
      gap: 14px;
      margin: 0;
      padding: 28px 18px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-terminal-time);
    }

    .term__retry {
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      color: var(--dba-terminal-link);
      text-decoration: underline;
      cursor: pointer;
    }

    .audit__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .audit__tools {
        flex-direction: column;
        align-items: stretch;
        width: 100%;
      }

      .query {
        width: 100%;
      }
    }
  `,
})
export class AuditComponent {
  private readonly api = inject(AuditApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);
  private readonly notify = inject(NotificationService);
  protected readonly exporting = new ExportState();
  private readonly latest = new LatestRequest();

  protected readonly periods: readonly FilterPill[] = [
    { key: '24h', labelKey: 'audit.period.24h' },
    { key: '7d', labelKey: 'audit.period.7d' },
    { key: '30d', labelKey: 'audit.period.30d' },
    { key: 'all', labelKey: 'audit.period.all' },
  ];

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<AuditRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly period = signal<Period>('24h');
  protected readonly draft = signal('');
  protected readonly problems = signal<AuditFilterProblem[]>([]);
  protected readonly open = signal<string | null>(null);
  private readonly applied = signal<AuditFilters>({});
  private actors: AuditActor[] = [];
  private facetsLoaded = false;

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly to = computed(() => Math.min(this.total(), this.page() * LIMIT));

  protected readonly scopeKey = computed(() => {
    if (this.applied().from || this.applied().to) return 'audit.scope.custom';
    return `audit.scope.${this.period()}`;
  });

  protected readonly rows = computed<RowView[]>(() => this.items().map((row) => this.toView(row)));

  constructor() {
    const initial = inject(ActivatedRoute).snapshot.queryParamMap.get(AUDIT_FILTER_PARAM);
    if (!initial) {
      void this.reload();
      return;
    }
    this.draft.set(initial);
    this.period.set('all');
    void this.apply();
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected pickPeriod(key: string): void {
    this.period.set(key as Period);
    this.page.set(1);
    void this.reload();
  }

  protected async apply(): Promise<void> {
    await this.ensureFacets();
    const { filters, problems } = parseAuditFilter(this.draft(), this.actors);
    this.problems.set(problems);
    if (problems.length > 0) return;
    this.applied.set(filters);
    this.page.set(1);
    await this.reload();
  }

  protected clear(): void {
    this.draft.set('');
    void this.apply();
  }

  protected filterBy(event: Event, key: string, value: string): void {
    event.stopPropagation();
    this.draft.set(withToken(this.draft(), key, value));
    void this.apply();
  }

  protected toggle(id: string): void {
    this.open.update((current) => (current === id ? null : id));
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected problemKey(problem: AuditFilterProblem): string {
    return `audit.problem.${problem.kind}`;
  }

  protected async exportCsv(): Promise<void> {
    const ok = await this.exporting.run(this.api.exportCsv(this.effectiveFilters()));
    if (!ok) this.notify.error(this.translate.instant('audit.exportError') as string);
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(this.items().length === 0);
    this.error.set(false);
    this.open.set(null);
    try {
      const result = await firstValueFrom(
        this.api.list({ ...this.effectiveFilters(), page: this.page(), limit: LIMIT }),
      );
      if (!current()) return;
      this.total.set(result.total);
      this.items.set(result.items);
    } catch {
      if (!current()) return;
      this.error.set(true);
      this.items.set([]);
      this.total.set(0);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private effectiveFilters(): AuditFilters {
    const applied = this.applied();
    if (applied.from || applied.to) return applied;
    const period = this.period();
    if (period === 'all') return applied;
    return { ...applied, from: new Date(Date.now() - PERIOD_MS[period]).toISOString() };
  }

  private async ensureFacets(): Promise<void> {
    if (this.facetsLoaded) return;
    try {
      this.actors = (await firstValueFrom(this.api.facets())).admins;
      this.facetsLoaded = true;
    } catch {
      this.actors = [];
    }
  }

  private toView(row: AuditRow): RowView {
    const organization = row.target.type === 'organization' || !!row.organization;
    const object =
      row.target.label ||
      (row.organization?.name && row.target.type === 'organization' ? row.organization.name : '') ||
      [row.target.type, row.target.id?.slice(-6)].filter(Boolean).join(' · ');
    const orgId =
      row.organization?.id ?? (row.target.type === 'organization' ? row.target.id : undefined);
    return {
      ...row,
      when: row.createdAt ? formatDate(row.createdAt, 'dd/MM HH:mm:ss', this.locale, 'UTC') : '—',
      actor: actorHandle(row.admin),
      object,
      objectFilter:
        organization && orgId
          ? { key: 'org', value: orgId }
          : row.target.id
            ? { key: 'id', value: row.target.id }
            : null,
      device: deviceLabel(row.userAgent),
      before: pretty(row.before),
      after: pretty(row.after),
    };
  }
}
