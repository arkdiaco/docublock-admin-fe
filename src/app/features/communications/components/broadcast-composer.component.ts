import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/ui/notification.service';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import { BroadcastsApi, publishErrorKey } from '../data/broadcasts.api';
import { broadcastDraftOf, type BroadcastView } from '../data/broadcasts.models';
import { BroadcastPreviewComponent } from './broadcast-preview.component';

@Component({
  selector: 'dba-broadcast-composer',
  imports: [TranslatePipe, ButtonComponent, FieldComponent, ModalShellComponent, TextAreaComponent, BroadcastPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      <h2 class="dba-panel">{{ 'comm.live.compose.title' | translate }}</h2>
      <div class="step__message">
        <div class="step__fields">
          <dba-field label="comm.live.compose.titleLabel" placeholder="comm.live.compose.titlePlaceholder" [(value)]="title" />
          <dba-text-area
            label="comm.live.compose.messageLabel"
            placeholder="comm.live.compose.messagePlaceholder"
            hint="comm.live.compose.messageHint"
            [rows]="7"
            [(value)]="message"
          />
        </div>
        <dba-broadcast-preview [title]="draft().title" [message]="draft().message" />
      </div>
      <div class="step__actions">
        <button dba-button [disabled]="!ready()" (click)="confirming.set(true)">
          {{ 'comm.live.compose.publish' | translate }}
        </button>
        @if (!ready()) {
          <span class="dba-meta">{{ 'comm.live.compose.missing' | translate }}</span>
        }
      </div>
    </section>

    @if (confirming()) {
      <db-modal-shell
        icon="bell"
        [title]="'comm.live.confirm.title' | translate"
        [subtitle]="draft().title"
        confirmLabel="comm.live.confirm.publish"
        [busy]="publishing()"
        [maxWidth]="520"
        (confirmed)="publish()"
        (dismissed)="dismiss()"
      >
        <p class="notice" role="note">{{ 'comm.live.confirm.notice' | translate }}</p>
      </db-modal-shell>
    }
  `,
  styleUrls: ['../../../shared/ui/confirm-notice.scss'],
  styles: `
    .step {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 28px;
    }

    .step__message {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 20px;
      align-items: start;
    }

    .step__fields {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }

    @media (max-width: 760px) {
      .step__message {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .step__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
  `,
})
export class BroadcastComposerComponent {
  readonly published = output<BroadcastView>();

  private readonly api = inject(BroadcastsApi);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  protected readonly title = signal('');
  protected readonly message = signal('');
  protected readonly confirming = signal(false);
  protected readonly publishing = signal(false);
  protected readonly draft = computed(() => broadcastDraftOf(this.title(), this.message()));
  protected readonly ready = computed(() => !!this.draft().title && !!this.draft().message);

  protected dismiss(): void {
    if (!this.publishing()) this.confirming.set(false);
  }

  protected async publish(): Promise<void> {
    if (!this.ready() || this.publishing()) return;
    this.publishing.set(true);
    try {
      const created = await firstValueFrom(this.api.publish(this.draft()));
      this.confirming.set(false);
      this.title.set('');
      this.message.set('');
      this.notify.success(this.label('comm.live.publish.done'));
      this.published.emit(created);
    } catch (error) {
      this.notify.error(this.label(publishErrorKey(error)));
    } finally {
      this.publishing.set(false);
    }
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
