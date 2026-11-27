import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/ui/icon.component';

@Component({
  selector: 'dba-broadcast-preview',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview">
      <p class="dba-eyebrow">{{ 'comm.live.preview.title' | translate }}</p>
      <div class="card" aria-hidden="true">
        <div class="card__head">
          <span class="card__tile"><db-icon name="bell" [size]="18" /></span>
          <span class="card__naming">
            <span class="card__title" [class.card__empty]="!title()">{{ title() || ('comm.live.preview.noTitle' | translate) }}</span>
            <span class="card__sub">{{ 'comm.live.preview.from' | translate }}</span>
          </span>
        </div>
        <p class="card__body" [class.card__empty]="!message()">{{ message() || ('comm.live.preview.noMessage' | translate) }}</p>
        <div class="card__foot"><span class="card__button">{{ 'comm.live.preview.understood' | translate }}</span></div>
      </div>
      <p class="preview__note">{{ 'comm.live.preview.note' | translate }}</p>
    </div>
  `,
  styles: `
    .preview {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface-head);
    }

    .preview p {
      margin: 0;
    }

    .card {
      overflow: hidden;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .card__head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--dba-border-card);
    }

    .card__tile {
      flex: none;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: var(--dba-radius-control);
      background: var(--db-primary-pale-soft);
      color: var(--db-primary-ink);
    }

    .card__naming {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .card__title {
      font-weight: 600;
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .card__sub {
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .card__body {
      max-height: 260px;
      overflow: auto;
      padding: 14px 16px;
      white-space: pre-line;
      overflow-wrap: anywhere;
      line-height: 1.55;
      color: var(--dba-text);
    }

    .card__empty {
      color: var(--dba-text-muted);
      font-style: italic;
    }

    .card__foot {
      display: flex;
      justify-content: flex-end;
      padding: 10px 16px;
      border-top: 1px solid var(--dba-border-card);
    }

    .card__button {
      padding: 6px 14px;
      border-radius: var(--dba-radius-control);
      background: var(--dba-violet-500);
      color: var(--dba-surface);
      font-weight: 600;
      font-size: var(--dba-text-meta);
    }

    .preview__note {
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }
  `,
})
export class BroadcastPreviewComponent {
  readonly title = input('');
  readonly message = input('');
}
