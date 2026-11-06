import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import type {
  IntegrationAttachment,
  LinkedRef,
  PlatformDocumentDetail,
} from '../data/documents.models';
import { shortHash, statusViewOf } from '../data/document-view';
import {
  blockModeKeyOf,
  infoRowsOf,
  originKeyOf,
  portalText,
  refText,
  turnStateOf,
} from '../data/summary-view';

@Component({
  selector: 'dba-document-summary',
  imports: [TranslatePipe, RouterLink, ButtonComponent, IconComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let doc = document();
    <div class="sm">
      <div class="sm__col">
        <section class="sm__card">
          <h2 class="dba-panel">{{ 'docs.d.general' | translate }}</h2>
          <dl class="sm__dl">
            <dt>{{ 'docs.d.f.code' | translate }}</dt>
            <dd class="dba-mono">{{ doc.code || '—' }}</dd>
            <dt>{{ 'docs.d.f.origin' | translate }}</dt>
            <dd>{{ origin() }}</dd>
            <dt>{{ 'docs.d.f.portal' | translate }}</dt>
            <dd>{{ portal() }}</dd>
            <dt>{{ 'docs.d.f.org' | translate }}</dt>
            <dd>
              @if (canOpenOrg()) {
                <a class="sm__link" [routerLink]="[orgsPath, doc.organization.id]">{{
                  doc.organization.businessName || doc.organization.id
                }}</a>
              } @else {
                {{ doc.organization.businessName || '—' }}
              }
            </dd>
            <dt>{{ 'docs.d.f.owner' | translate }}</dt>
            <dd>{{ owner() }}</dd>
            <dt>{{ 'docs.d.f.status' | translate }}</dt>
            <dd>{{ statusKey() | translate }}</dd>
            <dt>{{ 'docs.d.f.signers' | translate }}</dt>
            <dd class="dba-mono">
              {{
                'docs.d.signedOf' | translate: { signed: doc.signedCount, total: doc.signerCount }
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

        <section class="sm__card">
          <h2 class="dba-panel">{{ 'docs.sum.placeTitle' | translate }}</h2>
          <dl class="sm__dl">
            <dt>{{ 'docs.sum.template' | translate }}</dt>
            <dd>{{ doc.template ? ref(doc.template) : '—' }}</dd>
            @if (doc.sourceTemplates.length) {
              <dt>{{ 'docs.sum.sources' | translate }}</dt>
              <dd>{{ sources() }}</dd>
            }
            <dt>{{ 'docs.sum.directory' | translate }}</dt>
            <dd>{{ doc.directory ? doc.directory.name || doc.directory.id : '—' }}</dd>
            <dt>{{ 'docs.sum.folder' | translate }}</dt>
            <dd>
              @if (doc.principalFolder) {
                {{ 'docs.sum.folderPrincipal' | translate }}
              } @else if (doc.folder; as folder) {
                <a class="sm__link" [routerLink]="[docsPath, folder.id]">{{ ref(folder) }}</a>
              } @else {
                —
              }
            </dd>
            <dt>{{ 'docs.sum.block' | translate }}</dt>
            <dd>
              @if (doc.block; as block) {
                <span class="sm__stack">
                  <span>{{ block.name || block.id }}</span>
                  <span class="sm__soft">{{ blockMeta() }}</span>
                </span>
              } @else {
                —
              }
            </dd>
            <dt>{{ 'docs.sum.flow' | translate }}</dt>
            <dd>
              @if (doc.flow; as flow) {
                <span class="sm__stack">
                  <span>{{ flow.flowName || flow.flowId || '—' }}</span>
                  @if (flow.processName || flow.processId) {
                    <span class="sm__soft">{{
                      'docs.sum.flowProcess'
                        | translate: { name: flow.processName || flow.processId }
                    }}</span>
                  }
                </span>
              } @else {
                —
              }
            </dd>
          </dl>
        </section>

        <section class="sm__card">
          <h2 class="dba-panel">{{ 'docs.sum.fieldsTitle' | translate }}</h2>
          @if (doc.fields.length) {
            <dl class="sm__dl">
              @for (field of doc.fields; track $index) {
                <dt>{{ field.name }}</dt>
                <dd>{{ field.value || '—' }}</dd>
              }
            </dl>
          } @else {
            <p class="dba-body sm__note">{{ 'docs.sum.fieldsNone' | translate }}</p>
          }
        </section>
      </div>

      <div class="sm__col">
        <section class="sm__card">
          <h2 class="dba-panel">{{ 'docs.sum.signingTitle' | translate }}</h2>
          <dl class="sm__dl">
            <dt>{{ 'docs.sum.turn' | translate }}</dt>
            <dd class="sm__turn">
              <span class="dba-mono">{{ doc.turn.order }}</span>
              @switch (turnState()) {
                @case ('open') {
                  <span class="sm__soft">{{
                    'docs.sum.turnPending' | translate: { pending: doc.turn.pending }
                  }}</span>
                }
                @case ('empty') {
                  <dba-org-state state="warning" labelKey="docs.sum.turnEmpty" variant="inline" />
                }
                @case ('held') {
                  <dba-org-state state="trial" labelKey="docs.sum.turnHeld" variant="inline" />
                }
              }
            </dd>
            <dt>{{ 'docs.sum.deadline' | translate }}</dt>
            <dd [class.dba-mono]="!!doc.signing?.deadline">
              {{
                doc.signing?.deadline
                  ? stamp(doc.signing?.deadline)
                  : ('docs.sum.deadlineNone' | translate)
              }}
            </dd>
            <dt>{{ 'docs.sum.reminders' | translate }}</dt>
            <dd>
              @if (doc.signing?.reminders; as rule) {
                {{
                  'docs.sum.remindersRule' | translate: { hours: rule.everyHours, max: rule.max }
                }}
              } @else {
                {{ 'docs.sum.remindersPlatform' | translate }}
              }
            </dd>
            <dt>{{ 'docs.sum.attempts' | translate }}</dt>
            <dd>
              @if (doc.signing?.maxAttempts; as max) {
                {{ 'docs.sum.attemptsMax' | translate: { max: max } }}
              } @else {
                {{ 'docs.sum.attemptsNone' | translate }}
              }
            </dd>
            <dt>{{ 'docs.sum.quota' | translate }}</dt>
            <dd [class.dba-mono]="!!doc.quotaConsumedAt">
              {{
                doc.quotaConsumedAt
                  ? stamp(doc.quotaConsumedAt)
                  : ('docs.sum.quotaNone' | translate)
              }}
            </dd>
          </dl>
        </section>

        <section class="sm__card">
          <h2 class="dba-panel">{{ 'docs.d.chainTitle' | translate }}</h2>
          @if (doc.anchor; as anchor) {
            <dl class="sm__dl">
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
            <p class="dba-body sm__note">{{ 'docs.chain.registered' | translate }}</p>
          } @else if (doc.status.progress === 3) {
            <p class="dba-body sm__note">{{ 'docs.d.chainPending' | translate }}</p>
          } @else {
            <p class="dba-body sm__note">{{ 'docs.d.chainNone' | translate }}</p>
          }
          @if (chainUrl(); as url) {
            <a class="sm__link" [href]="url" target="_blank" rel="noopener">
              {{ 'docs.d.openChain' | translate }}
              <db-icon name="externalLink" [size]="13" />
            </a>
          }
        </section>

        <section class="sm__card">
          <h2 class="dba-panel">{{ 'docs.d.certTitle' | translate }}</h2>
          @if (doc.certificate; as cert) {
            <dl class="sm__dl">
              <dt>{{ 'docs.d.certSha' | translate }}</dt>
              <dd class="dba-mono" [attr.title]="cert.sha256">{{ hash(cert.sha256) }}</dd>
              <dt>{{ 'docs.d.certIssued' | translate }}</dt>
              <dd class="dba-mono">{{ stamp(cert.issuedAt) }}</dd>
            </dl>
            <div class="sm__tools">
              <button
                dba-button
                variant="secondary"
                [busy]="busy() === 'cert'"
                (click)="certificate.emit()"
              >
                <db-icon name="docCheck" [size]="15" />
                {{ 'docs.sum.certView' | translate }}
              </button>
            </div>
          } @else {
            <p class="dba-body sm__note">{{ 'docs.d.certNone' | translate }}</p>
          }
        </section>

        <section class="sm__card">
          <h2 class="dba-panel">{{ 'docs.sum.infoTitle' | translate }}</h2>
          @if (info().length) {
            <dl class="sm__dl">
              @for (row of info(); track row.key) {
                <dt class="dba-mono">{{ row.key }}</dt>
                <dd>{{ row.value }}</dd>
              }
            </dl>
          } @else {
            <p class="dba-body sm__note">{{ 'docs.sum.infoNone' | translate }}</p>
          }
        </section>

        <section class="sm__card">
          <h2 class="dba-panel">{{ 'docs.sum.filesTitle' | translate }}</h2>
          @if (doc.attachments.length) {
            <ul class="sm__files">
              @for (file of doc.attachments; track file.index) {
                <li class="sm__file">
                  <span class="sm__stack">
                    <span class="sm__name">{{ file.name }}</span>
                    @if (file.merge) {
                      <span class="sm__soft">{{ 'docs.sum.fileMerged' | translate }}</span>
                    }
                  </span>
                  @if (file.available) {
                    <button
                      dba-button
                      variant="secondary"
                      [busy]="busy() === 'att:' + file.index"
                      (click)="attachment.emit(file)"
                    >
                      <db-icon name="eye" [size]="15" />
                      {{ 'docs.sum.view' | translate }}
                    </button>
                  } @else {
                    <span class="sm__soft">{{ 'docs.sum.fileMissing' | translate }}</span>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="dba-body sm__note">{{ 'docs.sum.filesNone' | translate }}</p>
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .sm {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: var(--dba-grid-gap);
      align-items: start;
    }

    .sm__col {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
      min-width: 0;
    }

    .sm__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sm__card h2 {
      margin: 0;
    }

    .sm__dl {
      display: grid;
      grid-template-columns: 160px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }

    .sm__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
      overflow-wrap: anywhere;
    }

    .sm__dl dd {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .sm__stack {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .sm__soft {
      font-size: var(--dba-text-label);
      color: var(--dba-text-soft);
    }

    .sm__turn {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .sm__note {
      margin: 0;
      color: var(--dba-text-soft);
    }

    .sm__tools {
      display: flex;
    }

    .sm__files {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .sm__file {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .sm__name {
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .sm__link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    .sm__link:hover {
      text-decoration: underline;
    }

    @media (max-width: 960px) {
      .sm {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 520px) {
      .sm__dl {
        grid-template-columns: 1fr;
        gap: 2px;
      }

      .sm__dl dd {
        margin-bottom: 8px;
      }
    }
  `,
})
export class DocumentSummaryComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly document = input.required<PlatformDocumentDetail>();
  readonly canOpenOrg = input(false);
  readonly busy = input<string | null>(null);
  readonly certificate = output<void>();
  readonly attachment = output<IntegrationAttachment>();

  protected readonly docsPath = sectionPath('documents');
  protected readonly orgsPath = sectionPath('organizations');

  protected readonly statusKey = computed(() => statusViewOf(this.document().status).labelKey);
  protected readonly turnState = computed(() => turnStateOf(this.document()));
  protected readonly info = computed(() => infoRowsOf(this.document().relatedInfo));
  protected readonly owner = computed(() => {
    const owner = this.document().owner;
    return owner?.names || owner?.email || '—';
  });
  protected readonly origin = computed(() => {
    const kind = this.document().kind;
    const key = originKeyOf(kind);
    return key ? this.label(key) : kind || '—';
  });
  protected readonly portal = computed(() => portalText(this.document().portal));
  protected readonly sources = computed(() =>
    this.document()
      .sourceTemplates.map((template) => refText(template))
      .join(', '),
  );
  protected readonly blockMeta = computed(() => {
    const block = this.document().block;
    if (!block) return '';
    const mode = blockModeKeyOf(block.signatureMode);
    return [
      mode ? this.label(mode) : '',
      this.label('docs.sum.blockDocs', { count: block.documents }),
    ]
      .filter((part) => !!part)
      .join(' · ');
  });
  protected readonly chainUrl = computed(() => {
    const doc = this.document();
    return doc.anchor?.url || doc.blockchainUrl || null;
  });

  protected stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected hash(value?: string): string {
    return shortHash(value);
  }

  protected ref(value: LinkedRef): string {
    return refText(value);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
