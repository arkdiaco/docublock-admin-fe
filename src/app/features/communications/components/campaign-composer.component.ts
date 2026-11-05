import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/ui/notification.service';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import { CAMPAIGN_UNCERTAIN, CommunicationsApi, campaignErrorKey } from '../data/communications.api';
import type { CampaignView, PickedImage, RecipientsPreview, RecipientsSelection } from '../data/communications.models';
import { MAX_CONTACTS, TEXT_MAX, cleanVariable, parseNumbers } from '../data/recipient-selection';
import { CampaignImageComponent } from './campaign-image.component';
import { MessagePreviewComponent } from './message-preview.component';
import { RecipientPickerComponent } from './recipient-picker.component';
import { RecipientsReviewComponent } from './recipients-review.component';
import { SendConfirmComponent } from './send-confirm.component';

type RecipientsTab = 'user' | 'signer' | 'number';

@Component({
  selector: 'dba-campaign-composer',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CampaignImageComponent,
    FieldComponent,
    MessagePreviewComponent,
    RecipientPickerComponent,
    RecipientsReviewComponent,
    SendConfirmComponent,
    TextAreaComponent,
    UnderlineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
        <h2 class="dba-panel">{{ 'comm.message.title' | translate }}</h2>
        <div class="step__message">
          <div class="step__fields">
            <dba-campaign-image [(image)]="image" />
            <dba-text-area
              label="comm.message.text"
              placeholder="comm.message.placeholder"
              hint="comm.message.hint"
              [rows]="6"
              [maxlength]="textMax"
              [(value)]="text"
            />
          </div>
          <dba-message-preview [imageUrl]="image()?.localUrl ?? ''" [name]="previewName()" [text]="cleanText()" />
        </div>
        <div class="step__actions">
          <button dba-button [busy]="preparing()" [disabled]="missing().length > 0" (click)="prepare()">
            {{ 'comm.send.prepare' | translate }}
          </button>
          @if (missing().length > 0) {
            <span class="dba-meta">{{ 'comm.send.missing' | translate: { items: missing().join(', ') } }}</span>
          }
        </div>
      </section>
    }

    @if (confirming() && preview(); as result) {
      <dba-send-confirm
        [sendable]="result.sendable.length"
        [excluded]="result.excluded.length"
        [busy]="sending()"
        (submitted)="send($event)"
        (dismissed)="confirming.set(false)"
      />
    }
  `,
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
export class CampaignComposerComponent {
  readonly created = output<CampaignView>();
  readonly uncertain = output<void>();

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
  protected readonly image = signal<PickedImage | null>(null);
  protected readonly text = signal('');
  protected readonly textMax = TEXT_MAX;
  protected readonly preparing = signal(false);
  protected readonly confirming = signal(false);
  protected readonly sending = signal(false);
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

  protected readonly cleanText = computed(() => cleanVariable(this.text()));
  protected readonly previewName = computed(
    () => this.preview()?.sendable[0]?.name ?? cleanVariable(this.defaultName()),
  );
  protected readonly missing = computed((): string[] => [
    ...(this.selectedCount() === 0 ? [this.label('comm.send.needRecipients')] : []),
    ...(this.image() ? [] : [this.label('comm.send.needImage')]),
    ...(this.cleanText() ? [] : [this.label('comm.send.needText')]),
  ]);

  protected async review(): Promise<void> {
    this.reviewing.set(true);
    try {
      await this.runReview();
    } catch {
      this.notify.error(this.label('comm.review.failed'));
    } finally {
      this.reviewing.set(false);
    }
  }

  protected async prepare(): Promise<void> {
    this.preparing.set(true);
    try {
      const result = await this.runReview();
      if (result.sendable.length === 0) {
        this.notify.error(this.label('comm.send.noRecipients'));
        return;
      }
      this.confirming.set(true);
    } catch {
      this.notify.error(this.label('comm.review.failed'));
    } finally {
      this.preparing.set(false);
    }
  }

  protected async send(reason: string): Promise<void> {
    const image = this.image();
    if (!image || this.sending()) return;
    this.sending.set(true);
    try {
      const created = await firstValueFrom(
        this.api.createCampaign({
          ...this.selection(),
          text: this.cleanText(),
          imageUrl: image.url,
          reason,
        }),
      );
      this.confirming.set(false);
      this.created.emit(created);
    } catch (error) {
      const key = campaignErrorKey(error);
      this.notify.error(this.label(key));
      if (key === CAMPAIGN_UNCERTAIN) {
        this.confirming.set(false);
        this.uncertain.emit();
      }
    } finally {
      this.sending.set(false);
    }
  }

  private async runReview(): Promise<RecipientsPreview> {
    const selection = this.selection();
    const result = await firstValueFrom(this.api.preview(selection));
    this.preview.set(result);
    this.reviewed.set(selection);
    return result;
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}
