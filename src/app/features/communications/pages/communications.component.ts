import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/ui/notification.service';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import { CampaignImageComponent } from '../components/campaign-image.component';
import { RecipientPickerComponent } from '../components/recipient-picker.component';
import { RecipientsReviewComponent } from '../components/recipients-review.component';
import { CommunicationsApi } from '../data/communications.api';
import type { CampaignImage, RecipientsPreview, RecipientsSelection } from '../data/communications.models';
import { MAX_CONTACTS, parseNumbers } from '../data/recipient-selection';

type RecipientsTab = 'user' | 'signer' | 'number';

@Component({
  selector: 'dba-communications',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CampaignImageComponent,
    FieldComponent,
    RecipientPickerComponent,
    RecipientsReviewComponent,
    TextAreaComponent,
    UnderlineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.communications' | translate }}</h1>
          <span class="dba-meta">{{ 'comm.lead' | translate }}</span>
        </div>
      </header>

      <section class="step">
        <h2 class="dba-panel">{{ 'comm.recipients.title' | translate }}</h2>
        <db-underline-tabs
          [tabs]="tabs()"
          [active]="tab()"
          [label]="'comm.recipients.title' | translate"
          (picked)="tab.set($any($event))"
        />
        @switch (tab()) {
          @case ('user') {
            <dba-recipient-picker kind="user" [(selected)]="userIds" />
          }
          @case ('signer') {
            <dba-recipient-picker kind="signer" [(selected)]="signerIds" />
          }
          @default {
            <dba-text-area
              label="comm.numbers.label"
              placeholder="comm.numbers.placeholder"
              [hint]="numbersCapped() ? 'comm.numbers.capped' : 'comm.numbers.hint'"
              [rows]="8"
              [(value)]="numbersText"
            />
          }
        }
      </section>

      <section class="step">
        <h2 class="dba-panel">{{ 'comm.review.title' | translate }}</h2>
        <dba-field
          class="step__name"
          label="comm.defaultName.label"
          hint="comm.defaultName.hint"
          [maxlength]="120"
          [(value)]="defaultName"
        />
        <div class="step__actions">
          <button dba-button [busy]="reviewing()" [disabled]="selectedCount() === 0" (click)="review()">
            {{ 'comm.review.run' | translate: { total: selectedCount() } }}
          </button>
          @if (stale()) {
            <span class="dba-meta" role="status">{{ 'comm.review.stale' | translate }}</span>
          }
        </div>
        @if (preview(); as result) {
          <dba-recipients-review [preview]="result" />
        }
      </section>

      @if (canManage()) {
        <section class="step">
          <h2 class="dba-panel">{{ 'comm.image.title' | translate }}</h2>
          <dba-campaign-image [(image)]="image" />
        </section>
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .step {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 28px;
    }

    .step__name {
      width: 100%;
      max-width: 420px;
    }

    .step__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
  `,
})
export class CommunicationsComponent {
  private readonly api = inject(CommunicationsApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly tab = signal<RecipientsTab>('user');
  protected readonly userIds = signal<ReadonlySet<string>>(new Set());
  protected readonly signerIds = signal<ReadonlySet<string>>(new Set());
  protected readonly numbersText = signal('');
  protected readonly defaultName = signal('');
  protected readonly image = signal<CampaignImage | null>(null);
  protected readonly reviewing = signal(false);
  protected readonly preview = signal<RecipientsPreview | null>(null);

  private readonly numbers = computed(() => parseNumbers(this.numbersText()));
  protected readonly numbersCapped = computed(() => this.numbers().length > MAX_CONTACTS);
  protected readonly selectedCount = computed(
    () => this.userIds().size + this.signerIds().size + Math.min(this.numbers().length, MAX_CONTACTS),
  );

  private readonly selection = computed(
    (): RecipientsSelection => ({
      userIds: [...this.userIds()],
      signerIds: [...this.signerIds()],
      numbers: this.numbers().slice(0, MAX_CONTACTS),
      ...(this.defaultName().trim() ? { defaultName: this.defaultName().trim() } : {}),
    }),
  );
  private readonly reviewed = signal<RecipientsSelection | null>(null);
  protected readonly stale = computed(
    () => this.preview() !== null && this.reviewed() !== this.selection(),
  );

  protected readonly tabs = computed((): UnderlineTab[] => [
    { key: 'user', label: this.label('comm.tab.user'), count: this.userIds().size },
    { key: 'signer', label: this.label('comm.tab.signer'), count: this.signerIds().size },
    { key: 'number', label: this.label('comm.tab.number'), count: this.numbers().length },
  ]);

  protected async review(): Promise<void> {
    const selection = this.selection();
    this.reviewing.set(true);
    try {
      this.preview.set(await firstValueFrom(this.api.preview(selection)));
      this.reviewed.set(selection);
    } catch {
      this.notify.error(this.label('comm.review.failed'));
    } finally {
      this.reviewing.set(false);
    }
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
