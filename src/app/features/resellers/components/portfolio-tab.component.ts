import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { RESELLER_ERRORS, ResellersApi } from '../data/resellers.api';
import type { PortfolioOrg, Reseller } from '../data/resellers.models';
import { OrgChoiceFormComponent } from './org-choice-form.component';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const VIEWS: readonly FilterPill[] = [
  { key: 'all', labelKey: 'rsl.port.view.all' },
  { key: 'active', labelKey: 'rsl.port.view.active' },
  { key: 'suspended', labelKey: 'rsl.port.view.suspended' },
];

const BASE_COLUMNS: readonly DataColumn[] = [
  { key: 'org', labelKey: 'rsl.port.col.org', width: 'minmax(0, 1.5fr)' },
  { key: 'plan', labelKey: 'rsl.port.col.plan', width: 'minmax(0, 1fr)' },
  { key: 'documents', labelKey: 'rsl.port.col.documents', width: '180px' },
  { key: 'users', labelKey: 'rsl.port.col.users', width: '150px', align: 'end' },
  { key: 'state', labelKey: 'rsl.port.col.state', width: '110px' },
];

@Component({
  selector: 'dba-portfolio-tab',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    UsageMeterComponent,
    OrgChoiceFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'rsl.port.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <db-filter-pills
          [pills]="views"
          [active]="view()"
          [label]="'rsl.port.viewsLabel' | translate"
          (activeChange)="pickView($event)"
        />
        @if (canManage()) {
          <button dba-button (click)="formOpen.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'rsl.port.assign' | translate }}
          </button>
        }
      </div>

      @if (loading()) {
        <db-section-loader [label]="'rsl.port.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="rsl.port.errorTitle" leadKey="rsl.port.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="rsl.port.emptyTitle" leadKey="rsl.port.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns()"
          [label]="'rsl.tab.portfolio' | translate"
          [dense]="density.compact()"
          minWidth="900px"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of items(); track row.id) {
            <div class="dba-tr">
              <span class="dba-td cell">
                @if (canOpenOrg()) {
                  <a class="cell__label port__link" [routerLink]="[orgsPath, row.id]">{{
                    row.businessName
                  }}</a>
                } @else {
                  <span class="cell__label">{{ row.businessName }}</span>
                }
                <span class="cell__meta dba-mono">{{ row.tributaryNumber }}</span>
              </span>
              <span class="dba-td cell">
                @if (row.plan; as plan) {
                  <span class="cell__label">{{ plan.name || plan.code || '—' }}</span>
                  <span class="cell__meta">{{
                    plan.periodEnd
                      ? ('rsl.port.until' | translate: { date: day(plan.periodEnd) })
                      : ('rsl.port.noEnd' | translate)
                  }}</span>
                } @else {
                  <span class="cell__muted">{{ 'rsl.port.noPlan' | translate }}</span>
                }
              </span>
              <span class="dba-td">
                @if (row.plan; as plan) {
                  <dba-usage-meter [used]="plan.documents.used" [limit]="plan.documents.limit" />
                } @else {
                  —
                }
              </span>
              <span class="dba-td dba-td--end dba-td--mono"
                >{{ row.users.active30d }} / {{ row.users.total }}</span
              >
              <span class="dba-td">
                <dba-org-state
                  [state]="row.active ? 'active' : 'suspended'"
                  [labelKey]="row.active ? 'rsl.state.active' : 'rsl.state.suspended'"
                  variant="inline"
                />
              </span>
              @if (canManage()) {
                <span class="dba-td dba-td--end">
                  <button
                    type="button"
                    class="port__remove"
                    [disabled]="!!pending.key()"
                    [attr.aria-label]="
                      'rsl.port.removeAria' | translate: { name: row.businessName }
                    "
                    (click)="remove(row)"
                  >
                    {{ 'rsl.port.remove' | translate }}
                  </button>
                </span>
              }
            </div>
          }
        </dba-data-table>
      }
    </section>

    @if (formOpen()) {
      <dba-org-choice-form
        mode="assign"
        [resellerId]="reseller().id"
        [subtitle]="reseller().businessName"
        [busy]="pending.key() === 'assign'"
        (submitted)="assign($event)"
        (dismissed)="formOpen.set(false)"
      />
    }
  `,
  styleUrls: ['../../../shared/ui/list-page.scss', './portfolio-tab.component.scss'],
})
export class PortfolioTabComponent {
  readonly reseller = input.required<Reseller>();
  readonly changed = output<void>();

  private readonly api = inject(ResellersApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly views = VIEWS;
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));
  protected readonly columns = computed<readonly DataColumn[]>(() =>
    this.canManage()
      ? [...BASE_COLUMNS, { key: 'actions', width: '90px', align: 'end' }]
      : BASE_COLUMNS,
  );
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly searchDraft = signal('');
  protected readonly view = signal('all');
  protected readonly items = signal<PortfolioOrg[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));
  private readonly resellerId = computed(() => this.reseller().id);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    effect(() => {
      this.resellerId();
      untracked(() => void this.reload());
    });
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      this.restart();
    }, DEBOUNCE_MS);
  }

  protected pickView(view: string): void {
    this.view.set(view);
    this.restart();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected day(value: string): string {
    return formatDate(value, 'd/MM/y', this.locale);
  }

  protected async assign(organizationId: string): Promise<void> {
    await this.pending.run('assign', async () => {
      try {
        await firstValueFrom(this.api.assign(organizationId, this.resellerId()));
        this.formOpen.set(false);
        this.notify.success(this.label('rsl.form.assign.done'));
        this.changed.emit();
        await this.reload();
      } catch (error) {
        this.fail(error);
      }
    });
  }

  protected async remove(row: PortfolioOrg): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'rsl.port.removeDialog.title',
      message: 'rsl.port.removeDialog.message',
      params: { name: row.businessName, reseller: this.reseller().businessName },
      confirmLabel: 'rsl.port.removeDialog.confirm',
    });
    if (!confirmed) return;
    await this.pending.run('remove', async () => {
      try {
        await firstValueFrom(this.api.assign(row.id, null));
        this.notify.success(this.label('rsl.port.removeDialog.done', { name: row.businessName }));
        this.changed.emit();
        await this.reload();
      } catch (error) {
        this.fail(error);
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const view = this.view();
      const page = await firstValueFrom(
        this.api.portfolio(this.resellerId(), {
          search: this.search || undefined,
          active: view === 'all' ? undefined : view === 'active',
          page: this.page(),
          limit: LIMIT,
        }),
      );
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private restart(): void {
    this.page.set(1);
    void this.reload();
  }

  private fail(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && RESELLER_ERRORS.includes(code);
    this.notify.error(this.label(known ? `rsl.error.${code}` : 'rsl.error.generic'));
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
