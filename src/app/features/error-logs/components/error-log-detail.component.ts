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
import { AuthStore } from '../../../core/auth/auth.store';
import { canSeeSection, sectionPath } from '../../../core/layout/console-nav';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  actorPartsOf,
  affectedOf,
  contextLinesOf,
  groupLabelKeyOf,
  groupStateOf,
  prettyJson,
  stateActionsOf,
  type ContextLine,
  type ContextSection,
  type StateAction,
} from '../data/error-log-view';
import type { ErrorGroupDetail, ErrorGroupRow, ErrorSample } from '../data/error-logs.models';
import { safeDate } from '../../../shared/i18n/safe-date';

@Component({
  selector: 'dba-error-log-detail',
  imports: [
    RouterLink,
    TranslatePipe,
    ButtonComponent,
    ModalShellComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="alert"
      [title]="row().route"
      [subtitle]="('errl.service.' + row().service | translate) + ' · ' + row().kind"
      [maxWidth]="760"
      [confirmLabel]="primary()?.labelKey ?? 'common.close'"
      [cancelable]="!!primary()"
      cancelLabel="common.close"
      [busy]="busy()"
      (confirmed)="primary() ? changeState.emit(primary()!) : dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <dl class="item">
        <dt>{{ 'errl.col.state' | translate }}</dt>
        <dd class="state">
          <dba-org-state
            [state]="stateOf(row().state)"
            [labelKey]="labelOf(row().state)"
            variant="inline"
          />
          @for (action of secondary(); track action.to) {
            <button
              dba-button
              variant="secondary"
              type="button"
              [disabled]="busy()"
              (click)="changeState.emit(action)"
            >
              {{ action.labelKey | translate }}
            </button>
          }
        </dd>
        @if (row().triage; as triage) {
          <dt>{{ 'errl.field.triage' | translate }}</dt>
          <dd>
            {{
              'errl.triageText'
                | translate: { admin: triage.adminName || triage.adminId, when: when(triage.at) }
            }}
          </dd>
        }
        @if (row().reopenedAt; as reopened) {
          <dt>{{ 'errl.field.reopened' | translate }}</dt>
          <dd class="dba-mono">{{ when(reopened) }}</dd>
        }
        <dt>{{ 'errl.field.message' | translate }}</dt>
        <dd>{{ row().message }}</dd>
        <dt>{{ 'errl.col.count' | translate }}</dt>
        <dd class="dba-mono">{{ row().count }}</dd>
        @if (affected(); as affected) {
          <dt>{{ 'errl.field.affected' | translate }}</dt>
          <dd>{{ affected.key | translate: { n: affected.n } }}</dd>
        }
        <dt>{{ 'errl.field.firstSeen' | translate }}</dt>
        <dd class="dba-mono">{{ when(row().firstSeen) }}</dd>
        <dt>{{ 'errl.col.lastSeen' | translate }}</dt>
        <dd class="dba-mono">{{ when(row().lastSeen) }}</dd>
        @if (row().lastStatus) {
          <dt>{{ 'errl.field.status' | translate }}</dt>
          <dd class="dba-mono">{{ row().lastStatus }}</dd>
        }
        <dt>{{ 'errl.field.source' | translate }}</dt>
        <dd>{{ 'errl.source.' + row().source | translate }}</dd>
      </dl>

      @if (detail(); as group) {
        <h3 class="dba-panel item__heading">
          {{ 'errl.samples' | translate: { n: group.samples.length } }}
        </h3>
        @if (group.samples.length === 0) {
          <p class="dba-meta">{{ 'errl.noSamples' | translate }}</p>
        }
        @for (sample of group.samples; track sample.id; let first = $first) {
          <details class="item__more sample" [open]="first">
            <summary class="dba-mono">{{ summaryOf(sample) }}</summary>
            <dl class="item sample__body">
              <dt>{{ 'errl.field.message' | translate }}</dt>
              <dd>{{ sample.message }}</dd>
              @if (sample.path) {
                <dt>{{ 'errl.field.path' | translate }}</dt>
                <dd class="dba-mono">{{ sample.path }}</dd>
              }
              @for (line of contextOf(sample); track line.key) {
                <dt>{{ 'errl.context.' + line.key | translate }}</dt>
                <dd>
                  @if (canOpen(line)) {
                    <a class="item__link" [routerLink]="[pathOf(line.section), line.id]">{{
                      contextText(line)
                    }}</a>
                  } @else {
                    {{ contextText(line) }}
                  }
                </dd>
              }
              @for (part of actorOf(sample); track part.key) {
                <dt>{{ 'errl.actor.' + part.key | translate }}</dt>
                <dd class="dba-mono">{{ part.value }}</dd>
              }
              @if (sample.requestId) {
                <dt>{{ 'errl.field.requestId' | translate }}</dt>
                <dd class="dba-mono">{{ sample.requestId }}</dd>
              }
            </dl>
            @if (sample.query !== undefined) {
              <h4 class="dba-eyebrow item__heading">{{ 'errl.field.query' | translate }}</h4>
              <pre class="item__code dba-mono">{{ pretty(sample.query) }}</pre>
            }
            @if (sample.body !== undefined) {
              <h4 class="dba-eyebrow item__heading">{{ 'errl.field.body' | translate }}</h4>
              <pre class="item__code dba-mono">{{ pretty(sample.body) }}</pre>
            }
            @if (sample.stack) {
              <h4 class="dba-eyebrow item__heading">{{ 'errl.field.stack' | translate }}</h4>
              <pre class="item__code dba-mono">{{ sample.stack }}</pre>
            }
          </details>
        }
      } @else if (failed()) {
        <p class="dba-meta item__note">{{ 'errl.detailFailed' | translate }}</p>
      } @else {
        <db-section-loader [label]="'errl.loadingDetail' | translate" />
      }
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/detail-item.scss',
  styles: `
    .state {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .sample {
      padding-top: 12px;
      border-top: 1px solid var(--dba-border);
    }

    .sample__body {
      margin-top: 10px;
    }
  `,
})
export class ErrorLogDetailComponent {
  readonly row = input.required<ErrorGroupRow>();
  readonly detail = input<ErrorGroupDetail | null>(null);
  readonly failed = input(false);
  readonly busy = input(false);
  readonly dismissed = output<void>();
  readonly changeState = output<StateAction>();

  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  private readonly openable = computed(
    () =>
      new Set(
        (['documents', 'signers', 'organizations'] as const).filter((section) =>
          canSeeSection(this.auth.platformPermissions(), section),
        ),
      ),
  );

  private readonly actions = computed(() =>
    this.auth.canManage('platform') ? stateActionsOf(this.row().state) : [],
  );
  protected readonly primary = computed<StateAction | null>(() => this.actions()[0] ?? null);
  protected readonly secondary = computed(() => this.actions().slice(1));
  protected readonly stateOf = groupStateOf;
  protected readonly labelOf = groupLabelKeyOf;
  protected readonly affected = computed(() => affectedOf(this.row().affected));
  protected readonly actorOf = (sample: ErrorSample) => actorPartsOf(sample.actor, sample.context);
  protected readonly contextOf = (sample: ErrorSample) => contextLinesOf(sample.context);
  protected readonly pathOf = (section: ContextSection) => sectionPath(section);
  protected readonly pretty = prettyJson;

  protected canOpen(line: ContextLine): boolean {
    return !!line.id && this.openable().has(line.section);
  }

  protected contextText(line: ContextLine): string {
    const nit = line.nit
      ? (this.translate.instant('errl.context.nit', { nit: line.nit }) as string)
      : null;
    return [line.title, line.detail, nit].filter(Boolean).join(' · ');
  }

  protected when(value: string): string {
    return safeDate(value, 'd/MM/y, HH:mm:ss', this.locale);
  }

  protected summaryOf(sample: ErrorSample): string {
    return [this.when(sample.occurredAt), sample.status, sample.method, sample.path]
      .filter((part) => part !== undefined && part !== null && part !== '')
      .join(' · ');
  }
}
