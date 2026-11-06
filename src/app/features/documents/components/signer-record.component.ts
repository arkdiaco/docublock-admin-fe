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
import { deviceLabel } from '../../../shared/domain/device-label';
import type { OrgState } from '../../../shared/domain/org-state';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import type {
  PlatformSigner,
  RequestedAttachment,
  SignerFile,
  SignerFileKind,
  SignerLocation,
} from '../data/documents.models';
import { shortHash } from '../data/document-view';
import {
  LINK_FAMILY,
  approvalFamilyOf,
  approvalStatusKey,
  fileMetaOf,
  filePartOf,
  itemDecisionsOf,
  locationText,
  otpChannelKey,
  panelKeyOf,
  sizeText,
  type SignerPanelRequest,
} from '../data/signer-view';

@Component({
  selector: 'dba-signer-record',
  imports: [TranslatePipe, RouterLink, ButtonComponent, IconComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = signer();
    <div class="sr">
      <section class="bd__card sr__card">
        <h3 class="dba-panel">{{ 'docs.sp.files.title' | translate }}</h3>
        @if (s.files.length) {
          <ul class="sr__list">
            @for (file of s.files; track file.kind) {
              <li class="sr__row">
                <span class="sr__stack">
                  <span class="sr__name">{{ 'docs.evidence.' + file.kind | translate }}</span>
                  <span class="sr__soft">{{ fileMeta(file) }}</span>
                </span>
                <button
                  dba-button
                  variant="secondary"
                  [busy]="busy() === key(filePart(file.kind))"
                  (click)="openFile(file.kind)"
                >
                  <db-icon name="eye" [size]="15" />
                  {{ 'docs.sum.view' | translate }}
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="bd__note sr__soft">{{ 'docs.sp.files.none' | translate }}</p>
        }
      </section>

      <section class="bd__card sr__card">
        <h3 class="dba-panel">{{ 'docs.sp.sign.title' | translate }}</h3>
        @if (s.signature; as sign) {
          <dl class="bd__dl">
            <dt>{{ 'docs.sp.sign.signedAt' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(sign.signedAt) }}</dd>
            <dt>{{ 'docs.sp.sign.how' | translate }}</dt>
            <dd>{{ 'docs.sp.sign.method.' + sign.method | translate }}</dd>
            @if (channels()) {
              <dt>{{ 'docs.sp.sign.channels' | translate }}</dt>
              <dd>{{ channels() }}</dd>
            }
            @if (sign.otpVerifiedAt) {
              <dt>{{ 'docs.sp.sign.otpAt' | translate }}</dt>
              <dd class="dba-mono">{{ stamp(sign.otpVerifiedAt) }}</dd>
            }
            @if (sign.propagatedFrom) {
              <dt>{{ 'docs.sp.sign.propagatedFrom' | translate }}</dt>
              <dd>
                <a class="bd__link" [routerLink]="[docsPath, sign.propagatedFrom]">{{
                  'docs.sp.sign.openSource' | translate
                }}</a>
              </dd>
            }
            @if (sign.ip) {
              <dt>{{ 'docs.sp.ip' | translate }}</dt>
              <dd class="dba-mono">{{ sign.ip }}</dd>
            }
            @if (sign.browser) {
              <dt>{{ 'docs.sp.browser' | translate }}</dt>
              <dd [attr.title]="sign.browser">{{ device(sign.browser) }}</dd>
            }
            @if (sign.origin) {
              <dt>{{ 'docs.sp.sign.origin' | translate }}</dt>
              <dd class="dba-mono">{{ sign.origin }}</dd>
            }
            @if (sign.location; as place) {
              <dt>{{ 'docs.sp.sign.place' | translate }}</dt>
              <dd>
                {{ placeText(place) }}
                @if (place.provider) {
                  <span class="sr__soft">{{
                    'docs.sp.sign.placeBy' | translate: { provider: place.provider }
                  }}</span>
                }
              </dd>
            }
            @if (sign.fingerprint) {
              <dt>{{ 'docs.sp.fingerprint' | translate }}</dt>
              <dd class="dba-mono" [attr.title]="sign.fingerprint">{{ hash(sign.fingerprint) }}</dd>
            }
            @if (sign.signSha) {
              <dt>{{ 'docs.sp.sign.sha' | translate }}</dt>
              <dd class="dba-mono" [attr.title]="sign.signSha">{{ hash(sign.signSha) }}</dd>
            }
          </dl>
          @if (sign.vault; as vault) {
            <p class="dba-eyebrow sr__eyebrow">{{ 'docs.sp.vault.title' | translate }}</p>
            <dl class="bd__dl">
              @if (vault.recordId) {
                <dt>{{ 'docs.sp.vault.record' | translate }}</dt>
                <dd class="dba-mono">{{ vault.recordId }}</dd>
              }
              @if (vault.bundleHash) {
                <dt>{{ 'docs.sp.vault.bundle' | translate }}</dt>
                <dd class="dba-mono" [attr.title]="vault.bundleHash">
                  {{ hash(vault.bundleHash) }}
                </dd>
              }
              @if (vault.keyId) {
                <dt>{{ 'docs.sp.vault.key' | translate }}</dt>
                <dd class="dba-mono">{{ vault.keyId }}</dd>
              }
              @if (vault.algorithm) {
                <dt>{{ 'docs.sp.vault.algorithm' | translate }}</dt>
                <dd class="dba-mono">{{ vault.algorithm }}</dd>
              }
              @if (vault.signedAt) {
                <dt>{{ 'docs.sp.date' | translate }}</dt>
                <dd class="dba-mono">{{ stamp(vault.signedAt) }}</dd>
              }
              @if (vault.legacy) {
                <dt>{{ 'docs.sp.vault.legacy' | translate }}</dt>
                <dd class="dba-mono">{{ vault.legacy }}</dd>
              }
            </dl>
          }
        } @else {
          <p class="bd__note sr__soft">{{ 'docs.signer.unsigned' | translate }}</p>
        }
      </section>

      <section class="bd__card sr__card">
        <h3 class="dba-panel">{{ 'docs.sp.approval.title' | translate }}</h3>
        @if (s.approval || s.legacyApproval) {
          @if (s.approval; as approval) {
            <dl class="bd__dl">
              <dt>{{ 'docs.sp.approval.state' | translate }}</dt>
              <dd>
                @if (statusKey(approval.status); as key) {
                  <dba-org-state
                    [state]="approvalFamily(approval.status)"
                    [labelKey]="key"
                    variant="inline"
                  />
                } @else {
                  {{ approval.status || '—' }}
                }
              </dd>
              @if (approval.held) {
                <dt>{{ 'docs.sp.approval.held' | translate }}</dt>
                <dd class="dba-mono">{{ stamp(approval.heldSince) }}</dd>
              }
              <dt>{{ 'docs.sp.approval.requested' | translate }}</dt>
              <dd class="dba-mono">{{ stamp(approval.requestedAt) }}</dd>
              @if (approval.decidedAt) {
                <dt>{{ 'docs.sp.approval.decided' | translate }}</dt>
                <dd class="dba-mono">{{ stamp(approval.decidedAt) }}</dd>
              }
              @if (approval.decidedBy; as by) {
                <dt>{{ 'docs.sp.approval.by' | translate }}</dt>
                <dd>{{ by.name || by.id }}</dd>
              }
              @if (approval.comment) {
                <dt>{{ 'docs.sp.approval.comment' | translate }}</dt>
                <dd>{{ approval.comment }}</dd>
              }
              @for (decision of decisions(); track decision.item) {
                <dt>{{ 'docs.sp.approval.item.' + decision.item | translate }}</dt>
                <dd>
                  {{
                    (decision.approved ? 'docs.sp.approval.itemOk' : 'docs.sp.approval.itemNo')
                      | translate
                  }}
                </dd>
              }
            </dl>
          }
          @if (s.legacyApproval; as legacy) {
            <p class="dba-eyebrow sr__eyebrow">{{ 'docs.sp.approval.legacy' | translate }}</p>
            <dl class="bd__dl">
              @for (row of legacyRows(); track row.item) {
                <dt>{{ 'docs.sp.approval.item.' + row.item | translate }}</dt>
                <dd>
                  {{
                    (row.approved ? 'docs.sp.approval.itemOk' : 'docs.sp.approval.itemNo')
                      | translate
                  }}
                </dd>
              }
            </dl>
            @if (legacy.comments.length) {
              <ul class="sr__list">
                @for (note of legacy.comments; track $index) {
                  <li class="sr__note">
                    <span class="sr__head">
                      <span>{{ note.by?.name || note.by?.id || '—' }}</span>
                      <span class="dba-mono sr__soft">{{ stamp(note.at) }}</span>
                    </span>
                    <span class="sr__text">{{ note.comment || '—' }}</span>
                  </li>
                }
              </ul>
            }
          }
        } @else {
          <p class="bd__note sr__soft">{{ 'docs.sp.approval.none' | translate }}</p>
        }
      </section>

      <section class="bd__card sr__card">
        <h3 class="dba-panel">{{ 'docs.sp.history.title' | translate }}</h3>
        @if (s.history.length) {
          <ul class="sr__list">
            @for (entry of s.history; track entry.index) {
              <li class="sr__note">
                <span class="sr__head">
                  <span>{{ 'docs.sp.history.rejected' | translate }}</span>
                  <span class="dba-mono sr__soft">{{ stamp(entry.rejectedAt) }}</span>
                </span>
                @if (entry.approval; as decision) {
                  <span class="sr__text">
                    {{ decision.decidedBy?.name || decision.decidedBy?.id || '—' }}
                    @if (decision.comment) {
                      · {{ decision.comment }}
                    }
                  </span>
                }
                @for (kind of entry.files; track kind) {
                  <span class="sr__row">
                    <span class="sr__name">{{ 'docs.evidence.' + kind | translate }}</span>
                    <button
                      dba-button
                      variant="secondary"
                      [busy]="busy() === key(filePart(kind, entry.index))"
                      (click)="openFile(kind, entry.index)"
                    >
                      <db-icon name="eye" [size]="15" />
                      {{ 'docs.sum.view' | translate }}
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="bd__note sr__soft">{{ 'docs.sp.history.none' | translate }}</p>
        }
      </section>

      <section class="bd__card sr__card">
        <h3 class="dba-panel">{{ 'docs.sp.report.title' | translate }}</h3>
        @if (s.report?.available) {
          <dl class="bd__dl">
            <dt>{{ 'docs.sp.report.issued' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(s.report?.issuedAt) }}</dd>
            @if (s.report?.sha256) {
              <dt>{{ 'docs.d.certSha' | translate }}</dt>
              <dd class="dba-mono" [attr.title]="s.report?.sha256">{{ hash(s.report?.sha256) }}</dd>
            }
          </dl>
          <div class="sr__tools">
            <button
              dba-button
              variant="secondary"
              [busy]="busy() === key('report')"
              (click)="request.emit({ kind: 'report', key: key('report') })"
            >
              <db-icon name="docCheck" [size]="15" />
              {{ 'docs.sp.report.view' | translate }}
            </button>
          </div>
        } @else {
          <p class="bd__note sr__soft">{{ 'docs.sp.report.none' | translate }}</p>
        }
      </section>

      <section class="bd__card sr__card">
        <h3 class="dba-panel">{{ 'docs.sp.att.title' | translate }}</h3>
        @if (s.attachments.length) {
          <ul class="sr__list">
            @for (item of s.attachments; track item.index) {
              <li class="sr__note">
                <span class="sr__head">
                  <span class="sr__name">{{ item.name }}</span>
                  <span class="sr__soft">{{ attachmentTags(item) }}</span>
                </span>
                @if (item.info) {
                  <span class="sr__text">{{ item.info }}</span>
                }
                @if (item.file; as file) {
                  <span class="sr__row">
                    <span class="sr__stack">
                      <span class="sr__name">{{ file.originalName || item.name }}</span>
                      <span class="sr__soft">{{ attachmentMeta(item) }}</span>
                    </span>
                    <button
                      dba-button
                      variant="secondary"
                      [busy]="busy() === key('att:' + item.index)"
                      (click)="
                        request.emit({
                          kind: 'attachment',
                          key: key('att:' + item.index),
                          index: item.index,
                        })
                      "
                    >
                      <db-icon name="eye" [size]="15" />
                      {{ 'docs.sum.view' | translate }}
                    </button>
                  </span>
                } @else {
                  <span class="sr__soft">{{ 'docs.sp.att.pending' | translate }}</span>
                }
                @if (item.rejection; as rejection) {
                  <span class="sr__text">
                    {{ 'docs.sp.att.rejected' | translate: { reason: rejection.reason } }}
                    <span class="dba-mono sr__soft">{{ stamp(rejection.at) }}</span>
                  </span>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="bd__note sr__soft">{{ 'docs.sp.att.none' | translate }}</p>
        }
      </section>

      <section class="bd__card sr__card">
        <h3 class="dba-panel">{{ 'docs.sp.notices.title' | translate }}</h3>
        <dl class="bd__dl">
          <dt>{{ 'docs.sp.notices.notified' | translate }}</dt>
          <dd class="dba-mono">{{ stamp(s.notices.notifiedAt) }}</dd>
          <dt>{{ 'docs.sp.notices.reminders' | translate }}</dt>
          <dd class="dba-mono">{{ s.notices.remindersSent }}</dd>
          <dt>{{ 'docs.sp.notices.lastReminder' | translate }}</dt>
          <dd class="dba-mono">{{ stamp(s.notices.lastReminderAt) }}</dd>
          <dt>{{ 'docs.sp.notices.opened' | translate }}</dt>
          <dd class="dba-mono">{{ stamp(s.notices.lastOpenedAt) }}</dd>
          @if (s.notices.ownerLinkExpiredAt) {
            <dt>{{ 'docs.sp.notices.ownerExpired' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(s.notices.ownerLinkExpiredAt) }}</dd>
          }
          @if (s.notices.ownerUnresponsiveAt) {
            <dt>{{ 'docs.sp.notices.ownerSilent' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(s.notices.ownerUnresponsiveAt) }}</dd>
          }
        </dl>
      </section>

      <section class="bd__card sr__card">
        <h3 class="dba-panel">{{ 'docs.sp.link.title' | translate }}</h3>
        <dl class="bd__dl">
          <dt>{{ 'docs.sp.link.state' | translate }}</dt>
          <dd>
            <dba-org-state
              [state]="linkFamily[s.link.state]"
              [labelKey]="'docs.sp.link.states.' + s.link.state"
              variant="inline"
            />
          </dd>
          <dt>{{ 'docs.sp.link.issued' | translate }}</dt>
          <dd class="dba-mono">{{ s.link.issued }}</dd>
          @if (s.link.lastIssuedAt) {
            <dt>{{ 'docs.sp.link.last' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(s.link.lastIssuedAt) }}</dd>
          }
          @if (s.link.expiresAt) {
            <dt>{{ 'docs.sp.link.expires' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(s.link.expiresAt) }}</dd>
          }
          @if (s.link.revokedAt) {
            <dt>{{ 'docs.sp.link.revoked' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(s.link.revokedAt) }}</dd>
          }
        </dl>
        <p class="bd__note sr__soft">{{ 'docs.sp.link.hidden' | translate }}</p>
      </section>
    </div>
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
  styles: `
    .sr {
      columns: 320px 3;
      column-gap: 16px;
    }

    .sr__card {
      break-inside: avoid;
      margin-bottom: 16px;
    }

    .sr__card h3 {
      margin: 0;
    }

    .sr__eyebrow {
      margin: 0;
    }

    .sr__list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .sr__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .sr__note {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--dba-border-row);
    }

    .sr__note:first-child {
      padding-top: 0;
      border-top: 0;
    }

    .sr__head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 4px 12px;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .sr__stack {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .sr__name {
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .sr__text {
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
      overflow-wrap: anywhere;
    }

    .sr__soft {
      font-size: var(--dba-text-label);
      color: var(--dba-text-soft);
    }

    .sr__tools {
      display: flex;
    }
  `,
})
export class SignerRecordComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly signer = input.required<PlatformSigner>();
  readonly busy = input<string | null>(null);
  readonly request = output<SignerPanelRequest>();

  protected readonly docsPath = sectionPath('documents');
  protected readonly linkFamily = LINK_FAMILY;

  protected readonly decisions = computed(() => itemDecisionsOf(this.signer().approval?.items));
  protected readonly legacyRows = computed(() => {
    const legacy = this.signer().legacyApproval;
    return itemDecisionsOf({
      sign: legacy?.sign,
      photoFront: legacy?.photoFront,
      photoBack: legacy?.photoBack,
    });
  });
  protected readonly channels = computed(() =>
    (this.signer().signature?.otpChannels ?? [])
      .map((channel) => {
        const key = otpChannelKey(channel);
        return key ? this.label(key) : channel;
      })
      .join(', '),
  );

  protected key(part: string): string {
    return panelKeyOf(this.signer().identityId, part);
  }

  protected filePart(kind: SignerFileKind, history?: number): string {
    return filePartOf(kind, history);
  }

  protected openFile(kind: SignerFileKind, history?: number): void {
    this.request.emit({
      kind: 'file',
      key: this.key(filePartOf(kind, history)),
      file: kind,
      history,
    });
  }

  protected stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected hash(value?: string): string {
    return shortHash(value);
  }

  protected device(agent?: string): string {
    return deviceLabel(agent) ?? '—';
  }

  protected placeText(place: SignerLocation): string {
    return locationText(place);
  }

  protected statusKey(status?: string): string | null {
    return approvalStatusKey(status);
  }

  protected approvalFamily(status?: string): OrgState {
    return approvalFamilyOf(status);
  }

  protected fileMeta(file: SignerFile): string {
    if (file.legacy) return this.label('docs.sp.files.legacy');
    return [fileMetaOf(file), file.at ? this.stamp(file.at) : '']
      .filter((part) => !!part)
      .join(' · ');
  }

  protected attachmentTags(item: RequestedAttachment): string {
    return [
      this.label(item.required ? 'docs.sp.att.required' : 'docs.sp.att.optional'),
      item.includeInDocument ? this.label('docs.sp.att.inDocument') : '',
      item.provided ? this.label('docs.sp.att.provided') : '',
    ]
      .filter((part) => !!part)
      .join(' · ');
  }

  protected attachmentMeta(item: RequestedAttachment): string {
    const file = item.file;
    if (!file) return '';
    return [file.mime, sizeText(file.size), file.at ? this.stamp(file.at) : '']
      .filter((part) => !!part)
      .join(' · ');
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
