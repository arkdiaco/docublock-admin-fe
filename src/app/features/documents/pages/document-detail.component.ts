import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import type { DialogReason } from '../../../shared/ui/dialog.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';
import {
  DocumentSignersComponent,
  type SignerAction,
} from '../components/document-signers.component';
import { DocumentTraceComponent } from '../components/document-trace.component';
import { DocumentVersionsComponent } from '../components/document-versions.component';
import { DocumentsApi } from '../data/documents.api';
import { DOCUMENT_ERRORS } from '../data/document-errors';
import type { DocumentVersion, PlatformDocumentDetail, TraceEvent } from '../data/documents.models';
import { documentActionsOf, shortHash, statusViewOf } from '../data/document-view';

const TAB_KEYS = ['summary', 'signers', 'versions', 'trace'] as const;

const REASON: DialogReason = {
  labelKey: 'docs.act.reasonLabel',
  placeholder: 'docs.act.reasonPlaceholder',
  limit: 500,
  quick: [],
  required: true,
};

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || name.slice(0, 2).toUpperCase();

@Component({
  selector: 'dba-document-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    RecordHeaderComponent,
    UnderlineTabsComponent,
    ActionMenuComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    DocumentSignersComponent,
    DocumentVersionsComponent,
    DocumentTraceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'docs.d.loading' | translate" />
    } @else if (missing()) {
      <div class="dd__panel">
        <dba-empty-state titleKey="docs.d.notFoundTitle" leadKey="docs.d.notFoundLead" />
        <a dba-button variant="secondary" [routerLink]="docsPath">{{
          'nav.documents' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="dd__panel">
        <dba-empty-state titleKey="docs.d.errorTitle" leadKey="docs.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (detail(); as doc) {
      <div class="dd">
        <dba-record-header
          [initials]="initials()"
          [title]="doc.name"
          [state]="status().family"
          [stateLabelKey]="status().labelKey"
          [meta]="meta()"
        >
          <div actions class="dd__actions">
            @if (menuItems().length) {
              <button
                dba-button
                variant="secondary"
                [busy]="!!pending.key()"
                (click)="docMenu.toggle($event)"
              >
                {{ 'docs.d.menu' | translate }}
                <db-icon name="chevronDown" [size]="15" />
              </button>
            }
          </div>
        </dba-record-header>
        <dba-action-menu
          #docMenu
          label="docs.d.menu"
          [items]="menuItems()"
          (picked)="runDocument($event)"
        />

        <db-underline-tabs [tabs]="tabs()" [active]="tab()" (picked)="tab.set($event)" />

        @switch (tab()) {
          @case ('summary') {
            <div class="dd__cols">
              <section class="dd__card">
                <h2 class="dba-panel">{{ 'docs.d.general' | translate }}</h2>
                <dl class="dd__dl">
                  <dt>{{ 'docs.d.f.code' | translate }}</dt>
                  <dd class="dba-mono">{{ doc.code || '—' }}</dd>
                  <dt>{{ 'docs.d.f.org' | translate }}</dt>
                  <dd>
                    @if (canOpenOrg()) {
                      <a class="dd__link" [routerLink]="[orgsPath, doc.organization.id]">{{
                        doc.organization.businessName || doc.organization.id
                      }}</a>
                    } @else {
                      {{ doc.organization.businessName || '—' }}
                    }
                  </dd>
                  <dt>{{ 'docs.d.f.owner' | translate }}</dt>
                  <dd>{{ owner() }}</dd>
                  <dt>{{ 'docs.d.f.status' | translate }}</dt>
                  <dd>{{ status().labelKey | translate }}</dd>
                  <dt>{{ 'docs.d.f.signers' | translate }}</dt>
                  <dd class="dba-mono">
                    {{
                      'docs.d.signedOf'
                        | translate: { signed: doc.signedCount, total: doc.signerCount }
                    }}
                  </dd>
                  <dt>{{ 'docs.d.f.versions' | translate }}</dt>
                  <dd class="dba-mono">{{ doc.versions.length }}</dd>
                  <dt>{{ 'docs.d.f.created' | translate }}</dt>
                  <dd class="dba-mono">{{ stamp(doc.createdAt) }}</dd>
                  <dt>{{ 'docs.d.f.updated' | translate }}</dt>
                  <dd class="dba-mono">{{ stamp(doc.updatedAt) }}</dd>
                </dl>
              </section>

              <div class="dd__side">
                <section class="dd__card">
                  <h2 class="dba-panel">{{ 'docs.d.chainTitle' | translate }}</h2>
                  @if (doc.anchor; as anchor) {
                    <dl class="dd__dl">
                      <dt>{{ 'docs.d.ledger' | translate }}</dt>
                      <dd>{{ anchor.ledger }}</dd>
                      @if (anchor.blockNumber !== undefined) {
                        <dt>{{ 'docs.d.block' | translate }}</dt>
                        <dd class="dba-mono">{{ anchor.blockNumber }}</dd>
                      }
                      <dt>{{ 'docs.d.commitment' | translate }}</dt>
                      <dd class="dba-mono" [attr.title]="anchor.commitmentHash">
                        {{ hash(anchor.commitmentHash) }}
                      </dd>
                      <dt>{{ 'docs.d.anchoredAt' | translate }}</dt>
                      <dd class="dba-mono">{{ stamp(anchor.anchoredAt) }}</dd>
                    </dl>
                  } @else if (doc.anchored) {
                    <p class="dba-body dd__note">{{ 'docs.chain.registered' | translate }}</p>
                  } @else if (doc.status.progress === 3) {
                    <p class="dba-body dd__note">{{ 'docs.d.chainPending' | translate }}</p>
                  } @else {
                    <p class="dba-body dd__note">{{ 'docs.d.chainNone' | translate }}</p>
                  }
                  @if (chainUrl(); as url) {
                    <a class="dd__link" [href]="url" target="_blank" rel="noopener">
                      {{ 'docs.d.openChain' | translate }}
                      <db-icon name="externalLink" [size]="13" />
                    </a>
                  }
                </section>

                <section class="dd__card">
                  <h2 class="dba-panel">{{ 'docs.d.certTitle' | translate }}</h2>
                  @if (doc.certificate; as cert) {
                    <dl class="dd__dl">
                      <dt>{{ 'docs.d.certSha' | translate }}</dt>
                      <dd class="dba-mono" [attr.title]="cert.sha256">{{ hash(cert.sha256) }}</dd>
                      <dt>{{ 'docs.d.certIssued' | translate }}</dt>
                      <dd class="dba-mono">{{ stamp(cert.issuedAt) }}</dd>
                    </dl>
                  } @else {
                    <p class="dba-body dd__note">{{ 'docs.d.certNone' | translate }}</p>
                  }
                </section>
              </div>
            </div>
          }
          @case ('signers') {
            <dba-document-signers
              [document]="doc"
              [canManage]="canManage()"
              [busy]="signerBusy()"
              (action)="runSigner($event)"
            />
          }
          @case ('versions') {
            <dba-document-versions
              [versions]="doc.versions"
              [canManage]="canManage()"
              [cancelled]="doc.status.state === 4"
              [busy]="pending.key()"
              (viewed)="viewVersion($event)"
              (detached)="detach($event)"
            />
          }
          @case ('trace') {
            @if (traceError()) {
              <div class="dd__panel">
                <dba-empty-state titleKey="docs.traceUi.errorTitle" leadKey="docs.errorLead" />
              </div>
            } @else {
              <dba-document-trace [events]="events()" />
            }
          }
        }
      </div>
    }
  `,
  styles: `
    .dd {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .dd__actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dd__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .dd__cols {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: var(--dba-grid-gap);
      align-items: start;
    }

    .dd__side {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
      min-width: 0;
    }

    .dd__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .dd__card h2 {
      margin: 0;
    }

    .dd__dl {
      display: grid;
      grid-template-columns: 160px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }

    .dd__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .dd__dl dd {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .dd__note {
      margin: 0;
      color: var(--dba-text-soft);
    }

    .dd__link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    .dd__link:hover {
      text-decoration: underline;
    }

    @media (max-width: 960px) {
      .dd__cols {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 520px) {
      .dd__dl {
        grid-template-columns: 1fr;
        gap: 2px;
      }

      .dd__dl dd {
        margin-bottom: 8px;
      }
    }
  `,
})
export class DocumentDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(DocumentsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly docsPath = sectionPath('documents');
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('operations'));
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly traceError = signal(false);
  protected readonly detail = signal<PlatformDocumentDetail | null>(null);
  protected readonly events = signal<TraceEvent[]>([]);
  protected readonly tab = signal<string>('summary');

  protected readonly status = computed(() =>
    statusViewOf(this.detail()?.status ?? { progress: 1, state: 0, label: '' }),
  );
  protected readonly initials = computed(() => initialsOf(this.detail()?.name ?? ''));
  protected readonly owner = computed(() => {
    const owner = this.detail()?.owner;
    return owner?.names || owner?.email || '—';
  });
  protected readonly chainUrl = computed(() => {
    const doc = this.detail();
    return doc?.anchor?.url || doc?.blockchainUrl || null;
  });
  protected readonly meta = computed(() => {
    const doc = this.detail();
    if (!doc) return '';
    return [doc.code, doc.organization.businessName, this.stamp(doc.createdAt)]
      .filter((part) => !!part && part !== '—')
      .join(' · ');
  });

  protected readonly tabs = computed<UnderlineTab[]>(() => {
    const doc = this.detail();
    const counts: Record<string, number | undefined> = {
      signers: doc?.signers.length,
      versions: doc?.versions.length,
      trace: this.events().length,
    };
    return TAB_KEYS.map((key) => ({
      key,
      label: this.translate.instant(`docs.d.tab.${key}`) as string,
      count: counts[key],
    }));
  });

  protected readonly menuItems = computed<ActionMenuItem[]>(() => {
    const doc = this.detail();
    if (!doc || !this.canManage()) return [];
    const allowed = documentActionsOf(doc, doc.signers);
    const items: ActionMenuItem[] = [];
    if (allowed.finalize) items.push({ key: 'finalize', labelKey: 'docs.act.finalize.label' });
    if (allowed.register) items.push({ key: 'register', labelKey: 'docs.act.register.label' });
    if (allowed.regenerate)
      items.push({ key: 'regenerate', labelKey: 'docs.act.regenerate.label' });
    if (allowed.cancel)
      items.push({
        key: 'cancel',
        labelKey: 'docs.act.cancel.label',
        danger: true,
        separated: items.length > 0,
      });
    return items;
  });

  protected readonly signerBusy = computed(() => {
    const key = this.pending.key();
    return key?.startsWith('signer:') ? key.slice('signer:'.length) : null;
  });

  constructor() {
    const wanted = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    if (wanted && (TAB_KEYS as readonly string[]).includes(wanted)) this.tab.set(wanted);
    effect(() => {
      const id = this.id();
      if (id) void this.load(id, true);
    });
  }

  protected reload(): void {
    void this.load(this.id(), true);
  }

  protected stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected hash(value?: string): string {
    return shortHash(value);
  }

  protected async runDocument(key: string): Promise<void> {
    const doc = this.detail();
    if (!doc) return;
    switch (key) {
      case 'finalize':
        return this.withReason(
          'finalize',
          'primary',
          'docs.act.finalize',
          'docs.act.finalize.label',
          (reason) => this.api.finalize(doc.id, reason),
        );
      case 'cancel':
        return this.withReason(
          'cancel',
          'danger',
          'docs.act.cancel',
          'docs.act.cancel.label',
          (reason) => this.api.cancel(doc.id, reason),
        );
      case 'regenerate':
        return this.regenerate(doc);
      case 'register':
        return this.register(doc);
    }
  }

  protected async runSigner(action: SignerAction): Promise<void> {
    const doc = this.detail();
    if (!doc) return;
    const { signer } = action;
    const key = `signer:${signer.identityId}`;
    if (action.kind === 'unblock') {
      return this.withReason(
        key,
        'primary',
        'docs.act.unblock',
        'docs.signer.unblock',
        (reason) => this.api.unblock(doc.id, signer.identityId, reason),
        { name: signer.name },
      );
    }
    if (action.kind === 'retry' && action.type) {
      const type = action.type;
      const answer = await this.dialogs.open({
        intent: 'primary',
        icon: 'rotate',
        title: 'docs.act.retry.title',
        message: 'docs.act.retry.message',
        params: { name: signer.name },
        confirmLabel: `docs.signer.retry.${type}`,
        reason: REASON,
      });
      if (answer.answer !== 'confirm' || !answer.reason) return;
      await this.act(
        key,
        this.api.enableRetry(doc.id, signer.identityId, type, answer.reason),
        (result) => {
          const granted = (result as { granted?: number; max?: number } | null) ?? {};
          return this.label('docs.act.retry.done', {
            granted: granted.granted ?? 1,
            max: granted.max ?? 1,
          });
        },
      );
      return;
    }
    const confirmed = await this.dialogs.confirm({
      intent: 'primary',
      icon: 'send',
      title: 'docs.act.resend.title',
      message: 'docs.act.resend.message',
      params: { name: signer.email ? `${signer.name} (${signer.email})` : signer.name },
      confirmLabel: 'docs.act.resend.confirm',
    });
    if (!confirmed) return;
    await this.pending.run(key, async () => {
      try {
        const outcome = await firstValueFrom(this.api.resend(doc.id, signer.identityId));
        if (outcome.sent) this.notify.success(this.label('docs.act.resend.done'));
        else this.notify.error(this.label('docs.act.resend.notSent'));
        await this.load(doc.id, false);
      } catch (error) {
        this.fail(error);
      }
    });
  }

  protected async viewVersion(version: DocumentVersion): Promise<void> {
    const doc = this.detail();
    if (!doc) return;
    const tab = window.open('', '_blank');
    await this.pending.run(`view:${version.id}`, async () => {
      try {
        const blob = await firstValueFrom(this.api.versionFile(doc.id, version.id));
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        tab?.close();
        this.notify.error(this.label('docs.act.pdfError'));
      }
    });
  }

  protected async detach(version: DocumentVersion): Promise<void> {
    const doc = this.detail();
    if (!doc) return;
    await this.withReason(
      `detach:${version.id}`,
      'danger',
      'docs.act.detach',
      'docs.version.detach',
      (reason) => this.api.detach(doc.id, version.id, reason),
      { index: version.index },
    );
  }

  private async regenerate(doc: PlatformDocumentDetail): Promise<void> {
    const signed = doc.status.progress === 3;
    const confirmed = await this.dialogs.confirm({
      intent: signed ? 'warn' : 'primary',
      icon: 'rotate',
      title: 'docs.act.regenerate.title',
      message: signed ? 'docs.act.regenerate.messageSigned' : 'docs.act.regenerate.messagePending',
      confirmLabel: 'docs.act.regenerate.label',
    });
    if (!confirmed) return;
    await this.act('regenerate', this.api.regenerate(doc.id), () =>
      this.label('docs.act.regenerate.done'),
    );
  }

  private async register(doc: PlatformDocumentDetail): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      intent: 'primary',
      icon: 'chain',
      title: 'docs.act.register.title',
      message: 'docs.act.register.message',
      confirmLabel: 'docs.act.register.label',
    });
    if (!confirmed) return;
    await this.pending.run('register', async () => {
      try {
        const result = await firstValueFrom(this.api.registerBlockchain(doc.id));
        if (result.outcome === 'registered')
          this.notify.success(this.label('docs.act.register.done'));
        else this.notify.info(this.label('docs.act.register.queued'));
        await this.load(doc.id, false);
      } catch (error) {
        this.fail(error);
      }
    });
  }

  private async withReason(
    key: string,
    intent: 'primary' | 'danger',
    base: string,
    confirmLabel: string,
    request: (reason: string) => Observable<unknown>,
    params?: Record<string, string | number>,
  ): Promise<void> {
    const answer = await this.dialogs.open({
      intent,
      icon: intent === 'danger' ? 'triangleAlert' : 'circleCheck',
      title: `${base}.title`,
      message: `${base}.message`,
      params,
      confirmLabel,
      reason: REASON,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.act(key, request(answer.reason.trim()), () => this.label(`${base}.done`));
  }

  private async act(
    key: string,
    request: Observable<unknown>,
    done: (result: unknown) => string,
  ): Promise<void> {
    await this.pending.run(key, async () => {
      try {
        const result = await firstValueFrom(request);
        this.notify.success(done(result));
        await this.load(this.id(), false);
      } catch (error) {
        this.fail(error);
      }
    });
  }

  private fail(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && DOCUMENT_ERRORS.includes(code);
    this.notify.error(this.label(known ? `docs.error.${code}` : 'docs.error.generic'));
  }

  private async load(id: string, initial: boolean): Promise<void> {
    const current = this.latest.start();
    if (initial) {
      this.loading.set(true);
      this.error.set(false);
      this.missing.set(false);
    }
    const [detail, trace] = await Promise.allSettled([
      firstValueFrom(this.api.detail(id)),
      firstValueFrom(this.api.trace(id)),
    ]);
    if (!current()) return;
    if (detail.status === 'fulfilled') {
      this.detail.set(detail.value);
    } else if (initial) {
      if (errorStatusOf(detail.reason) === 404) this.missing.set(true);
      else this.error.set(true);
    }
    this.traceError.set(trace.status === 'rejected');
    if (trace.status === 'fulfilled') this.events.set(trace.value.events);
    this.loading.set(false);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
