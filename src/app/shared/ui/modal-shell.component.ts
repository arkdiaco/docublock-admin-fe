import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BusyIconComponent } from './busy-icon.component';
import { IconComponent, type IconName } from './icon.component';

@Component({
  selector: 'db-modal-shell',
  imports: [TranslatePipe, IconComponent, BusyIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismissed.emit()' },
  template: `
    <button
      type="button"
      class="scrim"
      tabindex="-1"
      [attr.aria-label]="'common.close' | translate"
      (click)="dismissed.emit()"
    ></button>

    <div
      class="box"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dbModalTitle"
      [style.max-width.px]="maxWidth()"
    >
      <header class="head">
        <span class="head__tile" aria-hidden="true">
          <db-icon [name]="icon()" [size]="20" />
        </span>
        <span class="head__naming">
          <h2 class="head__title" id="dbModalTitle">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="head__sub">{{ subtitle() }}</p>
          }
        </span>
        <button
          type="button"
          class="head__close"
          [attr.aria-label]="'common.close' | translate"
          (click)="dismissed.emit()"
        >
          <db-icon name="close" [size]="18" />
        </button>
      </header>

      <div class="body">
        <ng-content />
      </div>

      <footer class="foot">
        @if (cancelable()) {
          <button type="button" class="foot__ghost" (click)="dismissed.emit()">
            {{ (cancelLabel() || 'common.cancel') | translate }}
          </button>
        }
        <button
          type="button"
          class="foot__go"
          [class.foot__go--busy]="busy()"
          [attr.aria-busy]="busy()"
          [disabled]="confirmDisabled() || busy()"
          (click)="confirmed.emit()"
        >
          @if (busy()) {
            <db-busy-icon [busy]="true" [size]="16" />
          }
          <span>{{ confirmLabel() | translate }}</span>
        </button>
      </footer>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .scrim {
      position: absolute;
      inset: 0;
      border: 0;
      padding: 0;
      background: var(--db-scrim);
      cursor: default;
    }

    .box {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      max-height: 100%;
      border-radius: 16px;
      background: var(--db-surface);
      box-shadow: var(--db-shadow-dialog);
      overflow: hidden;
    }

    .head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--db-border-band);
    }

    .head__tile {
      flex: none;
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: var(--db-radius-item);
      background: var(--db-primary-pale-soft);
      color: var(--db-primary-ink);
    }

    .head__naming {
      flex: 1;
      min-width: 0;
    }

    .head__title {
      font-size: var(--db-text-field);
      font-weight: 600;
      letter-spacing: var(--db-tracking-title);
      color: var(--db-ink-strong);
    }

    .head__sub {
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--db-text-counter);
      color: var(--db-ink-note-soft);
    }

    .head__close {
      flex: none;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: var(--db-radius-control);
      background: none;
      color: var(--db-ink-ghost);
      cursor: pointer;
    }

    .head__close:hover {
      background: var(--db-surface-sunken);
      color: var(--db-ink-strong);
    }

    .body {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
      padding: 20px;
      overflow: auto;
    }

    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 9px;
      padding: 16px 20px;
      border-top: 1px solid var(--db-border-band);
      background: var(--db-surface-head);
    }

    .foot__ghost {
      padding: 11px 16px;
      border: 1px solid var(--db-border-subtle);
      border-radius: var(--db-radius-field);
      background: var(--db-surface);
      font-family: var(--db-font);
      font-size: var(--db-text-body);
      font-weight: 600;
      color: var(--db-ink-muted);
      cursor: pointer;
    }

    .foot__ghost:hover {
      background: var(--db-surface-sunken);
    }

    .foot__go {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 18px;
      border: 0;
      border-radius: var(--db-radius-field);
      background: var(--db-primary);
      font-family: var(--db-font);
      font-size: var(--db-text-body);
      font-weight: 600;
      color: var(--db-primary-contrast);
      cursor: pointer;
    }

    .foot__go:hover:not(:disabled) {
      background: var(--db-primary-ink);
    }

    .foot__go--busy:disabled {
      background: var(--db-primary);
      color: var(--db-primary-contrast);
      cursor: progress;
      opacity: 0.85;
    }

    .foot__go:disabled:not(.foot__go--busy) {
      background: var(--db-surface-off);
      color: var(--db-ink-dim);
      cursor: not-allowed;
    }
  `,
})
export class ModalShellComponent {
  readonly icon = input.required<IconName>();
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly maxWidth = input(460);
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input('');
  readonly cancelable = input(true);
  readonly confirmDisabled = input(false);
  readonly busy = input(false);

  readonly dismissed = output<void>();
  readonly confirmed = output<void>();
}
