import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type FieldBadgeTone = 'ok' | 'warn' | 'bad' | 'plain';

let nextId = 0;

@Component({
  selector: 'dba-field',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field" [class.field--invalid]="!!error()" [class.field--disabled]="disabled()">
      @if (label()) {
        <label class="field__label" [attr.for]="id">{{ label() | translate }}</label>
      }
      <div class="field__box" [class.field__box--mono]="mono()">
        <input
          class="field__input"
          [id]="id"
          [type]="type()"
          [name]="name()"
          [placeholder]="placeholder() | translate"
          [disabled]="disabled()"
          [attr.autocomplete]="autocomplete()"
          [attr.maxlength]="maxlength()"
          [attr.inputmode]="inputmode()"
          [attr.aria-invalid]="error() ? true : null"
          [attr.aria-describedby]="describedBy()"
          [value]="value()"
          (input)="onInput($event)"
        />
        @if (badge()) {
          <span class="field__caret" aria-hidden="true"></span>
          <span class="field__badge" [class]="'field__badge field__badge--' + badgeTone()">{{ badge() | translate }}</span>
        }
      </div>
      @if (error()) {
        <p class="field__note field__note--error" [id]="id + '-note'">{{ error() | translate }}</p>
      } @else if (hint()) {
        <p class="field__note" [id]="id + '-note'">{{ hint() | translate }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .field__label {
      display: block;
      margin-bottom: 6px;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    .field__box {
      display: flex;
      align-items: center;
      gap: 10px;
      height: var(--dba-height-control);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }

    .field__box:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow:
        inset 0 0 0 0.5px var(--dba-violet-500),
        0 0 0 3px var(--dba-focus-halo);
    }

    .field--invalid .field__box {
      border-color: var(--dba-state-suspended-dot);
    }

    .field--invalid .field__box:focus-within {
      box-shadow:
        inset 0 0 0 0.5px var(--dba-state-suspended-dot),
        0 0 0 3px var(--dba-state-suspended-bg);
    }

    .field--disabled .field__box {
      background: var(--dba-surface-muted);
    }

    .field__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-body);
      color: var(--dba-ink);
    }

    .field__box--mono .field__input {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-cell);
    }

    .field__input:focus {
      outline: none;
    }

    .field__input::placeholder {
      color: var(--dba-text-faint);
    }

    .field__input:disabled {
      color: var(--dba-text-muted);
      cursor: not-allowed;
    }

    .field__caret {
      flex: none;
      width: 1.5px;
      height: 17px;
      background: var(--dba-violet-500);
      opacity: 0;
    }

    .field__box:focus-within .field__caret {
      opacity: 1;
    }

    .field__badge {
      flex: none;
      padding: 2px 7px;
      border: 1px solid;
      border-radius: var(--dba-radius-key);
      font-size: var(--dba-text-meta);
      font-weight: 700;
      white-space: nowrap;
    }

    .field__badge--ok {
      border-color: var(--dba-state-active-border);
      background: var(--dba-state-active-bg);
      color: var(--dba-state-active-fg);
    }

    .field__badge--warn {
      border-color: var(--dba-state-warning-border);
      background: var(--dba-state-warning-bg);
      color: var(--dba-state-warning-fg);
    }

    .field__badge--bad {
      border-color: var(--dba-state-suspended-border);
      background: var(--dba-state-suspended-bg);
      color: var(--dba-state-suspended-fg);
    }

    .field__badge--plain {
      border-color: var(--dba-border-control);
      background: var(--dba-surface-muted);
      color: var(--dba-text-soft);
    }

    .field__note {
      margin: 6px 0 0;
      font-size: var(--dba-text-small);
      line-height: 1.4;
      color: var(--dba-text-muted);
    }

    .field__note--error {
      color: var(--dba-state-suspended-fg);
    }
  `,
})
export class FieldComponent {
  readonly value = model('');
  readonly label = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly placeholder = input('');
  readonly badge = input('');
  readonly badgeTone = input<FieldBadgeTone>('ok');
  readonly type = input('text');
  readonly name = input('');
  readonly autocomplete = input<string | null>(null);
  readonly inputmode = input<string | null>(null);
  readonly maxlength = input<number | null>(null);
  readonly mono = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly id = `dba-field-${++nextId}`;
  protected readonly describedBy = computed(() => (this.error() || this.hint() ? `${this.id}-note` : null));

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
