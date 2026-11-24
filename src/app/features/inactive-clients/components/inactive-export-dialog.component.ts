import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  type OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/ui/notification.service';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { PluralKeyPipe } from '../../../shared/i18n/plural-key.pipe';
import { safeDate } from '../../../shared/i18n/safe-date';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { InactiveClientsApi } from '../data/inactive-clients.api';
import type { InactiveExportView } from '../data/inactive-clients.models';
import {
  exportBytesOf,
  exportDocumentsOf,
  exportPercentOf,
  exportStageOf,
  megabytesOf,
} from '../data/inactive-export-stage';

export const EXPORT_POLL_MS = 3000;

@Component({
  selector: 'dba-inactive-export-dialog',
  imports: [
    TranslatePipe,
    PluralKeyPipe,
    ModalShellComponent,
    FieldComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="download"
      [title]="'inactive.export.title' | translate"
      [subtitle]="orgName()"
      [confirmLabel]="composing() ? 'inactive.export.generate' : 'inactive.export.done'"
      [cancelable]="composing()"
      [confirmDisabled]="composing() && !reason().trim()"
      [busy]="starting()"
      [maxWidth]="560"
      (confirmed)="confirm()"
      (dismissed)="closed.emit()"
    >
      <div class="export">
        @if (loading()) {
          <db-section-loader [label]="'inactive.export.loading' | translate" size="40px" />
        } @else if (loadError()) {
          <div class="export__panel">
            <dba-empty-state titleKey="inactive.export.errorTitle" />
            <button dba-button variant="secondary" (click)="load()">
              {{ 'common.retry' | translate }}
            </button>
          </div>
        } @else {
          @if (view(); as job) {
            @switch (stage()) {
              @case ('running') {
                <div class="export__block">
                  <p class="export__title">{{ 'inactive.export.runningTitle' | translate }}</p>
                  <p class="dba-meta">
                    {{
                      'inactive.export.progress'
                        | translate: { processed: job.processed, total: job.total }
                    }}
                  </p>
                  <div
                    class="export__track"
                    role="progressbar"
                    [attr.aria-label]="'inactive.export.runningTitle' | translate"
                    [attr.aria-valuenow]="percent()"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <span class="export__fill" [style.width.%]="percent()"></span>
                  </div>
                  <p class="dba-meta">{{ 'inactive.export.runningNote' | translate }}</p>
                </div>
              }
              @case ('ready') {
                <div class="export__block">
                  <p class="export__title">{{ 'inactive.export.readyTitle' | translate }}</p>
                  <code class="export__link">{{ job.url }}</code>
                  <div class="export__row">
                    <span class="dba-meta">{{ summary() }}</span>
                    <button dba-button variant="secondary" (click)="copy(job.url)">
                      <db-icon [name]="copied() ? 'check' : 'copy'" [size]="15" />
                      {{
                        (copied() ? 'inactive.export.copied' : 'inactive.export.copy') | translate
                      }}
                    </button>
                  </div>
                  <p class="dba-meta">
                    {{ 'inactive.export.until' | translate: { date: day(job.expiresAt) } }}
                  </p>
                </div>
              }
              @case ('expired') {
                <p class="export__notice">
                  {{ 'inactive.export.expired' | translate: { date: day(job.expiresAt) } }}
                </p>
              }
              @case ('failed') {
                <p class="export__notice export__notice--bad">
                  {{ 'inactive.export.failed' | translate }}
                </p>
              }
            }

            @if (job.omitted.length && stage() !== 'running') {
              <div class="export__block">
                <p class="export__title">
                  {{
                    'inactive.export.omittedTitle'
                      | pluralKey: job.omitted.length
                      | translate: { n: job.omitted.length }
                  }}
                </p>
                <ul class="export__omitted">
                  @for (doc of job.omitted; track doc.id) {
                    <li>
                      <span class="export__docName">{{ doc.name || doc.code || doc.id }}</span>
                      @if (doc.code && doc.name) {
                        <span class="dba-mono"> · {{ doc.code }}</span>
                      }
                      <span class="dba-meta">
                        — {{ 'inactive.export.reason.' + doc.reason | translate }}</span
                      >
                    </li>
                  }
                </ul>
              </div>
            }
          }

          @if (composing()) {
            <p class="export__lead">{{ 'inactive.export.lead' | translate }}</p>
            @if (stage() === 'ready') {
              <p class="dba-meta">{{ 'inactive.export.keepsWorking' | translate }}</p>
            }
            <dba-field
              label="sub.reasonLabel"
              placeholder="inactive.export.reasonPlaceholder"
              [maxlength]="500"
              [(value)]="reason"
            />
          } @else if (stage() === 'ready' && canManage()) {
            <div class="export__again">
              <button dba-button variant="secondary" (click)="wantsNew.set(true)">
                {{ 'inactive.export.again' | translate }}
              </button>
            </div>
          } @else if (stage() === 'none') {
            <p class="export__lead">{{ 'inactive.export.noneReadOnly' | translate }}</p>
          }
        }
      </div>
    </db-modal-shell>
  `,
  styles: `
    .export {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .export__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .export__block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .export__title {
      margin: 0;
      font-size: var(--dba-text-cell);
      font-weight: 600;
      color: var(--dba-ink);
    }

    .export__lead,
    .export__notice {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }

    .export__notice--bad {
      color: var(--dba-state-suspended-fg);
    }

    .export__track {
      display: flex;
      height: 8px;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-border-row);
      overflow: hidden;
    }

    .export__fill {
      display: block;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-violet-500);
      transition: width 0.2s;
    }

    .export__link {
      display: block;
      padding: 12px 14px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-muted);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
      user-select: all;
    }

    .export__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .export__omitted {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 180px;
      margin: 0;
      padding: 0;
      overflow: auto;
      list-style: none;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }

    .export__docName {
      font-weight: 500;
      color: var(--dba-ink);
    }

    .export__again {
      display: flex;
      justify-content: flex-start;
    }
  `,
})
export class InactiveExportDialogComponent implements OnInit {
  readonly organizationId = input.required<string>();
  readonly orgName = input.required<string>();
  readonly canManage = input(false);
  readonly closed = output<void>();

  private readonly api = inject(InactiveClientsApi);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly view = signal<InactiveExportView | null>(null);
  protected readonly starting = signal(false);
  protected readonly copied = signal(false);
  protected readonly wantsNew = signal(false);
  protected readonly reason = signal('');

  protected readonly stage = computed(() => exportStageOf(this.view()));
  protected readonly percent = computed(() => {
    const job = this.view();
    return job ? exportPercentOf(job) : 0;
  });

  protected readonly composing = computed(() => {
    if (!this.canManage() || this.loading() || this.loadError()) return false;
    const stage = this.stage();
    if (stage === 'running') return false;
    return stage !== 'ready' || this.wantsNew();
  });

  protected readonly summary = computed(() => {
    const job = this.view();
    if (!job) return '';
    const parts = job.parts.length;
    const documents = exportDocumentsOf(job);
    return this.translate.instant(
      parts === 1 ? 'inactive.export.summaryOne' : 'inactive.export.summary',
      {
        parts,
        documents,
        size: formatNumber(megabytesOf(exportBytesOf(job)), this.locale, '1.0-1'),
      },
    ) as string;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    const current = this.latest.start();
    this.stopPolling();
    this.loading.set(this.view() === null);
    this.loadError.set(false);
    try {
      const result = await firstValueFrom(this.api.latestExport(this.organizationId()));
      if (!current()) return;
      this.show(result);
    } catch {
      if (current()) this.loadError.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected confirm(): void {
    if (this.composing()) {
      void this.start();
      return;
    }
    this.closed.emit();
  }

  protected async copy(url: string | null): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected day(value: string | null): string {
    return value ? safeDate(value, 'd/MM/y', this.locale) : '—';
  }

  private async start(): Promise<void> {
    const reason = this.reason().trim();
    if (!reason || this.starting()) return;
    this.starting.set(true);
    try {
      const result = await firstValueFrom(this.api.startExport(this.organizationId(), reason));
      this.reason.set('');
      this.wantsNew.set(false);
      this.copied.set(false);
      this.show(result);
    } catch (error) {
      if (errorCodeOf(error) === 'EXPORTACION_EN_CURSO') {
        this.notifications.info(this.translate.instant('inactive.export.alreadyRunning') as string);
        void this.load();
      } else {
        this.notifications.error(this.translate.instant('inactive.export.startError') as string);
      }
    } finally {
      this.starting.set(false);
    }
  }

  private show(result: InactiveExportView | null): void {
    this.view.set(result);
    if (result?.state === 'running') {
      this.timer = setTimeout(() => void this.load(), EXPORT_POLL_MS);
    }
  }

  private stopPolling(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
