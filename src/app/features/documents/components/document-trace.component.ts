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
import { AuditEventComponent, type AuditActorKind } from '../../../shared/ui/audit-event.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import type { TraceEvent } from '../data/documents.models';
import { actorKindOf, traceKeyOf, traceReasonOf } from '../data/document-view';
import { TRACE_KEYS } from '../data/trace-keys';

interface TraceView {
  id: string;
  kind: AuditActorKind;
  actor: string;
  key: string | null;
  code: string;
  reason: string;
  meta: string;
}

@Component({
  selector: 'dba-document-trace',
  imports: [TranslatePipe, AuditEventComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tr">
      @if (views().length === 0) {
        <dba-empty-state titleKey="docs.traceUi.empty" />
      } @else {
        <p class="dba-meta tr__count">
          {{ 'docs.traceUi.count' | translate: { total: views().length } }}
        </p>
        @for (view of views(); track view.id; let last = $last) {
          <dba-audit-event [kind]="view.kind" [actor]="view.actor" [meta]="view.meta" [last]="last">
            @if (view.key) {
              {{ view.key | translate }}
            } @else {
              &ngsp;<code class="dba-ref">{{ view.code }}</code>
            }
            @if (view.reason) {
              <span class="tr__reason">{{
                'docs.traceUi.reason' | translate: { reason: view.reason }
              }}</span>
            }
          </dba-audit-event>
        }
      }
    </section>
  `,
  styles: `
    .tr {
      padding: 16px 18px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .tr__count {
      margin: 0 0 14px;
    }

    .tr__reason {
      display: block;
      margin-top: 2px;
      color: var(--dba-text-soft);
    }
  `,
})
export class DocumentTraceComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  readonly events = input.required<readonly TraceEvent[]>();

  protected readonly views = computed<TraceView[]>(() =>
    this.events().map((event, index) => ({
      id: `${event.timestamp}:${index}`,
      kind: actorKindOf(event),
      actor:
        event.actor.type === 'system'
          ? (this.translate.instant('docs.traceUi.system') as string)
          : event.actor.name || event.actor.email || '—',
      key: traceKeyOf(event.type, TRACE_KEYS),
      code: event.type,
      reason: traceReasonOf(event),
      meta: [
        formatDate(event.timestamp, 'd/MM/y HH:mm:ss', this.locale),
        event.actor.name ? event.actor.email : undefined,
        event.actor.ip,
      ]
        .filter((part) => !!part)
        .join(' · '),
    })),
  );
}
