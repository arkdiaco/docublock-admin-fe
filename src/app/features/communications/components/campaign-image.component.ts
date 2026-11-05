import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { CommunicationsApi, imageErrorKey } from '../data/communications.api';
import type { CampaignImage } from '../data/communications.models';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg'];

@Component({
  selector: 'dba-campaign-image',
  imports: [TranslatePipe, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="image">
      @if (image(); as current) {
        <img class="image__thumb" [src]="current.url" [alt]="'comm.image.alt' | translate" />
      }
      <div class="image__side">
        <input
          #file
          type="file"
          class="image__file"
          accept="image/png,image/jpeg"
          [attr.aria-label]="'comm.image.pick' | translate"
          (change)="onPick($event)"
        />
        <div class="image__actions">
          <button dba-button variant="secondary" [busy]="busy()" (click)="file.click()">
            <db-icon name="uploadCloud" [size]="15" />
            {{ (image() ? 'comm.image.change' : 'comm.image.pick') | translate }}
          </button>
          @if (image()) {
            <button dba-button variant="secondary" (click)="image.set(null)">
              {{ 'comm.image.remove' | translate }}
            </button>
          }
        </div>
        @if (error()) {
          <p class="image__note image__note--error" role="alert">{{ error() | translate }}</p>
        } @else {
          <p class="image__note">{{ 'comm.image.hint' | translate }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    .image {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 16px;
    }

    .image__thumb {
      display: block;
      width: 200px;
      max-width: 100%;
      height: auto;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-control);
    }

    .image__side {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    .image__file {
      display: none;
    }

    .image__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .image__note {
      margin: 0;
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .image__note--error {
      color: var(--dba-state-suspended-fg);
    }
  `,
})
export class CampaignImageComponent {
  readonly image = model<CampaignImage | null>(null);

  private readonly api = inject(CommunicationsApi);

  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async onPick(event: Event): Promise<void> {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    field.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      this.error.set('comm.image.badType');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.error.set('comm.image.tooBig');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    try {
      this.image.set(await firstValueFrom(this.api.uploadImage(file)));
    } catch (error) {
      this.error.set(imageErrorKey(error));
    } finally {
      this.busy.set(false);
    }
  }
}
