import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { CheckComponent } from '../../../shared/ui/check.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CommunicationsApi } from '../data/communications.api';
import type { RecipientKind, RecipientRow } from '../data/communications.models';
import { MAX_CONTACTS, toggled, withAll } from '../data/recipient-selection';

const LIMIT = 20;
const BULK_LIMIT = 100;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'check', width: '32px' },
  { key: 'name', labelKey: 'comm.col.name', width: 'minmax(0, 1.2fr)' },
  { key: 'phone', labelKey: 'comm.col.phone', width: 'minmax(0, 1fr)' },
  { key: 'email', labelKey: 'comm.col.email', width: 'minmax(0, 1.2fr)' },
];

@Component({
  selector: 'dba-recipient-picker',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CheckComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    OrgPickerComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bl__tools">
      <label class="bl__search">
        <db-icon name="search" [size]="15" />
        <input
          type="search"
          class="bl__input"
          autocomplete="off"
          [placeholder]="'comm.search' | translate"
          [value]="searchDraft()"
          (input)="onSearch($event)"
        />
      </label>
      @if (orgScope(); as scope) {
        <dba-org-picker [scope]="scope" [value]="organizationId()" (picked)="pickOrganization($event)" />
      }
      <button dba-button variant="secondary" [disabled]="items().length === 0" (click)="markPage()">
        {{ 'comm.markPage' | translate }}
      </button>
      <button
        dba-button
        variant="secondary"
        [busy]="pending.key() === 'all'"
        [disabled]="total() === 0"
        (click)="markAll()"
      >
        {{ 'comm.markAll' | translate: { total: total() } }}
      </button>
      @if (selected().size > 0) {
        <button dba-button variant="secondary" (click)="selected.set(empty)">
          {{ 'comm.clear' | translate: { total: selected().size } }}
        </button>
      }
    </div>

    @if (loading()) {
      <db-section-loader [label]="'comm.loading' | translate" />
    } @else if (error()) {
      <div class="bl__panel">
        <dba-empty-state titleKey="comm.errorTitle" leadKey="comm.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bl__panel">
        <dba-empty-state titleKey="comm.emptyTitle" leadKey="comm.emptyLead" />
      </div>
    } @else {
      <dba-data-table
        [columns]="columns"
        [label]="'comm.recipients.title' | translate"
        [dense]="density.compact()"
        minWidth="620px"
        [total]="total()"
        [from]="rangeFrom()"
        [to]="rangeTo()"
        [page]="page()"
        [pageCount]="pageCount()"
        (pageChange)="goPage($event)"
      >
        @for (row of items(); track row.id) {
          <div class="dba-tr">
            <span class="dba-td">
              <dba-check
                [checked]="selected().has(row.id)"
                [label]="'comm.markOne' | translate: { name: row.name || row.id }"
                (toggled)="toggle(row.id)"
              />
            </span>
            <span class="dba-td cell"><span class="cell__label">{{ row.name || ('comm.noName' | translate) }}</span></span>
            <span class="dba-td cell">
              <span class="cell__muted dba-mono">{{ row.phone || '—' }}</span>
              @if (row.phoneIssue) {
                <span class="cell__meta">{{ 'comm.reason.' + row.phoneIssue | translate }}</span>
              }
            </span>
            <span class="dba-td cell"><span class="cell__muted">{{ row.email || '—' }}</span></span>
          </div>
        }
      </dba-data-table>
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
  `,
})
export class RecipientPickerComponent {
  readonly kind = input.required<RecipientKind>();
  readonly selected = model.required<ReadonlySet<string>>();

  private readonly api = inject(CommunicationsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly pending = new PendingAction();
  protected readonly empty: ReadonlySet<string> = new Set<string>();
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly searchDraft = signal('');
  protected readonly organizationId = signal<string | null>(null);
  protected readonly orgScope = computed(() => {
    if (this.kind() !== 'user') return null;
    if (this.auth.canRead('clients')) return 'clients' as const;
    if (this.auth.canRead('commercial')) return 'commercial' as const;
    return null;
  });
  protected readonly items = signal<RecipientRow[]>([]);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeFrom = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    effect(() => {
      this.kind();
      untracked(() => {
        this.page.set(1);
        void this.reload();
      });
    });
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

  protected pickOrganization(id: string | null): void {
    this.organizationId.set(id);
    this.page.set(1);
    void this.reload();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected toggle(id: string): void {
    this.selected.update((ids) => toggled(ids, id));
  }

  protected markPage(): void {
    this.selected.update((ids) => withAll(ids, this.items().map((row) => row.id)));
  }

  protected async markAll(): Promise<void> {
    await this.pending.run('all', async () => {
      try {
        const ids: string[] = [];
        for (let page = 1; (page - 1) * BULK_LIMIT < this.total() && ids.length < MAX_CONTACTS; page += 1) {
          const result = await firstValueFrom(
            this.api.recipients({
              kind: this.kind(),
              search: this.search || undefined,
              organizationId: this.organizationFilter(),
              page,
              limit: BULK_LIMIT,
            }),
          );
          ids.push(...result.items.map((row) => row.id));
        }
        this.selected.update((current) => withAll(current, ids));
        if (this.total() > MAX_CONTACTS) {
          this.notify.info(
            this.translate.instant('comm.markCapped', { max: MAX_CONTACTS.toLocaleString('es-CO') }),
          );
        }
      } catch {
        this.notify.error(this.translate.instant('comm.markFailed'));
      }
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(
        this.api.recipients({
          kind: this.kind(),
          search: this.search || undefined,
          organizationId: this.organizationFilter(),
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

  private organizationFilter(): string | undefined {
    return this.orgScope() ? (this.organizationId() ?? undefined) : undefined;
  }
}
