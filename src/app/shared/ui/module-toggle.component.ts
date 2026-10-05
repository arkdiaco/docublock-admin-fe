import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'dba-module-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mod" [class.mod--on]="on()">
      <span class="mod__tile" aria-hidden="true">{{ abbr() }}</span>
      <div class="mod__body">
        <p class="mod__name">{{ name() }}</p>
        @if (meta()) {
          <p class="mod__meta">{{ meta() }}</p>
        }
      </div>
      <button
        type="button"
        role="switch"
        class="mod__switch"
        [attr.aria-checked]="on()"
        [attr.aria-label]="name()"
        [disabled]="disabled()"
        (click)="toggled.emit(!on())"
      >
        <span class="mod__knob"></span>
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .mod {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--dba-surface);
    }

    .mod__tile {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--dba-size-tile);
      height: var(--dba-size-tile);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-muted);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-micro);
      font-weight: 600;
      color: var(--dba-text-faint);
    }

    .mod--on .mod__tile {
      background: var(--dba-violet-100);
      color: var(--dba-violet-700);
    }

    .mod__body {
      flex: 1;
      min-width: 0;
    }

    .mod__name {
      margin: 0;
      font-size: var(--dba-text-body);
      font-weight: 600;
      color: var(--dba-ink);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mod__meta {
      margin: 0;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-micro);
      color: var(--dba-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mod__switch {
      position: relative;
      flex: none;
      width: var(--dba-size-switch-w);
      height: var(--dba-size-switch-h);
      padding: 0;
      border: 0;
      border-radius: var(--dba-radius-pill);
      background: var(--dba-border-control);
      cursor: pointer;
      transition: background 0.15s;
    }

    .mod--on .mod__switch {
      background: var(--dba-violet-500);
    }

    .mod__switch:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .mod__switch:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .mod__knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: var(--dba-size-knob);
      height: var(--dba-size-knob);
      border-radius: var(--dba-radius-pill);
      background: var(--dba-surface);
      transition: left 0.15s;
    }

    .mod--on .mod__knob {
      left: calc(var(--dba-size-switch-w) - var(--dba-size-knob) - 2px);
    }
  `,
})
export class ModuleToggleComponent {
  readonly abbr = input.required<string>();
  readonly name = input.required<string>();
  readonly meta = input('');
  readonly on = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly toggled = output<boolean>();
}
