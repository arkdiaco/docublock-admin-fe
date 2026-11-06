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
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';
import { DocumentsApi } from '../data/documents.api';
import type {
  BlockchainFilter,
  DocumentIssues,
  DocumentState,
  DocumentsQuery,
  PlatformDocumentSummary,
  SignatureProgress,
} from '../data/documents.models';
import {
  ISSUE_VIEWS,
  chainStateOf,
  statusViewOf,
  type ChainState,
  type IssueView,
  type ListView,
  type StatusView,
} from '../data/document-view';
import { originKeyOf } from '../data/summary-view';

const LIMIT = 20;
const DEBOUNCE_MS = 350;
const ANY = '';
const PROGRESSES: readonly SignatureProgress[] = [1, 2, 3, 0];
const STATES: readonly DocumentState[] = [0, 1, 4, 5];
const CHAINS: readonly BlockchainFilter[] = ['registered', 'pending'];

const COLUMNS: readonly DataColumn[] = [
  { key: 'doc', labelKey: 'docs.col.doc', width: 'minmax(0, 1.6fr)' },
  { key: 'origin', labelKey: 'docs.col.origin', width: '100px' },
  { key: 'org', labelKey: 'docs.col.org', width: 'minmax(0, 1.1fr)' },
  { key: 'owner', labelKey: 'docs.col.owner', width: 'minmax(0, 0.9fr)' },
  { key: 'signers', labelKey: 'docs.col.signers', width: '80px' },
  { key: 'status', labelKey: 'docs.col.status', width: '130px' },
  { key: 'chain', labelKey: 'docs.col.chain', width: '110px' },
  { key: 'created', labelKey: 'docs.col.created', width: '100px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

const EMPTY_ISSUES: DocumentIssues = {
  unregisteredBlockchain: { total: 0, documents: [] },
  stuckCompleted: { total: 0, documents: [] },
};

interface RowView extends PlatformDocumentSummary {
  statusView: StatusView;
  chain: ChainState;
  originKey: string | null;
  ownerText: string;
  createdText: string;
}

const isIssueView = (value: string | null): value is IssueView =>
  ISSUE_VIEWS.includes(value as IssueView);

@Component({
  selector: 'dba-documents',
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    Select,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    UnderlineTabsComponent,
    OrgPickerComponent,
    OrgStateComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="docs">
      <header class="docs__head">
        <div class="docs__title">
          <h1 class="dba-page">{{ 'nav.documents' | translate }}</h1>
          <span class="dba-meta">{{ 'docs.count' | translate: { total: shownTotal() } }}</span>
        </div>
        @if (canManage()) {
          <a dba-button variant="secondary" [routerLink]="[docsPath, 'regenerar']">
            <db-icon name="rotate" [size]="15" />
            {{ 'docs.regenerateBulk' | translate }}
          </a>
        }
      </header>

      <db-underline-tabs [tabs]="tabs()" [active]="view()" (picked)="pickView($event)" />

      @if (view() === 'todos') {
        <div class="docs__tools">
          <label class="docs__search">
            <db-icon name="search" [size]="15" />
            <input
              type="search"
              class="docs__input"
              autocomplete="off"
              [placeholder]="'docs.searchPlaceholder' | translate"
              [value]="searchDraft()"
              (input)="onSearch($event)"
            />
          </label>
          @if (canPickOrg()) {
            <dba-org-picker [value]="organization()" (picked)="pickOrganization($event)" />
          }
          <p-select
            [options]="progressOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="progress()"
            (ngModelChange)="setFilter(progress, $event)"
            [ariaLabel]="'docs.f.progress' | translate"
            appendTo="body"
            styleClass="docs__select"
          />
          <p-select
            [options]="stateOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="state()"
            (ngModelChange)="setFilter(state, $event)"
            [ariaLabel]="'docs.f.state' | translate"
            appendTo="body"
            styleClass="docs__select"
          />
          <p-select
            [options]="chainOptions()"
            optionLabel="label"
            optionValue="id"
            [ngModel]="chain()"
            (ngModelChange)="setFilter(chain, $event)"
            [ariaLabel]="'docs.f.chain' | translate"
            appendTo="body"
            styleClass="docs__select"
          />
        </div>
      } @else {
        <p class="dba-body docs__lead">
          {{ 'docs.viewLead.' + view() | translate }}
          @if (issueTotal() > issueRows().length) {
            {{ 'docs.issueCap' | translate: { shown: issueRows().length, total: issueTotal() } }}
          }
        </p>
      }

      @if (loading()) {
        <db-section-loader [label]="'docs.loading' | translate" />
      } @else if (error()) {
        <div class="docs__panel">
          <dba-empty-state titleKey="docs.errorTitle" leadKey="docs.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="docs__panel">
          <dba-empty-state
            titleKey="docs.emptyTitle"
            [leadKey]="view() === 'todos' ? 'docs.emptyLead' : 'docs.emptyIssue.' + view()"
          />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.documents' | translate"
          [dense]="density.compact()"
          minWidth="1100px"
          [total]="shownTotal()"
          [from]="from()"
          [to]="to()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.id) {
            <a class="dba-tr doc-row" [routerLink]="[docsPath, row.id]">
              <span class="dba-td cell">
                <span class="cell__label">{{ row.name }}</span>
                <span class="cell__meta">{{ row.code || '—' }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{
                  row.originKey ? (row.originKey | translate) : row.kind || '—'
                }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__label">{{ row.organization.businessName || '—' }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__text">{{ row.ownerText }}</span>
              </span>
              <span class="dba-td dba-td--mono">{{ row.signedCount }}/{{ row.signerCount }}</span>
              <span class="dba-td">
                <dba-org-state
                  [state]="row.statusView.family"
                  [labelKey]="row.statusView.labelKey"
                  variant="inline"
                />
              </span>
              <span class="dba-td">
                @if (row.chain === 'none') {
                  <span class="dba-meta">—</span>
                } @else {
                  <dba-org-state
                    [state]="row.chain === 'registered' ? 'active' : 'warning'"
                    [labelKey]="'docs.chain.' + row.chain"
                    variant="inline"
                  />
                }
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
    .docs {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .docs__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .docs__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .docs__tools {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .docs__lead {
      margin: 0;
      color: var(--dba-text-soft);
    }

    .docs__search {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 300px;
      max-width: 100%;
      height: var(--dba-height-search);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      color: var(--dba-text-muted);
    }

    .docs__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .docs__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .docs__input:focus {
      outline: none;
    }

    :host ::ng-deep .docs__select.p-select {
      width: 180px;
      max-width: 100%;
      height: var(--dba-height-control);
    }

    .docs__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .doc-row {
      color: inherit;
      text-decoration: none;
    }

    .cell {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .cell__label,
    .cell__text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--dba-text-cell);
    }

    .cell__label {
      font-weight: 500;
      color: var(--dba-ink);
    }

    .cell__meta {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    @media (max-width: 520px) {
      .docs__search {
        width: 100%;
      }

      :host ::ng-deep .docs__select.p-select {
        width: 100%;
      }
    }
  `,
})
export class DocumentsComponent {
  private readonly api = inject(DocumentsApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly docsPath = sectionPath('documents');
  protected readonly canManage = computed(() => this.auth.canManage('operations'));
  protected readonly canPickOrg = computed(() => this.auth.canRead('clients'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly view = signal<ListView>('todos');
  protected readonly page = signal(1);
  protected readonly searchDraft = signal('');
  protected readonly organization = signal<string | null>(null);
  protected readonly progress = signal<string>(ANY);
  protected readonly state = signal<string>(ANY);
  protected readonly chain = signal<string>(ANY);
  private readonly items = signal<PlatformDocumentSummary[]>([]);
  private readonly total = signal(0);
  private readonly issues = signal<DocumentIssues>(EMPTY_ISSUES);
  private issuesLoaded = false;
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly tabs = computed<UnderlineTab[]>(() => {
    const issues = this.issues();
    return [
      { key: 'todos', label: this.label('docs.view.todos') },
      {
        key: 'blockchain',
        label: this.label('docs.view.blockchain'),
        count: issues.unregisteredBlockchain.total,
        dot: issues.unregisteredBlockchain.total > 0 ? 'warn' : undefined,
      },
      {
        key: 'atascados',
        label: this.label('docs.view.atascados'),
        count: issues.stuckCompleted.total,
        dot: issues.stuckCompleted.total > 0 ? 'danger' : undefined,
      },
    ];
  });

  protected readonly progressOptions = computed(() => [
    { id: ANY, label: this.label('docs.f.anyProgress') },
    ...PROGRESSES.map((p) => ({ id: String(p), label: this.label(`docs.progress.${p}`) })),
  ]);
  protected readonly stateOptions = computed(() => [
    { id: ANY, label: this.label('docs.f.anyState') },
    ...STATES.map((s) => ({ id: String(s), label: this.label(`docs.state.${s}`) })),
  ]);
  protected readonly chainOptions = computed(() => [
    { id: ANY, label: this.label('docs.f.anyChain') },
    ...CHAINS.map((c) => ({ id: c, label: this.label(`docs.chainF.${c}`) })),
  ]);

  protected readonly issueRows = computed(() => {
    const issues = this.issues();
    return this.view() === 'blockchain'
      ? issues.unregisteredBlockchain.documents
      : issues.stuckCompleted.documents;
  });
  protected readonly issueTotal = computed(() => {
    const issues = this.issues();
    return this.view() === 'blockchain'
      ? issues.unregisteredBlockchain.total
      : issues.stuckCompleted.total;
  });

  protected readonly shownTotal = computed(() =>
    this.view() === 'todos' ? this.total() : this.issueRows().length,
  );
  protected readonly rows = computed<RowView[]>(() => {
    const source =
      this.view() === 'todos'
        ? this.items()
        : this.issueRows().slice((this.page() - 1) * LIMIT, this.page() * LIMIT);
    return source.map((doc) => this.toView(doc));
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.shownTotal() / LIMIT)));
  protected readonly from = computed(() =>
    this.shownTotal() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly to = computed(() => Math.min(this.shownTotal(), this.page() * LIMIT));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    const params = this.route.snapshot.queryParamMap;
    const wanted = params.get('vista');
    if (isIssueView(wanted)) this.view.set(wanted);
    const org = params.get('organizacion');
    if (org && this.canPickOrg()) this.organization.set(org);
    void this.reload();
  }

  protected pickView(key: string): void {
    const view: ListView = isIssueView(key) ? key : 'todos';
    this.view.set(view);
    this.page.set(1);
    this.syncUrl();
    void this.reload();
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
    this.restart();
  }

  protected setFilter(target: { set: (value: string) => void }, value: string): void {
    target.set(value);
    this.restart();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    if (this.view() === 'todos') void this.reload();
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    const listing = this.view() === 'todos';
    try {
      const [issues, page] = await Promise.all([
        listing && this.issuesLoaded ? Promise.resolve(null) : firstValueFrom(this.api.issues()),
        listing ? firstValueFrom(this.api.list(this.query())) : Promise.resolve(null),
      ]);
      if (!current()) return;
      if (issues) {
        this.issues.set(issues);
        this.issuesLoaded = true;
      }
      if (page) {
        this.items.set(page.items);
        this.total.set(page.total);
      }
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

  private query(): DocumentsQuery {
    return {
      search: this.search || undefined,
      organization: this.organization() ?? undefined,
      progress:
        this.progress() === ANY ? undefined : [Number(this.progress()) as SignatureProgress],
      state: this.state() === ANY ? undefined : (Number(this.state()) as DocumentState),
      blockchain: this.chain() === ANY ? undefined : (this.chain() as BlockchainFilter),
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

  private toView(doc: PlatformDocumentSummary): RowView {
    return {
      ...doc,
      statusView: statusViewOf(doc.status),
      chain: chainStateOf(doc),
      originKey: originKeyOf(doc.kind),
      ownerText: doc.owner?.names || doc.owner?.email || '—',
      createdText: doc.createdAt ? formatDate(doc.createdAt, 'd/MM/y', this.locale) : '—',
    };
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
