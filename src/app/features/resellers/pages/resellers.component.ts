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
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { OrgChoiceFormComponent } from '../components/org-choice-form.component';
import { RESELLER_ERRORS, ResellersApi } from '../data/resellers.api';
import type { Reseller } from '../data/resellers.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'org', labelKey: 'rsl.col.org', width: 'minmax(0, 1.6fr)' },
  { key: 'email', labelKey: 'rsl.col.email', width: 'minmax(0, 1.1fr)' },
  { key: 'portfolio', labelKey: 'rsl.col.portfolio', width: '100px', align: 'end' },
  { key: 'state', labelKey: 'rsl.col.state', width: '120px' },
  { key: 'created', labelKey: 'rsl.col.created', width: '100px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

@Component({
  selector: 'dba-resellers',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    OrgChoiceFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.resellers' | translate }}</h1>
          <span class="dba-meta">{{ 'rsl.count' | translate: { total: total() } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="formOpen.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'rsl.mark' | translate }}
          </button>
        }
      </header>

      <div class="bl__tools">
        <label class="bl__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [placeholder]="'rsl.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
      </div>

      @if (loading()) {
        <db-section-loader [label]="'rsl.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="rsl.errorTitle" leadKey="rsl.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="rsl.emptyTitle" leadKey="rsl.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.resellers' | translate"
          [dense]="density.compact()"
          minWidth="760px"
          [total]="total()"
          [from]="rangeFrom()"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of items(); track row.id) {
            <a class="dba-tr bl-row" [routerLink]="[path, row.id]">
              <span class="dba-td cell">
                <span class="cell__label">{{ row.businessName }}</span>
                <span class="cell__meta dba-mono">{{ row.tributaryNumber }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__muted">{{ row.email || '—' }}</span>
              </span>
              <span class="dba-td dba-td--end cell__amount">{{ row.portfolioCount }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="row.active ? 'active' : 'suspended'"
                  [labelKey]="row.active ? 'rsl.state.active' : 'rsl.state.suspended'"
                  variant="inline"
                />
              </span>
              <span class="dba-td dba-td--mono">{{ day(row.createdAt) }}</span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }
    </section>

    @if (formOpen()) {
      <dba-org-choice-form
        mode="mark"
        [busy]="pending.key() === 'mark'"
        (submitted)="mark($event)"
        (dismissed)="formOpen.set(false)"
      />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class ResellersComponent {
  private readonly api = inject(ResellersApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly path = sectionPath('resellers');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly searchDraft = signal('');
  protected readonly items = signal<Reseller[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    void this.reload();
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      this.page.set(1);
      void this.reload();
    }, DEBOUNCE_MS);
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected async mark(id: string): Promise<void> {
    await this.pending.run('mark', async () => {
      try {
        const reseller = await firstValueFrom(this.api.setFlag(id, true));
        this.formOpen.set(false);
        this.notify.success(this.label('rsl.form.mark.done', { name: reseller.businessName }));
        void this.router.navigate([this.path, reseller.id]);
      } catch (error) {
        const code = errorCodeOf(error);
        const known = code !== null && RESELLER_ERRORS.includes(code);
        this.notify.error(this.label(known ? `rsl.error.${code}` : 'rsl.error.generic'));
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(
        this.api.list({ search: this.search || undefined, page: this.page(), limit: LIMIT }),
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

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
