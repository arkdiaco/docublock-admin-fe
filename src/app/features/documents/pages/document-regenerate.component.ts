import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { DocumentsApi } from '../data/documents.api';
import type {
  BulkRegenerationResult,
  BulkStatus,
  PlatformDocumentSummary,
} from '../data/documents.models';
import { BULK_LIMIT } from '../data/document-view';

const SEARCH_LIMIT = 25;
const MIN_SEARCH = 2;
const DEBOUNCE_MS = 350;

const RESULT_FAMILY: Record<BulkStatus, string> = {
  ok: 'active',
  skipped: 'closed',
  error: 'suspended',
};

@Component({
  selector: 'dba-document-regenerate',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rg">
      <header class="rg__head">
        <a class="rg__back" [routerLink]="docsPath">
          <db-icon name="chevronLeft" [size]="14" />
          {{ 'docs.bulk.back' | translate }}
        </a>
        <h1 class="dba-page">{{ 'docs.regenerateBulk' | translate }}</h1>
        <p class="dba-body rg__lead">{{ 'docs.bulk.lead' | translate }}</p>
      </header>

      @if (!canManage()) {
        <div class="rg__panel">
          <dba-empty-state titleKey="docs.bulk.noAccessTitle" leadKey="docs.bulk.noAccessLead" />
        </div>
      } @else {
        <div class="rg__cols">
          <section class="rg__card">
            <label class="rg__search">
              <db-icon name="search" [size]="15" />
              <input
                type="search"
                class="rg__input"
                autocomplete="off"
                [placeholder]="'docs.bulk.search' | translate"
                [value]="draft()"
                (input)="onSearch($event)"
              />
            </label>
            @if (draft().trim().length < minSearch) {
              <p class="dba-meta">{{ 'docs.bulk.searchHint' | translate }}</p>
            } @else if (searching()) {
              <db-section-loader [label]="'docs.loading' | translate" />
            } @else if (found().length === 0) {
              <p class="dba-meta">{{ 'docs.bulk.noResults' | translate }}</p>
            } @else {
              <ul class="rg__list">
                @for (doc of found(); track doc.id) {
                  <li class="rg__item">
                    <span class="rg__doc">
                      <span class="rg__name">{{ doc.name }}</span>
                      <span class="rg__meta"
                        >{{ doc.code || '—' }} · {{ doc.organization.businessName || '—' }}</span
                      >
                    </span>
                    <dba-org-state
                      [state]="doc.anchored ? 'active' : 'warning'"
                      [labelKey]="doc.anchored ? 'docs.chain.registered' : 'docs.chain.pending'"
                      variant="inline"
                    />
                    @if (inBatch(doc.id)) {
                      <span class="dba-meta rg__added">{{ 'docs.bulk.added' | translate }}</span>
                    } @else {
                      <button
                        dba-button
                        variant="secondary"
                        iconOnly
                        [disabled]="full() || running()"
                        [attr.aria-label]="'docs.bulk.add' | translate"
                        [attr.title]="'docs.bulk.add' | translate"
                        (click)="add(doc)"
                      >
                        <db-icon name="plus" [size]="15" />
                      </button>
                    }
                  </li>
                }
              </ul>
            }
          </section>

          <aside class="rg__card">
            <header class="rg__batchHead">
              <h2 class="dba-panel">{{ 'docs.bulk.batch' | translate }}</h2>
              <code class="dba-meta">{{
                'docs.bulk.batchCount' | translate: { n: batch().length, max: limit }
              }}</code>
            </header>
            @if (full()) {
              <p class="dba-meta rg__warn">{{ 'docs.bulk.full' | translate: { max: limit } }}</p>
            }
            @if (batch().length === 0) {
              <p class="dba-meta">{{ 'docs.bulk.emptyBatch' | translate }}</p>
            } @else {
              <ul class="rg__list">
                @for (doc of batch(); track doc.id) {
                  <li class="rg__item">
                    <span class="rg__doc">
                      <span class="rg__name">{{ doc.name }}</span>
                      <span class="rg__meta">{{ doc.code || '—' }}</span>
                    </span>
                    <button
                      dba-button
                      variant="secondary"
                      iconOnly
                      [disabled]="running()"
                      [attr.aria-label]="'docs.bulk.remove' | translate"
                      [attr.title]="'docs.bulk.remove' | translate"
                      (click)="remove(doc.id)"
                    >
                      <db-icon name="close" [size]="15" />
                    </button>
                  </li>
                }
              </ul>
            }
            <div class="rg__run">
              <button
                dba-button
                variant="secondary"
                [disabled]="batch().length === 0 || running()"
                (click)="clear()"
              >
                {{ 'docs.bulk.clear' | translate }}
              </button>
              <button
                dba-button
                [busy]="running()"
                [disabled]="batch().length === 0"
                (click)="run()"
              >
                <db-icon name="rotate" [size]="15" />
                {{ 'docs.bulk.run' | translate: { n: batch().length } }}
              </button>
            </div>
          </aside>
        </div>

        @if (result(); as outcome) {
          <section class="rg__card">
            <header class="rg__batchHead">
              <h2 class="dba-panel">{{ 'docs.bulk.result' | translate }}</h2>
              <code class="dba-meta">{{
                'docs.bulk.summary'
                  | translate: { ok: outcome.ok, failed: outcome.failed, skipped: outcome.skipped }
              }}</code>
            </header>
            <ul class="rg__list">
              @for (row of outcome.results; track row.id) {
                <li class="rg__item">
                  <span class="rg__doc">
                    <a class="rg__name rg__link" [routerLink]="[docsPath, row.id]">{{
                      row.name || row.id
                    }}</a>
                    @if (row.message) {
                      <span class="rg__meta">{{ row.message }}</span>
                    }
                  </span>
                  <dba-org-state
                    [state]="family[row.status]"
                    [labelKey]="'docs.bulk.st.' + row.status"
                    variant="inline"
                  />
                </li>
              }
            </ul>
          </section>
        }
      }
    </section>
  `,
  styles: `
    .rg {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .rg__head {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .rg__back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      width: fit-content;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    .rg__lead {
      margin: 0;
      color: var(--dba-text-soft);
    }

    .rg__panel {
      display: flex;
      justify-content: center;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .rg__cols {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: var(--dba-grid-gap);
      align-items: start;
    }

    .rg__card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .rg__search {
      display: flex;
      align-items: center;
      gap: 9px;
      height: var(--dba-height-search);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      color: var(--dba-text-muted);
    }

    .rg__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .rg__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .rg__input:focus {
      outline: none;
    }

    .rg__list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .rg__item {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 6px 0;
      border-bottom: 1px solid var(--dba-border-row);
    }

    .rg__item:last-child {
      border-bottom: 0;
    }

    .rg__doc {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .rg__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
    }

    .rg__link {
      text-decoration: none;
    }

    .rg__link:hover {
      color: var(--dba-violet-700);
    }

    .rg__meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .rg__added {
      flex: none;
    }

    .rg__batchHead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .rg__batchHead h2 {
      margin: 0;
    }

    .rg__warn {
      color: var(--dba-state-warning-fg);
    }

    .rg__run {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }

    @media (max-width: 960px) {
      .rg__cols {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DocumentRegenerateComponent {
  private readonly api = inject(DocumentsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly docsPath = sectionPath('documents');
  protected readonly limit = BULK_LIMIT;
  protected readonly minSearch = MIN_SEARCH;
  protected readonly family = RESULT_FAMILY;
  protected readonly canManage = computed(() => this.auth.canManage('operations'));

  protected readonly draft = signal('');
  protected readonly searching = signal(false);
  protected readonly found = signal<PlatformDocumentSummary[]>([]);
  protected readonly batch = signal<PlatformDocumentSummary[]>([]);
  protected readonly running = signal(false);
  protected readonly result = signal<BulkRegenerationResult | null>(null);
  protected readonly full = computed(() => this.batch().length >= BULK_LIMIT);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  protected inBatch(id: string): boolean {
    return this.batch().some((doc) => doc.id === id);
  }

  protected onSearch(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    const term = this.draft().trim();
    if (term.length < MIN_SEARCH) {
      this.found.set([]);
      return;
    }
    this.timer = setTimeout(() => void this.search(term), DEBOUNCE_MS);
  }

  protected add(doc: PlatformDocumentSummary): void {
    if (this.full() || this.inBatch(doc.id)) return;
    this.batch.update((list) => [...list, doc]);
  }

  protected remove(id: string): void {
    this.batch.update((list) => list.filter((doc) => doc.id !== id));
  }

  protected clear(): void {
    this.batch.set([]);
  }

  protected async run(): Promise<void> {
    const ids = this.batch().map((doc) => doc.id);
    if (ids.length === 0) return;
    const confirmed = await this.dialogs.confirm({
      intent: 'warn',
      icon: 'rotate',
      title: 'docs.bulk.confirmTitle',
      message: 'docs.bulk.confirmMessage',
      params: { n: ids.length },
      confirmLabel: 'docs.bulk.confirm',
    });
    if (!confirmed) return;
    this.running.set(true);
    try {
      const outcome = await firstValueFrom(this.api.regenerateBulk(ids));
      this.result.set(outcome);
      const failed = new Set(
        outcome.results.filter((row) => row.status === 'error').map((row) => row.id),
      );
      this.batch.update((list) => list.filter((doc) => failed.has(doc.id)));
      const summary = this.translate.instant('docs.bulk.summary', {
        ok: outcome.ok,
        failed: outcome.failed,
        skipped: outcome.skipped,
      }) as string;
      if (outcome.failed > 0) this.notify.error(summary);
      else this.notify.success(summary);
    } catch {
      this.notify.error(this.translate.instant('docs.bulk.failed') as string);
    } finally {
      this.running.set(false);
    }
  }

  private async search(term: string): Promise<void> {
    const current = this.latest.start();
    this.searching.set(true);
    try {
      const page = await firstValueFrom(
        this.api.list({ search: term, progress: [3], limit: SEARCH_LIMIT, page: 1 }),
      );
      if (current()) this.found.set(page.items.filter((doc) => doc.status.state !== 4));
    } catch {
      if (current()) this.found.set([]);
    } finally {
      if (current()) this.searching.set(false);
    }
  }
}
