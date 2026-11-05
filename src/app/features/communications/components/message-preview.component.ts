import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'dba-message-preview',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview">
      <p class="dba-eyebrow">{{ 'comm.message.previewTitle' | translate }}</p>
      @if (imageUrl()) {
        <img class="preview__image" [src]="imageUrl()" [alt]="'comm.image.alt' | translate" />
      } @else {
        <div class="preview__image preview__image--empty" aria-hidden="true"></div>
      }
      <dl class="preview__vars">
        <dt>{{ 'comm.message.previewName' | translate }}</dt>
        <dd [class.preview__empty]="!name()">{{ name() || ('comm.message.noName' | translate) }}</dd>
        <dt>{{ 'comm.message.previewText' | translate }}</dt>
        <dd [class.preview__empty]="!text()">{{ text() || ('comm.message.noText' | translate) }}</dd>
      </dl>
      <p class="preview__note">{{ 'comm.message.previewNote' | translate }}</p>
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
      background: var(--dba-surface);
    }

    .preview p {
      margin: 0;
    }

    .preview__image {
      display: block;
      width: 100%;
      max-height: 220px;
      object-fit: cover;
      border-radius: var(--dba-radius-control);
    }

    .preview__image--empty {
      height: 120px;
      background: var(--dba-surface-head);
    }

    .preview__vars {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 6px 12px;
      margin: 0;
      font-size: var(--dba-text-body);
    }

    .preview__vars dt {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text-muted);
    }

    .preview__vars dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--dba-ink);
    }

    .preview__vars dd.preview__empty {
      color: var(--dba-text-faint);
    }

    .preview__note {
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }
  `,
})
export class MessagePreviewComponent {
  readonly imageUrl = input('');
  readonly name = input('');
  readonly text = input('');
}
