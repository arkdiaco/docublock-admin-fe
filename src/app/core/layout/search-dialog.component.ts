import { ChangeDetectionStrategy, Component, ElementRef, effect, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'dba-search-dialog',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <button type="button" class="scrim" tabindex="-1" [attr.aria-label]="'common.close' | translate" (click)="closed.emit()"></button>
    <div class="box" role="dialog" aria-modal="true" [attr.aria-label]="'shell.searchAria' | translate">
      <label class="box__field">
        <db-icon name="search" [size]="16" />
        <input
          #field
          type="search"
          class="box__input"
          autocomplete="off"
          spellcheck="false"
          [placeholder]="'shell.searchHint' | translate"
          [value]="query()"
          (input)="onInput($event)"
        />
        <kbd class="box__kbd">Esc</kbd>
      </label>
      <p class="box__note">
        @if (query().trim()) {
          {{ 'shell.searchEmpty' | translate }}
        } @else {
          {{ 'shell.searchHint' | translate }}
        }
      </p>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 12vh 16px 16px;
    }

    .scrim {
      position: absolute;
      inset: 0;
      padding: 0;
      border: 0;
      background: rgba(22, 18, 31, 0.42);
      cursor: default;
    }

    .box {
      position: relative;
      width: 100%;
      max-width: 560px;
      padding: 10px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .box__field {
      display: flex;
      align-items: center;
      gap: 10px;
      height: var(--dba-height-row);
      padding: 0 14px;
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-chip);
      color: var(--dba-text-muted);
    }

    .box__field:focus-within {
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .box__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-field);
      color: var(--dba-ink);
    }

    .box__input:focus {
      outline: none;
    }

    .box__input::placeholder {
      color: var(--dba-text-faint);
    }

    .box__kbd {
      padding: 1px 5px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-key);
      background: var(--dba-surface);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      color: var(--dba-text-muted);
    }

    .box__note {
      margin: 10px 6px 4px;
      font-size: var(--dba-text-label);
      line-height: 1.5;
      color: var(--dba-text-muted);
    }
  `,
})
export class SearchDialogComponent {
  readonly closed = output<void>();

  protected readonly query = signal('');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => {
      const input = this.field()?.nativeElement;
      if (input) queueMicrotask(() => input.focus());
    });
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
