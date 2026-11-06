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
import { errorCodeOf, errorStatusOf, fileErrorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { saveBlob } from '../../../shared/http/save-blob';
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
  type SignerPanelEvent,
} from '../components/document-signers.component';
import { DocumentSummaryComponent } from '../components/document-summary.component';
import { DocumentTraceComponent } from '../components/document-trace.component';
import { DocumentVersionsComponent } from '../components/document-versions.component';
import { RawDataComponent } from '../components/raw-data.component';
import {
  SignerFeaturesFormComponent,
  type SignerChangeRequest,
} from '../components/signer-features-form.component';
import {
  SignerReactivateFormComponent,
  type ReactivationRequest,
} from '../components/signer-reactivate-form.component';
import { DocumentsApi } from '../data/documents.api';
import { DOCUMENT_ERRORS } from '../data/document-errors';
import type {
  DocumentVersion,
  IntegrationAttachment,
  PlatformDocumentDetail,
  PlatformSigner,
  RawDocument,
  TraceEvent,
} from '../data/documents.models';
import { documentActionsOf, statusViewOf } from '../data/document-view';
import { initialsOf } from '../../../shared/domain/initials';

const TAB_KEYS = ['summary', 'signers', 'versions', 'trace'] as const;

const MENU_KEYS: readonly string[] = ['finalize', 'cancel', 'regenerate', 'register'];

const REVOKE_AFTER_MS = 60_000;

type SignerForm = 'reactivate' | 'features';

const REASON: DialogReason = {
  labelKey: 'docs.act.reasonLabel',
  placeholder: 'docs.act.reasonPlaceholder',
  limit: 500,
  quick: [],
  required: true,
};

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
    DocumentSummaryComponent,
    DocumentSignersComponent,
    DocumentVersionsComponent,
    DocumentTraceComponent,
    RawDataComponent,
    SignerFeaturesFormComponent,
    SignerReactivateFormComponent,
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
            <button dba-button variant="secondary" (click)="openRaw()">
              <db-icon name="listBullets" [size]="15" />
              {{ 'docs.raw.open' | translate }}
            </button>
            <button
              dba-button
              variant="secondary"
              [busy]="pending.key() === 'bundle'"
              (click)="downloadBundle()"
            >
              <db-icon name="download" [size]="15" />
              {{ 'docs.d.bundle' | translate }}
            </button>
            @if (menuItems().length) {
              <button
                dba-button
                variant="secondary"
                [busy]="menuBusy()"
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
            <dba-document-summary
              [document]="doc"
              [canOpenOrg]="canOpenOrg()"
              [busy]="pending.key()"
              (certificate)="viewCertificate()"
              (attachment)="viewAttachment($event)"
            />
          }
          @case ('signers') {
            <dba-document-signers
              [document]="doc"
              [canManage]="canManage()"
              [canOpenSigner]="canOpenOrg()"
              [busy]="signerBusy()"
              [pendingKey]="pending.key()"
              (action)="runSigner($event)"
              (panelRequest)="viewSignerItem($event)"
            />
          }
          @case ('versions') {
            <dba-document-versions
              [versions]="doc.versions"
              [signers]="doc.signers"
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
      @if (rawOpen()) {
        <dba-raw-data
          [subtitle]="rawSubtitle()"
          [view]="raw()"
          [failed]="rawFailed()"
          (dismissed)="rawOpen.set(false)"
        />
      }
      @if (editing(); as edit) {
        @if (edit.form === 'reactivate') {
          <dba-signer-reactivate-form
            [signer]="edit.signer"
            [enabled]="doc.enabledValidations"
            [busy]="signerBusy() === edit.signer.identityId"
            (submitted)="reactivate(edit.signer, $event)"
            (dismissed)="editing.set(null)"
          />
        } @else {
          <dba-signer-features-form
            [signer]="edit.signer"
            [enabled]="doc.enabledValidations"
            [busy]="signerBusy() === edit.signer.identityId"
            (submitted)="changeSigner(edit.signer, $event)"
            (dismissed)="editing.set(null)"
          />
        }
      }
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
      flex-wrap: wrap;
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
  protected readonly rawOpen = signal(false);
  protected readonly raw = signal<RawDocument | null>(null);
  protected readonly rawFailed = signal(false);
  protected readonly rawSubtitle = signal('');
  protected readonly editing = signal<{ form: SignerForm; signer: PlatformSigner } | null>(null);

  protected readonly status = computed(() =>
    statusViewOf(this.detail()?.status ?? { progress: 1, state: 0, label: '' }),
  );
  protected readonly initials = computed(() => initialsOf(this.detail()?.name ?? ''));
  protected readonly menuBusy = computed(() => MENU_KEYS.includes(this.pending.key() ?? ''));
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

  protected openRaw(): Promise<void> {
    const doc = this.detail();
    if (!doc) return Promise.resolve();
    return this.showRaw(doc.name, this.api.raw(doc.id));
  }

  protected viewSignerItem({ signer, request }: SignerPanelEvent): Promise<void> {
    const doc = this.detail();
    if (!doc) return Promise.resolve();
    switch (request.kind) {
      case 'raw':
        return this.showRaw(signer.name, this.api.signerRaw(doc.id, signer.identityId));
      case 'file':
        return this.openFile(
          request.key,
          this.api.signerFile(doc.id, signer.identityId, request.file, request.history),
          'docs.act.fileError',
        );
      case 'attachment':
        return this.openFile(
          request.key,
          this.api.signerAttachmentFile(doc.id, signer.identityId, request.index),
          'docs.act.fileError',
        );
      case 'report':
        return this.openFile(
          request.key,
          this.api.signerReport(doc.id, signer.identityId),
          'docs.act.pdfError',
        );
    }
  }

  protected async downloadBundle(): Promise<void> {
    const doc = this.detail();
    if (!doc) return;
    await this.pending.run('bundle', async () => {
      try {
        const file = await firstValueFrom(this.api.bundle(doc.id));
        saveBlob(file.blob, file.filename);
      } catch (error) {
        await this.failFile(error, 'docs.act.bundleError');
      }
    });
  }

  protected viewCertificate(): Promise<void> {
    const doc = this.detail();
    if (!doc) return Promise.resolve();
    return this.openFile('cert', this.api.certificateFile(doc.id), 'docs.act.pdfError');
  }

  protected viewAttachment(file: IntegrationAttachment): Promise<void> {
    const doc = this.detail();
    if (!doc) return Promise.resolve();
    return this.openFile(
      `att:${file.index}`,
      this.api.attachmentFile(doc.id, file.index),
      'docs.act.fileError',
    );
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
    if (action.kind === 'reactivate' || action.kind === 'features') {
      this.editing.set({ form: action.kind, signer });
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

  protected reactivate(
    signer: PlatformSigner,
    { scope, reason }: ReactivationRequest,
  ): Promise<void> {
    const doc = this.detail();
    if (!doc) return Promise.resolve();
    return this.saveSigner(
      signer,
      this.api.reactivateValidations(doc.id, signer.identityId, scope, reason),
      'docs.react.done',
    );
  }

  protected changeSigner(
    signer: PlatformSigner,
    { change, reason }: SignerChangeRequest,
  ): Promise<void> {
    const doc = this.detail();
    if (!doc) return Promise.resolve();
    return this.saveSigner(
      signer,
      this.api.changeSigner(doc.id, signer.identityId, change, reason),
      'docs.feat.done',
    );
  }

  protected viewVersion(version: DocumentVersion): Promise<void> {
    const doc = this.detail();
    if (!doc) return Promise.resolve();
    return this.openFile(
      `view:${version.id}`,
      this.api.versionFile(doc.id, version.id),
      'docs.act.pdfError',
    );
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

  private async showRaw(subtitle: string, request: Observable<RawDocument>): Promise<void> {
    this.raw.set(null);
    this.rawFailed.set(false);
    this.rawSubtitle.set(subtitle);
    this.rawOpen.set(true);
    try {
      this.raw.set(await firstValueFrom(request));
    } catch {
      this.rawFailed.set(true);
    }
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

  private async saveSigner(
    signer: PlatformSigner,
    request: Observable<{ registry?: { code?: string } }>,
    done: string,
  ): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run(`signer:${signer.identityId}`, async () => {
      try {
        const result = await firstValueFrom(request);
        const code = result.registry?.code;
        this.notify.success(
          code
            ? this.label('docs.registryCheck.done', { done: this.label(done), code })
            : this.label(done),
        );
      } catch (error) {
        this.fail(error);
      }
      this.editing.set(null);
      await this.load(this.id(), false);
    });
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

  private async openFile(key: string, request: Observable<Blob>, fallback: string): Promise<void> {
    const tab = window.open('', '_blank');
    await this.pending.run(key, async () => {
      try {
        const url = URL.createObjectURL(await firstValueFrom(request));
        if (tab) tab.location.href = url;
        else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
      } catch (error) {
        tab?.close();
        await this.failFile(error, fallback);
      }
    });
  }

  private async failFile(error: unknown, fallback: string): Promise<void> {
    const code = await fileErrorCodeOf(error);
    const known = code !== null && DOCUMENT_ERRORS.includes(code);
    this.notify.error(this.label(known ? `docs.error.${code}` : fallback));
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
