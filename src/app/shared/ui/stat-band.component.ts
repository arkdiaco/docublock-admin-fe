import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export type StatTone = 'plain' | 'warn' | 'danger';

export interface StatTrend {
  label: string;
  tone: 'up' | 'down' | 'flat';
}

export interface StatCell {
  key: string;
  label: string;
  value: string;
  note?: string;
  tone?: StatTone;
  noteTone?: StatTone;
  trend?: StatTrend;
}

@Component({
  selector: 'db-stat-band',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="band" [attr.role]="interactive() ? 'group' : null" [attr.aria-label]="label()" [attr.aria-busy]="busy() || null">
      @for (cell of cells(); track cell.key) {
        @if (interactive()) {
          <button
            type="button"
            class="band__cell band__cell--button"
            [class.band__cell--on]="cell.key === active()"
            [attr.aria-pressed]="cell.key === active()"
            (click)="picked.emit(cell.key)"
          >
            <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: cell }" />
          </button>
        } @else {
          <article class="band__cell">
            <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: cell }" />
          </article>
        }
      }
    </section>

    <ng-template #body let-cell>
      <span class="band__eyebrow">{{ cell.label }}</span>
      <span class="band__row">
        <span class="band__value" [class]="'band__value band__value--' + (cell.tone ?? 'plain')">{{ cell.value }}</span>
        @if (cell.trend; as trend) {
          <span class="band__trend" [class]="'band__trend band__trend--' + trend.tone">{{ trend.label }}</span>
        }
      </span>
      @if (cell.note) {
        <span class="band__note" [class]="'band__note band__note--' + (cell.noteTone ?? 'plain')">{{ cell.note }}</span>
      }
    </ng-template>
  `,
  styles: `
    .band {
      display: flex;
      gap: 1px;
      border: 1px solid var(--db-border-band);
      border-radius: 12px;
      background: var(--db-border-band);
      overflow: hidden;
    }

    .band__cell {
      flex: 1;
      min-width: 0;
      padding: 16px 18px;
      border: 0;
      background: var(--db-surface);
      font-family: var(--db-font);
      text-align: left;
    }

    .band__cell--button {
      cursor: pointer;
    }

    .band__cell--button:hover {
      background: var(--db-surface-head);
    }

    .band__cell--on,
    .band__cell--on:hover {
      background: var(--db-primary-pale-soft);
      box-shadow: inset 0 -2px 0 var(--db-primary);
    }

    .band__eyebrow {
      display: block;
      margin-bottom: 9px;
      font: 600 9px var(--db-font-mono);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--db-ink-soft);
      white-space: nowrap;
    }

    .band__row {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .band__trend {
      font: 600 11.5px var(--db-font-mono);
      color: var(--db-ink-soft);
    }

    .band__trend--up {
      color: var(--db-success-ink);
    }

    .band__trend--down {
      color: var(--db-danger-ink);
    }

    .band__note--warn {
      color: var(--db-warn-deep);
    }

    .band__note--danger {
      color: var(--db-danger-ink);
    }

    .band__value {
      display: block;
      font: 600 26px var(--db-font-mono);
      letter-spacing: -0.032em;
      font-variant-numeric: tabular-nums;
      color: var(--db-ink-strong);
    }

    .band__value--warn {
      color: var(--db-warn-deep);
    }

    .band__value--danger {
      color: var(--db-danger-ink);
    }

    .band__note {
      display: block;
      margin-top: 6px;
      font-size: 11px;
      color: var(--db-ink-soft);
    }

    @media (max-width: 1200px) {
      .band {
        flex-wrap: wrap;
      }

      .band__cell {
        flex: 1 1 30%;
      }
    }

    @media (max-width: 720px) {
      .band__cell {
        flex: 1 1 45%;
        padding: 12px 14px;
      }

      .band__eyebrow {
        white-space: normal;
      }
    }

    @media (max-width: 420px) {
      .band__cell {
        flex: 1 1 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas: 'eyebrow value' 'note value';
        align-items: center;
        column-gap: 12px;
        padding: 11px 14px;
      }

      .band__eyebrow {
        grid-area: eyebrow;
        margin-bottom: 0;
      }

      .band__row {
        grid-area: value;
      }

      .band__value {
        font-size: 22px;
      }

      .band__note {
        grid-area: note;
        margin-top: 3px;
      }
    }
  `,
})
export class StatBandComponent {
  readonly cells = input.required<readonly StatCell[]>();
  readonly label = input('');
  readonly interactive = input(false);
  readonly active = input<string | null>(null);
  readonly busy = input(false);
  readonly picked = output<string>();
}
