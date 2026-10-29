import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent, type IconName } from './icon.component';

export type DialogIntent = 'primary' | 'danger' | 'success' | 'warn';
export type DialogLayout = 'confirm' | 'status' | 'context';
export type DialogSize = 'compact' | 'standard' | 'wide';
export type DialogAnswer = 'confirm' | 'secondary' | 'cancel';

export interface DialogMeter {
  used: number;
  quota: number;
  labelKey: string;
}

export interface DialogContext {
  title: string;
  detail: string;
}

export interface DialogReason {
  labelKey: string;
  placeholder: string;
  limit: number;
  quick: string[];
  required?: boolean;
}

export interface DialogRequest {
  layout?: DialogLayout;
  params?: Record<string, string | number>;
  intent?: DialogIntent;
  size?: DialogSize;
  icon?: IconName;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  note?: string;
  dismissible?: boolean;
  outlined?: boolean;
  meter?: DialogMeter;
  warnings?: string[];
  context?: DialogContext;
  reason?: DialogReason;
  challenge?: DialogChallenge;
}

export interface DialogChallenge {
  identifier: string;
  actionKey: string;
}

export interface DialogResult {
  answer: DialogAnswer;
  reason?: string;
}

const ICONO_POR_INTENCION: Record<DialogIntent, IconName> = {
  primary: 'info',
  danger: 'circleX',
  success: 'circleCheck',
  warn: 'triangleAlert',
};

const ANCHOS: Record<DialogSize, number> = { compact: 400, standard: 460, wide: 540 };

@Component({
  selector: 'db-dialog',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="scrim"
      tabindex="-1"
      [attr.aria-label]="'common.close' | translate"
      (click)="dismiss()"
    ></button>

    <div
      class="box"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dbDialogTitle"
      tabindex="-1"
      [class]="'box--' + layout() + ' box--' + intent()"
      [style.--db-dialog-width.px]="width()"
      #box
      (keydown)="onKey($event)"
    >
      @if (layout() === 'status') {
        <span class="box__stripe" aria-hidden="true"></span>
      }

      <header class="head">
        <span class="head__tile" aria-hidden="true">
          <db-icon [name]="icon()" [size]="tileIcon()" />
        </span>

        <span class="head__copy">
          <h2 class="head__title" id="dbDialogTitle">{{ request().title | translate: request().params }}</h2>
          @if (request().message) {
            <p class="head__message">{{ request().message | translate: request().params }}</p>
          }
        </span>

        @if (request().dismissible) {
          <button
            type="button"
            class="head__close"
            [attr.aria-label]="'common.close' | translate"
            (click)="answer('cancel')"
          >
            <db-icon name="close" [size]="18" />
          </button>
        }
      </header>

      @if (request().meter; as meter) {
        <span
          class="meter"
          role="meter"
          [attr.aria-valuenow]="meter.used"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="meter.quota"
          [attr.aria-label]="meter.labelKey | translate: meter"
        >
          <span class="meter__fill" [style.width.%]="meterPercent()"></span>
        </span>
      }

      @if (request().context || request().reason || request().warnings || request().challenge) {
        <div class="body">
          @if (request().context; as context) {
            <div class="body__card">
              <span class="body__cardTitle">{{ context.title }}</span>
              <span class="body__cardDetail">{{ context.detail }}</span>
            </div>
          }

          @if (request().challenge; as challenge) {
            <div class="body__challenge">
              <p class="body__challengeText">
                {{ 'dialog.challenge.write' | translate }}
                <code class="body__challengeId">{{ challenge.identifier }}</code>
                {{ 'dialog.challenge.toDo' | translate: { action: (challenge.actionKey | translate) } }}
              </p>
              <input
                #challengeInput
                type="text"
                class="body__challengeInput"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                [placeholder]="challengePlaceholder()"
                [attr.aria-label]="'dialog.challenge.aria' | translate: { id: challenge.identifier }"
                [value]="typed()"
                (input)="onTyped($event)"
              />
            </div>
          }

          @if (request().reason; as ask) {
            <label class="body__reason">
              <span class="body__label">{{ ask.labelKey | translate }}</span>
              <textarea
                class="body__text"
                [placeholder]="ask.placeholder | translate"
                [attr.maxlength]="ask.limit"
                [value]="reason()"
                (input)="onReason($event)"
              ></textarea>
            </label>
            @if (ask.quick.length > 0) {
              <div class="body__quick">
                <span class="body__quickLabel">{{ 'dialog.quick' | translate }}</span>
                @for (option of ask.quick; track option) {
                  <button type="button" class="body__chip" (click)="reason.set(option)">
                    {{ option }}
                  </button>
                }
              </div>
            }
          }

          @for (warning of request().warnings ?? []; track warning) {
            <p class="body__warn">{{ warning }}</p>
          }
        </div>
      }

      <footer class="foot" [class.foot--stacked]="layout() === 'status'">
        @if (request().note) {
          <span class="foot__note">{{ request().note | translate }}</span>
        }

        @if (layout() === 'status') {
          <button type="button" class="btn btn--primary" (click)="answer('confirm')">
            {{ request().confirmLabel | translate }}
          </button>
          @if (request().secondaryLabel) {
            <button type="button" class="btn btn--plain" (click)="answer('secondary')">
              {{ request().secondaryLabel | translate }}
            </button>
          }
        } @else {
          <button type="button" class="btn btn--ghost" (click)="answer('cancel')">
            {{ (request().cancelLabel ?? 'common.cancel') | translate }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--primary]="intent() !== 'danger'"
            [class.btn--danger]="intent() === 'danger' && !request().outlined"
            [class.btn--dangerOutline]="intent() === 'danger' && request().outlined"
            [disabled]="confirmBlocked()"
            (click)="answer('confirm')"
          >
            {{ request().confirmLabel | translate }}
          </button>
        }
      </footer>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .scrim {
      position: absolute;
      inset: 0;
      padding: 0;
      border: 0;
      background: var(--db-scrim);
      cursor: default;
    }

    .box {
      position: relative;
      width: 100%;
      max-width: var(--db-dialog-width);
      max-height: calc(100vh - 48px);
      overflow: hidden auto;
      border-radius: 16px;
      background: var(--db-surface);
      box-shadow: var(--db-shadow-dialog);
    }

    .box__stripe {
      display: block;
      height: 4px;
      background: var(--db-primary);
    }

    .box--danger .box__stripe {
      background: var(--db-danger);
    }

    .box--success .box__stripe {
      background: var(--db-success-strong);
    }

    .box--warn .box__stripe {
      background: var(--db-warn-strong);
    }

    .head {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 22px 22px 0;
      text-align: center;
    }

    .box--status .head {
      padding: 26px 24px 0;
    }

    .box--context .head {
      flex-direction: row;
      align-items: flex-start;
      gap: 14px;
      padding: 22px 24px;
      text-align: left;
    }

    .head__tile {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--db-primary-pale-soft);
      color: var(--db-primary-ink);
    }

    .box--danger .head__tile {
      background: var(--db-danger-soft);
      color: var(--db-danger);
    }

    .box--success .head__tile {
      background: var(--db-success-wash);
      color: var(--db-success-strong);
    }

    .box--warn .head__tile {
      background: var(--db-warn-tint);
      color: var(--db-warn-strong);
    }

    .box--confirm.box--danger .head__tile {
      width: 48px;
      height: 48px;
      border-radius: 14px;
    }

    .box--status .head__tile {
      width: 52px;
      height: 52px;
      border-radius: 16px;
    }

    .head__copy {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .box--confirm .head__copy,
    .box--status .head__copy {
      align-items: center;
    }

    .box--context .head__copy {
      flex: 1;
    }

    .head__title {
      margin-top: 15px;
      font-size: 17px;
      font-weight: 600;
      line-height: 25.5px;
      letter-spacing: -0.306px;
      color: var(--db-ink-strong);
    }

    .box--context .head__title {
      margin-top: 0;
      font-size: 16px;
      line-height: 24px;
      letter-spacing: -0.288px;
    }

    .head__message {
      margin-top: 8px;
      font-size: var(--db-text-body);
      line-height: 19.375px;
      color: var(--db-ink-note-soft);
    }

    .box--context .head__message {
      margin-top: 6px;
    }

    .head__close {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--db-ink-dim);
      cursor: pointer;
    }

    .head__close:hover {
      color: var(--db-ink-strong);
    }

    .meter {
      display: block;
      height: 7px;
      margin: 14px 24px 0;
      border-radius: 99px;
      background: var(--db-warn-track);
    }

    .meter__fill {
      display: block;
      height: 100%;
      border-radius: 99px;
      background: var(--db-warn-strong);
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px 24px 0;
    }

    .body__card {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 13px 15px;
      border-radius: 11px;
      background: var(--db-surface-sunken);
    }

    .body__cardTitle {
      font-size: var(--db-text-bar);
      font-weight: 600;
      line-height: 19.5px;
      color: var(--db-ink-strong);
    }

    .body__cardDetail {
      font-size: var(--db-text-small);
      line-height: 17px;
      color: var(--db-ink-soft);
    }

    .body__challenge {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-card);
    }

    .body__challengeText {
      margin: 0;
      font-size: var(--dba-text-cell);
      line-height: 1.5;
      color: var(--dba-text);
    }

    .body__challengeId {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-id);
      font-weight: 600;
      color: var(--dba-state-suspended-fg);
    }

    .body__challengeInput {
      height: var(--dba-height-control);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .body__challengeInput:focus {
      outline: none;
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .body__challengeInput::placeholder {
      color: var(--dba-text-faint);
    }

    .body__reason {
      display: block;
    }

    .body__label {
      display: block;
      font-size: var(--db-text-eyebrow);
      font-weight: 500;
      line-height: 17.5px;
      color: var(--db-ink-soft);
    }

    .body__text {
      display: block;
      width: 100%;
      height: 90px;
      margin-top: 7px;
      padding: 12px 13px;
      border: 1px solid var(--db-border-subtle);
      border-radius: 10px;
      background: var(--db-surface);
      font-family: var(--db-font);
      font-size: var(--db-text-body);
      line-height: 19px;
      color: var(--db-ink-strong);
      resize: none;
    }

    .body__text:focus {
      outline: none;
      border-color: var(--db-primary);
    }

    .body__quick {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px;
    }

    .body__quickLabel {
      font-size: var(--db-text-micro);
      color: var(--db-ink-ghost);
    }

    .body__chip {
      padding: 4px 9px;
      border: 1px solid var(--db-border-field-soft);
      border-radius: 20px;
      background: var(--db-surface-tile);
      font-family: var(--db-font);
      font-size: var(--db-text-eyebrow);
      font-weight: 500;
      line-height: 16.5px;
      color: var(--db-ink-muted);
      cursor: pointer;
    }

    .body__warn {
      padding: 13px 15px;
      border-radius: 11px;
      background: var(--db-warn-tint);
      font-size: var(--db-text-body);
      line-height: 19.5px;
      color: var(--db-warn-ink);
    }

    .foot {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 20px 22px 22px;
    }

    .box--context .foot {
      padding: 20px 24px 22px;
    }

    .foot--stacked {
      flex-direction: column;
      gap: 6px;
      padding: 20px 24px 24px;
    }

    .foot__note {
      flex: 1;
      font-size: var(--db-text-eyebrow);
      line-height: 16.5px;
      color: var(--db-ink-ghost);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn {
      flex: 1;
      padding: 12px;
      border: 0;
      border-radius: 11px;
      font-family: var(--db-font);
      font-size: var(--db-text-bar);
      font-weight: 600;
      line-height: 19.5px;
      cursor: pointer;
    }

    .box--context .btn {
      flex: 0 0 auto;
      padding: 12px 18px;
    }

    .foot--stacked .btn {
      width: 100%;
      flex: 0 0 auto;
    }

    .btn--ghost {
      border: 1px solid var(--db-border-subtle);
      background: var(--db-surface);
      color: var(--db-ink-muted);
    }

    .btn--ghost:hover {
      background: var(--db-surface-field);
    }

    .btn--primary {
      background: var(--db-primary);
      color: var(--db-primary-contrast);
    }

    .btn--primary:hover {
      background: var(--db-primary-ink);
    }

    .btn--danger {
      background: var(--db-danger);
      color: var(--db-primary-contrast);
    }

    .btn--danger:hover {
      background: var(--db-danger-ink);
    }

    .btn--dangerOutline {
      border: 1px solid var(--db-danger);
      background: var(--db-surface);
      color: var(--db-danger);
    }

    .btn--dangerOutline:hover {
      background: var(--db-danger-tint);
    }

    .btn--plain {
      background: transparent;
      color: var(--db-ink-muted);
    }

    .btn--plain:hover {
      color: var(--db-ink-strong);
    }

    @media (max-width: 640px) {
      :host {
        align-items: end;
        padding: 0;
      }

      .box {
        max-width: none;
        max-height: calc(100vh - 60px);
        border-radius: 22px 22px 0 0;
        padding-top: 12px;
      }

      .box::before {
        content: '';
        display: block;
        width: 38px;
        height: 4px;
        margin: 0 auto 4px;
        border-radius: 99px;
        background: var(--db-handle);
      }

      .box--status .box__stripe {
        display: none;
      }

      .head,
      .box--status .head,
      .box--context .head {
        flex-direction: column;
        align-items: center;
        padding: 12px 20px 0;
        text-align: center;
      }

      .box--context .head__copy {
        align-items: center;
      }

      .head__close {
        display: none;
      }

      .foot,
      .box--context .foot {
        flex-direction: column-reverse;
        gap: 8px;
        padding: 20px 20px 24px;
      }

      .foot--stacked {
        flex-direction: column;
      }

      .btn,
      .box--context .btn {
        width: 100%;
        flex: 0 0 auto;
      }

      .foot__note {
        order: 3;
        text-align: center;
      }
    }
  `,
})
export class DialogComponent {
  readonly request = input.required<DialogRequest>();
  readonly closed = output<DialogResult>();

  protected readonly reason = signal('');
  protected readonly typed = signal('');
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly challengeInput = viewChild<ElementRef<HTMLInputElement>>('challengeInput');
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly layout = computed(() => this.request().layout ?? 'confirm');
  protected readonly intent = computed(() => this.request().intent ?? 'primary');
  protected readonly width = computed(
    () => ANCHOS[this.request().size ?? (this.layout() === 'context' ? 'wide' : 'standard')],
  );
  protected readonly icon = computed(
    () => this.request().icon ?? ICONO_POR_INTENCION[this.intent()],
  );
  protected readonly tileIcon = computed(() => {
    if (this.layout() === 'status') return 26;
    return this.layout() === 'confirm' && this.intent() === 'danger' ? 23 : 21;
  });

  protected readonly confirmBlocked = computed(() => {
    if (this.request().reason?.required && !this.reason().trim()) return true;
    const challenge = this.request().challenge;
    if (!challenge) return false;
    return this.typed().trim().toUpperCase() !== challenge.identifier.trim().toUpperCase();
  });

  protected readonly challengePlaceholder = computed(() => {
    const identifier = this.request().challenge?.identifier ?? '';
    const dash = identifier.indexOf('-');
    return dash > 0 ? identifier.slice(0, dash + 1) : '';
  });

  protected readonly meterPercent = computed(() => {
    const meter = this.request().meter;
    if (!meter?.quota) return 0;
    return Math.min(100, (meter.used / meter.quota) * 100);
  });

  constructor() {
    effect(() => {
      this.request();
      this.reason.set('');
      this.typed.set('');
      queueMicrotask(() => (this.challengeInput()?.nativeElement ?? this.box()?.nativeElement)?.focus());
    });
  }

  protected onTyped(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected dismiss(): void {
    if (this.request().dismissible !== false) this.answer('cancel');
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.answer('cancel');
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>(
        'button, textarea, [href], input, select, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => !element.hasAttribute('disabled'));
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === this.box()?.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected answer(answer: DialogAnswer): void {
    this.closed.emit({ answer, reason: this.reason() || undefined });
  }
}
