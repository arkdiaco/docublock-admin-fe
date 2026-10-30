import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import type { TicketMessage } from '../data/support.models';
import { attachmentNameOf } from '../data/ticket-view';

export interface ReplyDraft {
  body: string;
  internal: boolean;
}

interface MessageView extends TicketMessage {
  key: string;
  author: string;
  stamp: string;
  files: { ref: string; name: string }[];
}

const BODY_LIMIT = 5000;

@Component({
  selector: 'dba-ticket-thread',
  imports: [
    TranslatePipe,
    FormsModule,
    ToggleSwitch,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    TextAreaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="th">
      @if (views().length === 0) {
        <dba-empty-state titleKey="support.thread.empty" />
      } @else {
        <ol class="th__list">
          @for (msg of views(); track msg.key) {
            <li
              class="msg"
              [class.msg--note]="msg.internalNote"
              [class.msg--agent]="msg.authorType === 'agent'"
            >
              <header class="msg__head">
                <span class="msg__author">{{ msg.author }}</span>
                <span class="dba-meta">{{ 'support.author.' + msg.authorType | translate }}</span>
                @if (msg.internalNote) {
                  <dba-org-state
                    state="closed"
                    labelKey="support.thread.internal"
                    variant="inline"
                  />
                }
                <span class="msg__stamp">{{ msg.stamp }}</span>
              </header>
              <p class="msg__body">{{ msg.body }}</p>
              @if (msg.files.length) {
                <div class="msg__files">
                  @for (file of msg.files; track file.ref) {
                    <button
                      dba-button
                      variant="secondary"
                      [busy]="opening() === file.ref"
                      [attr.title]="file.name"
                      (click)="open.emit(file.ref)"
                    >
                      <db-icon name="externalLink" [size]="14" />
                      <span class="msg__file">{{ file.name }}</span>
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ol>
      }

      @if (canReply()) {
        <div class="th__composer" [class.th__composer--note]="internal()">
          <dba-text-area
            [label]="
              (internal() ? 'support.thread.noteLabel' : 'support.thread.replyLabel') | translate
            "
            [placeholder]="
              (internal() ? 'support.thread.notePlaceholder' : 'support.thread.replyPlaceholder')
                | translate
            "
            [rows]="4"
            [maxlength]="limit"
            [(value)]="body"
          />
          <div class="th__bar">
            <div class="th__switch">
              <p-toggleswitch
                inputId="ticket-internal"
                [ngModel]="internal()"
                (ngModelChange)="internal.set($event)"
              />
              <span class="th__switchCopy">
                <label class="th__switchLabel" for="ticket-internal">{{
                  'support.thread.internal' | translate
                }}</label>
                <span class="dba-meta">{{
                  (internal() ? 'support.thread.noteHint' : 'support.thread.replyHint') | translate
                }}</span>
              </span>
            </div>
            <button dba-button [busy]="sending()" [disabled]="!canSend()" (click)="submit()">
              <db-icon [name]="internal() ? 'note' : 'send'" [size]="15" />
              {{ (internal() ? 'support.thread.saveNote' : 'support.thread.send') | translate }}
            </button>
          </div>
          @if (closed() && !internal()) {
            <p class="dba-meta th__hint">{{ 'support.thread.closedHint' | translate }}</p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .th {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .th__list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
      overflow: hidden;
    }

    .msg {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px 20px;
    }

    .msg + .msg {
      border-top: 1px solid var(--dba-border-row);
    }

    .msg--note {
      background: var(--dba-surface-head);
    }

    .msg__head {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .msg__author {
      font-size: var(--dba-text-cell);
      font-weight: 600;
      color: var(--dba-ink);
    }

    .msg--agent .msg__author {
      color: var(--dba-violet-700);
    }

    .msg__stamp {
      margin-left: auto;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .msg__body {
      margin: 0;
      font-size: var(--dba-text-cell);
      line-height: 1.55;
      color: var(--dba-ink);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .msg__files {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .msg__file {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .th__composer {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .th__composer--note {
      background: var(--dba-surface-head);
    }

    .th__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .th__switch {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }

    .th__switchCopy {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .th__switchLabel {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-ink);
    }

    .th__hint {
      margin: 0;
    }
  `,
})
export class TicketThreadComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly messages = input.required<readonly TicketMessage[]>();
  readonly canReply = input(false);
  readonly sending = input(false);
  readonly opening = input<string | null>(null);
  readonly closed = input(false);
  readonly send = output<ReplyDraft>();
  readonly open = output<string>();

  protected readonly limit = BODY_LIMIT;
  protected readonly body = signal('');
  protected readonly internal = signal(false);
  protected readonly canSend = computed(
    () => this.body().trim().length > 0 && this.body().length <= BODY_LIMIT && !this.sending(),
  );

  protected readonly views = computed<MessageView[]>(() =>
    this.messages().map((msg, index) => ({
      ...msg,
      key: `${index}:${msg.createdAt}`,
      author: msg.authorName || msg.authorEmail || '—',
      stamp: formatDate(msg.createdAt, 'd/MM/y HH:mm', this.locale),
      files: msg.attachments.map((ref) => ({ ref, name: attachmentNameOf(ref) })),
    })),
  );

  clear(): void {
    this.body.set('');
    this.internal.set(false);
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.send.emit({ body: this.body().trim(), internal: this.internal() });
  }
}
