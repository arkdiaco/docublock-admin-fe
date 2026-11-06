import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { deviceLabel } from '../../../shared/domain/device-label';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { REACTIVATION_SCOPES, type PlatformSigner } from '../data/documents.models';
import { shortHash } from '../data/document-view';
import {
  ATTEMPT_KINDS,
  CHECK_FAMILY,
  REQUIREMENT_KEYS,
  checkOf,
  prettyJson,
  scoreText,
  skipReasonKey,
  type CheckState,
} from '../data/signer-view';

@Component({
  selector: 'dba-signer-checks',
  imports: [TranslatePipe, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = signer();
    @let checks = s.checks;
    @let req = s.requirements;
    <div class="sc">
      <section class="bd__card sc__card">
        <h3 class="dba-panel">{{ 'docs.sp.req.title' | translate }}</h3>
        <dl class="bd__dl">
          @for (key of requirementKeys; track key) {
            <dt>{{ 'docs.sp.req.' + key | translate }}</dt>
            <dd>{{ (req[key] ? 'common.yes' : 'common.no') | translate }}</dd>
          }
          <dt>{{ 'docs.sp.req.identity' | translate }}</dt>
          <dd>
            {{
              (req.fullIdentity ? 'docs.sp.req.identityFull' : 'docs.sp.req.identityBasic')
                | translate
            }}
          </dd>
          @if (req.photoMode) {
            <dt>{{ 'docs.sp.req.photoMode' | translate }}</dt>
            <dd>{{ 'docs.sp.req.photo.' + req.photoMode | translate }}</dd>
          }
          <dt>{{ 'docs.sp.req.email' | translate }}</dt>
          <dd>
            {{ (req.skipEmail ? 'docs.sp.req.emailSkipped' : 'docs.sp.req.emailSent') | translate }}
          </dd>
        </dl>
      </section>

      <section class="bd__card sc__card">
        <h3 class="dba-panel">{{ 'docs.sp.identity.title' | translate }}</h3>
        <dl class="bd__dl">
          <dt>{{ 'docs.sp.identity.verified' | translate }}</dt>
          <dd [class.dba-mono]="!!s.identity.check?.verifiedAt">
            {{
              s.identity.check?.verifiedAt
                ? stamp(s.identity.check?.verifiedAt)
                : ('docs.sp.identity.notVerified' | translate)
            }}
          </dd>
          @if (s.identity.check; as check) {
            @if (check.variant) {
              <dt>{{ 'docs.sp.identity.variant' | translate }}</dt>
              <dd>{{ variantText(check.variant) }}</dd>
            }
            @if (check.ip) {
              <dt>{{ 'docs.sp.ip' | translate }}</dt>
              <dd class="dba-mono">{{ check.ip }}</dd>
            }
            @if (check.userAgent) {
              <dt>{{ 'docs.sp.browser' | translate }}</dt>
              <dd [attr.title]="check.userAgent">{{ device(check.userAgent) }}</dd>
            }
            @if (check.fingerprint) {
              <dt>{{ 'docs.sp.fingerprint' | translate }}</dt>
              <dd class="dba-mono" [attr.title]="check.fingerprint">
                {{ hash(check.fingerprint) }}
              </dd>
            }
          }
          @if (s.identity.validated !== undefined) {
            <dt>{{ 'docs.sp.identity.validated' | translate }}</dt>
            <dd>{{ (s.identity.validated ? 'common.yes' : 'common.no') | translate }}</dd>
          }
          <dt>{{ 'docs.sp.identity.attempts' | translate }}</dt>
          <dd>
            @if (s.identity.maxAttempts) {
              {{
                'docs.sp.identity.attemptsOf'
                  | translate: { used: s.signingAttempts, max: s.identity.maxAttempts }
              }}
            } @else {
              {{ 'docs.sp.identity.attemptsNoMax' | translate: { used: s.signingAttempts } }}
            }
          </dd>
          @if (s.identity.blockedAt) {
            <dt>{{ 'docs.sp.identity.blockedAt' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(s.identity.blockedAt) }}</dd>
          }
        </dl>
      </section>

      <section class="bd__card sc__card">
        <h3 class="dba-panel">{{ 'docs.sp.consents.title' | translate }}</h3>
        @if (s.consents.length) {
          <ul class="sc__list">
            @for (consent of s.consents; track $index) {
              <li class="sc__item">
                <span class="sc__head">
                  <span class="dba-mono">{{ consent.code }} · v{{ consent.version }}</span>
                  <span class="dba-mono sc__soft">{{ stamp(consent.acceptedAt) }}</span>
                </span>
                <dl class="bd__dl">
                  @if (consent.ip) {
                    <dt>{{ 'docs.sp.ip' | translate }}</dt>
                    <dd class="dba-mono">{{ consent.ip }}</dd>
                  }
                  @if (consent.userAgent) {
                    <dt>{{ 'docs.sp.browser' | translate }}</dt>
                    <dd [attr.title]="consent.userAgent">{{ device(consent.userAgent) }}</dd>
                  }
                  <dt>{{ 'docs.sp.consents.textHash' | translate }}</dt>
                  <dd class="dba-mono" [attr.title]="consent.textHash">
                    {{ hash(consent.textHash) }}
                  </dd>
                  @if (consent.fingerprint) {
                    <dt>{{ 'docs.sp.fingerprint' | translate }}</dt>
                    <dd class="dba-mono" [attr.title]="consent.fingerprint">
                      {{ hash(consent.fingerprint) }}
                    </dd>
                  }
                </dl>
              </li>
            }
          </ul>
        } @else {
          <p class="bd__note sc__soft">{{ 'docs.sp.consents.none' | translate }}</p>
        }
      </section>

      <section class="bd__card sc__card">
        <h3 class="dba-panel">{{ 'docs.evidence.liveness' | translate }}</h3>
        @if (checks.liveness; as live) {
          <dl class="bd__dl">
            <dt>{{ 'docs.sp.result' | translate }}</dt>
            <dd>
              <dba-org-state
                [state]="family[check(live.passed)]"
                [labelKey]="'docs.evidence.state.' + check(live.passed)"
                variant="inline"
              />
            </dd>
            <dt>{{ 'docs.sp.live.confidence' | translate }}</dt>
            <dd class="dba-mono">{{ score(live.confidence, live.threshold) }}</dd>
            @if (live.sessionId) {
              <dt>{{ 'docs.sp.live.session' | translate }}</dt>
              <dd class="dba-mono">{{ live.sessionId }}</dd>
            }
            <dt>{{ 'docs.sp.date' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(live.at) }}</dd>
          </dl>
        } @else {
          <p class="bd__note sc__soft">
            {{ (req.liveness ? 'docs.sp.notDone' : 'docs.sp.notRequested') | translate }}
          </p>
        }
      </section>

      <section class="bd__card sc__card">
        <h3 class="dba-panel">{{ 'docs.sp.doc.title' | translate }}</h3>
        @if (checks.faceCompare || checks.documentCheck || checks.documentReadTries !== undefined) {
          @if (checks.faceCompare; as face) {
            <p class="dba-eyebrow sc__eyebrow">{{ 'docs.evidence.faceCompare' | translate }}</p>
            <dl class="bd__dl">
              <dt>{{ 'docs.sp.result' | translate }}</dt>
              <dd>
                <dba-org-state
                  [state]="family[check(face.passed)]"
                  [labelKey]="'docs.evidence.state.' + check(face.passed)"
                  variant="inline"
                />
              </dd>
              <dt>{{ 'docs.sp.doc.score' | translate }}</dt>
              <dd class="dba-mono">{{ score(face.score, face.threshold) }}</dd>
              <dt>{{ 'docs.sp.date' | translate }}</dt>
              <dd class="dba-mono">{{ stamp(face.at) }}</dd>
            </dl>
          }
          @if (checks.documentCheck; as doc) {
            <p class="dba-eyebrow sc__eyebrow">{{ 'docs.sp.doc.reading' | translate }}</p>
            <dl class="bd__dl">
              <dt>{{ 'docs.sp.result' | translate }}</dt>
              <dd>
                <dba-org-state
                  [state]="family[check(doc.passed)]"
                  [labelKey]="'docs.evidence.state.' + check(doc.passed)"
                  variant="inline"
                />
              </dd>
              @if (doc.documentNumber) {
                <dt>{{ 'docs.sp.doc.number' | translate }}</dt>
                <dd class="dba-mono">{{ doc.documentNumber }}</dd>
              }
              @if (doc.unreadable) {
                <dt>{{ 'docs.sp.doc.unreadable' | translate }}</dt>
                <dd>{{ 'common.yes' | translate }}</dd>
              }
              @if (doc.skipped) {
                <dt>{{ 'docs.sp.doc.skipped' | translate }}</dt>
                <dd>{{ skipText(doc.skipped) }}</dd>
              }
              <dt>{{ 'docs.sp.date' | translate }}</dt>
              <dd class="dba-mono">{{ stamp(doc.at) }}</dd>
            </dl>
          }
          @if (checks.documentReadTries !== undefined) {
            <dl class="bd__dl">
              <dt>{{ 'docs.sp.doc.tries' | translate }}</dt>
              <dd class="dba-mono">{{ checks.documentReadTries }}</dd>
            </dl>
          }
        } @else {
          <p class="bd__note sc__soft">
            {{ (req.identityValid ? 'docs.sp.notDone' : 'docs.sp.notRequested') | translate }}
          </p>
        }
      </section>

      <section class="bd__card sc__card">
        <h3 class="dba-panel">{{ 'docs.sp.bio.title' | translate }}</h3>
        @if (checks.faceMatch || checks.providerResponses.length) {
          @if (checks.faceMatch; as match) {
            <dl class="bd__dl">
              <dt>{{ 'docs.sp.result' | translate }}</dt>
              <dd>
                <dba-org-state
                  [state]="family[check(match.passed)]"
                  [labelKey]="'docs.evidence.state.' + check(match.passed)"
                  variant="inline"
                />
              </dd>
              @if (match.code) {
                <dt>{{ 'docs.sp.bio.code' | translate }}</dt>
                <dd class="dba-mono">{{ match.code }}</dd>
              }
              @if (match.fallback) {
                <dt>{{ 'docs.sp.bio.fallback' | translate }}</dt>
                <dd>{{ 'docs.sp.bio.fallbackYes' | translate }}</dd>
              }
              <dt>{{ 'docs.sp.date' | translate }}</dt>
              <dd class="dba-mono">{{ stamp(match.at) }}</dd>
            </dl>
          }
          @if (checks.providerResponses.length) {
            <p class="dba-eyebrow sc__eyebrow">{{ 'docs.sp.bio.responses' | translate }}</p>
            <ul class="sc__list">
              @for (response of checks.providerResponses; track $index) {
                <li class="sc__item">
                  <span class="sc__head">
                    <span class="dba-mono">{{ response.type || '—' }}</span>
                    <span class="dba-mono sc__soft">{{ stamp(response.date) }}</span>
                  </span>
                  <pre class="sc__pre dba-mono">{{ json(response.data) }}</pre>
                </li>
              }
            </ul>
          }
        } @else {
          <p class="bd__note sc__soft">
            {{ (req.biometricValid ? 'docs.sp.notDone' : 'docs.sp.notRequested') | translate }}
          </p>
        }
      </section>

      <section class="bd__card sc__card">
        <h3 class="dba-panel">{{ 'docs.sp.registry.title' | translate }}</h3>
        @if (checks.registry; as registry) {
          <dl class="bd__dl">
            <dt>{{ 'docs.sp.result' | translate }}</dt>
            <dd>
              <dba-org-state
                [state]="family[check(registry.ok)]"
                [labelKey]="'docs.evidence.state.' + check(registry.ok)"
                variant="inline"
              />
            </dd>
            @if (registry.code) {
              <dt>{{ 'docs.sp.registry.code' | translate }}</dt>
              <dd class="dba-mono">{{ registry.code }}</dd>
            }
            <dt>{{ 'docs.sp.registry.checkedAt' | translate }}</dt>
            <dd class="dba-mono">{{ stamp(registry.checkedAt) }}</dd>
          </dl>
        } @else {
          <p class="bd__note sc__soft">
            {{ (req.checkDataRegistry ? 'docs.sp.notDone' : 'docs.sp.notRequested') | translate }}
          </p>
        }
      </section>

      <section class="bd__card sc__card">
        <h3 class="dba-panel">{{ 'docs.sp.attempts.title' | translate }}</h3>
        <p class="dba-eyebrow sc__eyebrow">{{ 'docs.sp.attempts.window' | translate }}</p>
        <dl class="bd__dl">
          @for (kind of attemptKinds; track kind) {
            @let slot = s.attempts.window[kind];
            <dt>{{ 'docs.sp.attempts.kind.' + kind | translate }}</dt>
            <dd>
              {{ 'docs.sp.attempts.usedOf' | translate: { used: slot.used, max: slot.max } }}
              @if (slot.retryAfterSeconds) {
                <span class="sc__soft">{{
                  'docs.sp.attempts.retryAfter' | translate: { seconds: slot.retryAfterSeconds }
                }}</span>
              }
            </dd>
          }
        </dl>
        @if (counted().length) {
          <p class="dba-eyebrow sc__eyebrow">{{ 'docs.sp.attempts.counted' | translate }}</p>
          <dl class="bd__dl">
            @for (row of counted(); track row.kind) {
              <dt>{{ 'docs.sp.attempts.kind.' + row.kind | translate }}</dt>
              <dd class="dba-mono">{{ row.value }}</dd>
            }
          </dl>
        }
        <p class="dba-eyebrow sc__eyebrow">{{ 'docs.sp.attempts.retries' | translate }}</p>
        <dl class="bd__dl">
          @for (kind of retryKinds; track kind) {
            <dt>{{ 'docs.sp.attempts.kind.' + kind | translate }}</dt>
            <dd>
              {{
                'docs.sp.attempts.grantedOf'
                  | translate
                    : {
                        granted: s.attempts.retries[kind].granted,
                        max: s.attempts.retries[kind].max,
                      }
              }}
            </dd>
          }
        </dl>
        <p class="dba-eyebrow sc__eyebrow">{{ 'docs.sp.attempts.reactivations' | translate }}</p>
        <dl class="bd__dl">
          @for (scope of scopes; track scope) {
            <dt>{{ 'docs.react.scope.' + scope | translate }}</dt>
            <dd class="dba-mono">{{ s.attempts.reactivations[scope] }}</dd>
          }
        </dl>
        <p class="dba-eyebrow sc__eyebrow">{{ 'docs.sp.attempts.credits' | translate }}</p>
        <dl class="bd__dl">
          <dt>{{ 'docs.sp.attempts.kind.biometric' | translate }}</dt>
          <dd>
            {{
              (s.attempts.credits.biometric
                ? 'docs.sp.attempts.charged'
                : 'docs.sp.attempts.notCharged'
              ) | translate
            }}
          </dd>
          <dt>{{ 'docs.sp.attempts.kind.document' | translate }}</dt>
          <dd>
            {{
              (s.attempts.credits.identity
                ? 'docs.sp.attempts.charged'
                : 'docs.sp.attempts.notCharged'
              ) | translate
            }}
          </dd>
        </dl>
      </section>
    </div>
  `,
  styleUrl: '../../../shared/ui/detail-page.scss',
  styles: `
    .sc {
      columns: 320px 3;
      column-gap: 16px;
    }

    .sc__card {
      break-inside: avoid;
      margin-bottom: 16px;
    }

    .sc__card h3 {
      margin: 0;
    }

    .sc__eyebrow {
      margin: 0;
    }

    .sc__list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .sc__item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--dba-border-row);
    }

    .sc__item:first-child {
      padding-top: 0;
      border-top: 0;
    }

    .sc__head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 4px 12px;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .sc__soft {
      font-size: var(--dba-text-label);
      color: var(--dba-text-soft);
    }

    .sc__pre {
      max-height: 220px;
      margin: 0;
      padding: 10px 12px;
      overflow: auto;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-key);
      background: var(--dba-surface-head);
      font-size: var(--dba-text-meta);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class SignerChecksComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly signer = input.required<PlatformSigner>();

  protected readonly requirementKeys = REQUIREMENT_KEYS;
  protected readonly attemptKinds = ATTEMPT_KINDS;
  protected readonly retryKinds = ['document', 'biometric'] as const;
  protected readonly scopes = REACTIVATION_SCOPES;
  protected readonly family = CHECK_FAMILY;

  protected readonly counted = computed(() => {
    const counted = this.signer().attempts.counted;
    return this.retryKinds.flatMap((kind) =>
      counted[kind] === undefined ? [] : [{ kind, value: counted[kind] }],
    );
  });

  protected stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected hash(value?: string): string {
    return shortHash(value);
  }

  protected device(agent?: string): string {
    return deviceLabel(agent) ?? '—';
  }

  protected check(passed?: boolean): CheckState {
    return checkOf(passed);
  }

  protected score(value?: number, threshold?: number): string {
    return scoreText(value, threshold);
  }

  protected json(value: unknown): string {
    return prettyJson(value);
  }

  protected variantText(variant: string): string {
    return variant === 'full' || variant === 'basic'
      ? this.label(`docs.sp.identity.variants.${variant}`)
      : variant;
  }

  protected skipText(reason: string): string {
    const key = skipReasonKey(reason);
    return key ? this.label(key) : reason;
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
