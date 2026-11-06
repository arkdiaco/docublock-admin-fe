import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import type { PlatformDocumentDetail } from '../data/documents.models';
import { namesOf, noticeWarningsOf, signersOf } from '../data/turn-changes';

@Component({
  selector: 'dba-turn-notice-field',
  imports: [TranslatePipe, FormsModule, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (names()) {
      <div class="form__switch">
        <p-toggleswitch
          inputId="turn-notice"
          [ngModel]="notify()"
          (ngModelChange)="notify.set($event)"
        />
        <span class="form__switchCopy">
          <label class="form__label" for="turn-notice">{{
            'docs.turnNotice.label' | translate
          }}</label>
          <span class="dba-meta">{{ 'docs.turnNotice.hint' | translate: { names: names() } }}</span>
        </span>
      </div>
      @for (warning of warnings(); track warning.key) {
        <p class="notice" role="note">{{ warning.key | translate: warning.params }}</p>
      }
    }
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
  styles: `
    :host {
      display: contents;
    }

    .form__switch p-toggleswitch {
      flex-shrink: 0;
    }
  `,
})
export class TurnNoticeFieldComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly now = new Date();

  readonly document = input.required<PlatformDocumentDetail>();
  readonly invitable = input<readonly string[]>([]);
  readonly notify = model(false);

  protected readonly names = computed(() => namesOf(signersOf(this.document(), this.invitable())));

  protected readonly warnings = computed(() =>
    noticeWarningsOf(this.document(), this.invitable(), this.notify(), this.now, (iso) =>
      formatDate(iso, 'd/MM/y HH:mm', this.locale),
    ),
  );
}
