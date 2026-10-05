import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LoaderComponent } from './loader.component';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'dark';

@Component({
  selector: 'button[dba-button], a[dba-button]',
  imports: [LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'btn btn--' + variant()",
    '[class.btn--icon]': 'iconOnly()',
    '[class.btn--block]': 'block()',
    '[attr.disabled]': "disabled() || busy() ? '' : null",
    '[attr.aria-busy]': 'busy() || null',
  },
  template: `
    @if (busy()) {
      <db-loader class="btn__loader" size="16px" />
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: var(--dba-height-control);
      padding: 0 16px;
      border: 1px solid transparent;
      border-radius: var(--dba-radius-control);
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-body);
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      text-decoration: none;
      cursor: pointer;
      transition:
        background 0.15s,
        border-color 0.15s;
    }

    :host(:focus-visible) {
      outline: none;
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    :host([disabled]) {
      opacity: 0.55;
      cursor: not-allowed;
    }

    :host(.btn--primary) {
      background: var(--dba-violet-500);
      color: var(--dba-surface);
    }

    :host(.btn--primary:hover:not([disabled])) {
      background: var(--dba-violet-600);
    }

    :host(.btn--secondary) {
      border-color: var(--dba-border-control);
      background: var(--dba-surface);
      color: var(--dba-ink);
    }

    :host(.btn--secondary:hover:not([disabled])) {
      border-color: var(--dba-violet-300);
      background: var(--dba-surface-hover);
    }

    :host(.btn--destructive) {
      border-color: var(--dba-state-suspended-border);
      background: var(--dba-state-suspended-bg);
      color: var(--dba-state-suspended-fg);
    }

    :host(.btn--destructive:hover:not([disabled])) {
      border-color: var(--dba-state-suspended-dot);
    }

    :host(.btn--dark) {
      background: var(--dba-ink);
      color: var(--dba-surface);
    }

    :host(.btn--dark:hover:not([disabled])) {
      background: var(--dba-violet-900);
    }

    :host(.btn--icon) {
      flex: none;
      width: var(--dba-height-control);
      padding: 0;
    }

    :host(.btn--block) {
      width: 100%;
    }

    .btn__loader {
      --ld-ink: currentColor;
      display: inline-flex;
    }
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly busy = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly iconOnly = input(false, { transform: booleanAttribute });
  readonly block = input(false, { transform: booleanAttribute });
}
